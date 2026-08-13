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

const getIncomingFriendRequestsQuery = `
  SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
         u.id AS requester_id, u.username AS requester_username
  FROM friend_requests fr
  JOIN users u ON u.id = fr.sender_id
  WHERE fr.receiver_id = $1 AND fr.status = 'pending'
  ORDER BY fr.created_at DESC
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

export async function getIncomingFriendRequests(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;

  const result = await pool.query(getIncomingFriendRequestsQuery, [userId]);

  const requests = result.rows.map(row => ({
    id: row.id,
    requester: {
      id: row.requester_id,
      username: row.requester_username,
    },
    status: row.status,
    created_at: row.created_at,
  }));

  return res.json({ requests });
}

const acceptFriendRequestQuery = `
  UPDATE friend_requests
  SET status = 'accepted',
      updated_at = now()
  WHERE receiver_id = $1 AND sender_id = $2 AND status = 'pending'
  RETURNING id, sender_id, receiver_id, status, updated_at
`;

export async function acceptFriendRequest(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const requestId = req.params.requestId;

  const result = await pool.query(
    `SELECT id, sender_id, receiver_id, status
     FROM friend_requests
     WHERE id = $1 AND receiver_id = $2`,
    [requestId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Friend request not found or does not belong to you' });
  }

  const request = result.rows[0];
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Friend request is no longer pending' });
  }

  try {
    const updateResult = await pool.query(acceptFriendRequestQuery, [userId, request.sender_id]);

    if (updateResult.rowCount === 0) {
      // Another transaction may have already accepted this request
      return res.status(400).json({ error: 'Friend request is no longer pending' });
    }

    const updatedRequest = updateResult.rows[0];
    return res.status(200).json({
      id: updatedRequest.id,
      sender_id: updatedRequest.sender_id,
      receiver_id: updatedRequest.receiver_id,
      status: updatedRequest.status,
      updated_at: updatedRequest.updated_at,
    });
  } catch (err: any) {
    console.error('Accept friend request error:', err);
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Friend request could not be accepted' });
    }
    return res.status(500).json({ error: 'Failed to accept friend request' });
  }
}

const rejectFriendRequestQuery = `
  UPDATE friend_requests
  SET status = 'rejected',
      updated_at = now()
  WHERE receiver_id = $1 AND sender_id = $2 AND status = 'pending'
  RETURNING id, sender_id, receiver_id, status, updated_at
`;

export async function rejectFriendRequest(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const requestId = req.params.requestId;

  const result = await pool.query(
    `SELECT id, sender_id, receiver_id, status
     FROM friend_requests
     WHERE id = $1 AND receiver_id = $2`,
    [requestId, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Friend request not found or does not belong to you' });
  }

  const request = result.rows[0];
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Friend request is no longer pending' });
  }

  try {
    const updateResult = await pool.query(rejectFriendRequestQuery, [userId, request.sender_id]);

    if (updateResult.rowCount === 0) {
      // Another transaction may have already rejected/accepted this request
      return res.status(400).json({ error: 'Friend request is no longer pending' });
    }

    const updatedRequest = updateResult.rows[0];
    return res.status(200).json({
      id: updatedRequest.id,
      sender_id: updatedRequest.sender_id,
      receiver_id: updatedRequest.receiver_id,
      status: updatedRequest.status,
      updated_at: updatedRequest.updated_at,
    });
  } catch (err: any) {
    console.error('Reject friend request error:', err);
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Friend request could not be rejected' });
    }
    return res.status(500).json({ error: 'Failed to reject friend request' });
  }
}

const getFriendsQuery = `
  SELECT DISTINCT u.id, u.username
  FROM users u
  WHERE u.id IN (
    SELECT fr.receiver_id FROM friend_requests fr WHERE fr.sender_id = $1 AND fr.status = 'accepted'
    UNION
    SELECT fr.sender_id FROM friend_requests fr WHERE fr.receiver_id = $1 AND fr.status = 'accepted'
  )
  AND u.id != $1
`;

export async function getFriends(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;

  const result = await pool.query(getFriendsQuery, [userId]);

  const friends = result.rows.map(row => ({
    id: row.id,
    username: row.username,
  }));

  return res.json({ friends });
}