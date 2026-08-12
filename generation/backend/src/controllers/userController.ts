import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';
import { normalizeUsername, normalizeUsernameSearch } from '../utils/username';

const updateUsernameSchema = z.object({ username: z.string().min(1).max(64) }).strict();
const searchSchema = z.object({ q: z.string().min(1).max(21) });

function nextChangeAt(value: Date | string | null) { return value ? new Date(new Date(value).setMonth(new Date(value).getMonth() + 6)).toISOString() : null; }
function publicUser(row: any) { return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, bio: row.bio, interests: row.interests ?? [], generation: row.birth_year ? { birthYear: row.birth_year, label: row.label } : null }; }
const publicSelect = `SELECT u.id, u.username, p.display_name, p.avatar_url, p.bio, p.interests, c.birth_year, c.label
  FROM users u JOIN profiles p ON p.user_id = u.id
  LEFT JOIN cohort_members cm ON cm.user_id = u.id AND cm.is_primary = TRUE
  LEFT JOIN cohorts c ON c.id = cm.cohort_id
  WHERE u.account_status = 'active' AND u.deleted_at IS NULL`;

export async function updateMyUsername(req: AuthedRequest, res: Response) {
  const parsed = updateUsernameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const username = normalizeUsername(parsed.data.username);
  if (!username) return res.status(400).json({ error: 'Username must be 6–20 lowercase letters, numbers, or underscores and cannot be reserved' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ username: string | null; last_username_change_at: Date | null }>('SELECT username, last_username_change_at FROM users WHERE id = $1 FOR UPDATE', [req.user!.userId]);
    if (!current.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    const user = current.rows[0];
    if (user.username === username) { await client.query('ROLLBACK'); return res.json({ username, nextUsernameChangeAt: nextChangeAt(user.last_username_change_at) }); }
    const next = nextChangeAt(user.last_username_change_at);
    if (next && new Date(next) > new Date()) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Username can only be changed once every 6 months', nextUsernameChangeAt: next }); }
    const isInitial = user.username === null;
    const result = await client.query(
      `UPDATE users SET username = $1, username_initialized_at = COALESCE(username_initialized_at, now()),
       last_username_change_at = CASE WHEN $2 THEN last_username_change_at ELSE now() END WHERE id = $3 RETURNING username, last_username_change_at`,
      [username, isInitial, req.user!.userId]
    );
    await client.query('COMMIT');
    return res.json({ username: result.rows[0].username, nextUsernameChangeAt: nextChangeAt(result.rows[0].last_username_change_at) });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    console.error('Update username error:', err); return res.status(500).json({ error: 'Failed to update username' });
  } finally { client.release(); }
}

export async function searchUsers(req: AuthedRequest, res: Response) {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const username = normalizeUsernameSearch(parsed.data.q);
  if (!username) return res.status(400).json({ error: 'Enter a valid username search' });
  try {
    const result = await pool.query(`${publicSelect} AND u.username = $1 LIMIT 10`, [username]);
    return res.json({ users: result.rows.map(publicUser) });
  } catch (err) { console.error('Search users error:', err); return res.status(500).json({ error: 'Failed to search users' }); }
}

export async function getUserByUsername(req: AuthedRequest, res: Response) {
  const username = normalizeUsernameSearch(req.params.username);
  if (!username) return res.status(404).json({ error: 'User not found' });
  try {
    const result = await pool.query(`${publicSelect} AND u.username = $1 LIMIT 1`, [username]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (err) { console.error('Get user by username error:', err); return res.status(500).json({ error: 'Failed to fetch user' }); }
}
