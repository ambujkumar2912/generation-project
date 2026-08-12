import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';

export async function getMe(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.phone, u.username, u.last_username_change_at, u.is_admin, u.created_at,
              p.display_name, p.bio, p.avatar_url, p.interests
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cohorts = await pool.query(
      `SELECT c.id, c.birth_year, c.label, cm.is_primary
       FROM cohort_members cm
       JOIN cohorts c ON c.id = cm.cohort_id
       WHERE cm.user_id = $1`,
      [userId]
    );

    res.json({ user: result.rows[0], verifiedCohorts: cohorts.rows });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}
