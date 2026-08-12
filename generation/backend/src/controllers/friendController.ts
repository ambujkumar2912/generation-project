import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';
import { normalizeUsernameSearch } from '../utils/username';

const DEBUG = true;

const checkExistingRequestQuery = `
  SELECT id, status
  FROM friend_requests
  WHERE (sender_id = $1 AND receiver_id = $2)
     OR (sender_id = $2 AND receiver_id = $1)
  LIMIT 1
`;

export async function sendFriendRequest(req: AuthedRequest, res: Response) {
  const requesterId = req.user!.userId;
  const recipientUsername = req.params.username;

  // 1. Normalize recipient username
  const normalized = normalizeUsernameSearch(recipientUsername);
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid username format' });
  }

  if (DEBUG) {
    console.log('[FriendDebug] raw username:', recipientUsername);
    console.log('[FriendDebug] normalized username:', normalized);
  }

  // 2. Resolve recipient user by username
  // Reuse the existing publicSelect pattern from userController
  const publicSelect = `
    SELECT u.id, u.username, u.account_status, u.deleted_at
    FROM users u
    WHERE u.username = $1 AND u.account_status = 'active' AND u.deleted_at IS NULL
  `;

  const recipientResult = await pool.query(publicSelect, [normalized]);
  if (!recipientResult.rows[0]) {
    if (DEBUG) { console.log('[FriendDebug] recipient lookup: NOT_FOUND'); }
    return res.status(404).json({ error: 'User not found' });
  } else {
    if (DEBUG) { console.log('[FriendDebug] recipient lookup: FOUND'); }
  }

  const recipient = recipientResult.rows[0];

  // 3. Self-request check
  if (recipient.id === requesterId) {
    return res.status(400).json({ error: 'Cannot add yourself' });
  }

  // 4. Check for existing requests in BOTH directions
  // The DB UNIQUE constraint only prevents same-direction duplicates,
  // so we must check both directions in the application logic.
  const existingRequest = await pool.query(checkExistingRequestQuery, [requesterId, recipient.id]);

  if (existingRequest.rows.length > 0) {
    // Either direction already has a pending (or other) request
    return res.status(409).json({ error: 'Friend request already exists in that direction' });
  }

  // 5. Create the friend request
  const createdAt = new Date();
  try {
    const result = await pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4)
      RETURNING id, sender_id, receiver_id, status, created_at, updated_at`,
      [requesterId, recipient.id, createdAt, createdAt]
    );

    const newRequest = result.rows[0];
    return res.status(201).json({
      id: newRequest.id,
      sender_id: newRequest.sender_id,
      receiver_id: newRequest.receiver_id,
      status: newRequest.status,
      created_at: newRequest.created_at,
    });
  } catch (err: any) {
    // Database UNIQUE constraint violation — protect against race conditions
    if (err?.code === '23505') {
      // Check if it's a same-direction duplicate
      return res.status(409).json({ error: 'Friend request already exists' });
    }
    console.error('Send friend request error:', err);
    return res.status(500).json({ error: 'Failed to send friend request' });
  }
}