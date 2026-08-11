import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';
import { storageAdapter } from '../utils/storage';
import { validateVerificationDocument } from '../middleware/upload';

const submitSchema = z.object({
  cohortId: z.string().uuid(),
  documentType: z.enum(['birth_certificate', 'class10_certificate', 'other']),
});

// User submits a verification request with a document (multipart/form-data).
// The document itself is never stored in the DB — only a storage key.
export async function submitVerificationRequest(req: AuthedRequest, res: Response) {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'A document file is required' });
  }
  const documentError = validateVerificationDocument(req.file);
  if (documentError) {
    return res.status(400).json({ error: documentError });
  }

  const { cohortId, documentType } = parsed.data;
  const userId = req.user!.userId;

  try {
    // Prevent duplicate pending requests for the same cohort
    const existing = await pool.query(
      `SELECT id FROM verification_requests
       WHERE user_id = $1 AND cohort_id = $2 AND status = 'pending'`,
      [userId, cohortId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You already have a pending verification request for this cohort' });
    }

    // Already verified for this cohort?
    const alreadyMember = await pool.query(
      `SELECT id FROM cohort_members WHERE user_id = $1 AND cohort_id = $2`,
      [userId, cohortId]
    );
    if (alreadyMember.rows.length > 0) {
      return res.status(409).json({ error: 'You are already verified for this cohort' });
    }

    const cohort = await pool.query(
      'SELECT id FROM cohorts WHERE id = $1 AND is_active = TRUE',
      [cohortId]
    );
    if (cohort.rows.length === 0) {
      return res.status(400).json({ error: 'Selected cohort is not available' });
    }

    const storageKey = await storageAdapter.save(req.file.buffer, req.file.originalname);
    try {
      const result = await pool.query(
        `INSERT INTO verification_requests (user_id, cohort_id, document_type, document_storage_key, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, status, created_at`,
        [userId, cohortId, documentType, storageKey]
      );

      return res.status(201).json({ request: result.rows[0] });
    } catch (err) {
      // Do not leave a sensitive document on disk if its request was not saved.
      try {
        await storageAdapter.delete(storageKey);
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned verification document:', cleanupErr);
      }
      throw err;
    }
  } catch (err) {
    console.error('Submit verification error:', err);
    return res.status(500).json({ error: 'Failed to submit verification request' });
  }
}

// User checks their own verification status(es)
export async function getMyVerificationStatus(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  try {
    const requests = await pool.query(
      `SELECT vr.id, vr.status, vr.document_type, vr.rejection_reason, vr.created_at,
              c.birth_year, c.label
       FROM verification_requests vr
       JOIN cohorts c ON c.id = vr.cohort_id
       WHERE vr.user_id = $1
       ORDER BY vr.created_at DESC`,
      [userId]
    );

    const verifiedCohorts = await pool.query(
      `SELECT c.id, c.birth_year, c.label, cm.verified_at, cm.is_primary
       FROM cohort_members cm
       JOIN cohorts c ON c.id = cm.cohort_id
       WHERE cm.user_id = $1`,
      [userId]
    );

    res.json({ requests: requests.rows, verifiedCohorts: verifiedCohorts.rows });
  } catch (err) {
    console.error('Get verification status error:', err);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
}

// --- Admin-only below ---

export async function listPendingVerifications(_req: AuthedRequest, res: Response) {
  try {
    const result = await pool.query(
      `SELECT vr.id, vr.user_id, vr.document_type, vr.status, vr.created_at,
              c.birth_year, c.label, p.display_name
       FROM verification_requests vr
       JOIN cohorts c ON c.id = vr.cohort_id
       JOIN profiles p ON p.user_id = vr.user_id
       WHERE vr.status = 'pending'
       ORDER BY vr.created_at ASC`
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error('List pending verifications error:', err);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
}

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'suspicious']),
  rejectionReason: z.string().optional(),
});

export async function reviewVerificationRequest(req: AuthedRequest, res: Response) {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { requestId } = req.params;
  const { decision, rejectionReason } = parsed.data;
  const reviewerId = req.user!.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query(
      `SELECT id, user_id, cohort_id, status, document_storage_key
       FROM verification_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Verification request not found' });
    }
    const request = reqResult.rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Request already ${request.status}` });
    }

    await client.query(
      `UPDATE verification_requests
       SET status = $1, reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
       WHERE id = $4`,
      [decision, reviewerId, rejectionReason ?? null, requestId]
    );

    if (decision === 'approved') {
      await client.query(
        `INSERT INTO cohort_members (user_id, cohort_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, cohort_id) DO NOTHING`,
        [request.user_id, request.cohort_id]
      );
    }

    // Document is deleted from storage after review regardless of outcome —
    // it's only needed during the review window.
    // (Left as a follow-up call outside the transaction so a storage
    // failure never blocks the DB decision from committing.)

    await client.query('COMMIT');

    try {
      await storageAdapter.delete(request.document_storage_key);
      await pool.query(
        'UPDATE verification_requests SET document_deleted_at = now() WHERE id = $1',
        [requestId]
      );
    } catch (cleanupErr) {
      // The review decision is already committed. Log the cleanup failure for
      // operational follow-up without falsely reporting that the review failed.
      console.error('Failed to delete verification document after review:', cleanupErr);
    }

    res.json({ requestId, decision });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Review verification error:', err);
    res.status(500).json({ error: 'Failed to review verification request' });
  } finally {
    client.release();
  }
}
