import { Response } from 'express';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';

export async function listCohorts(_req: AuthedRequest, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, birth_year, label
       FROM cohorts
       WHERE is_active = TRUE
       ORDER BY birth_year ASC`
    );
    res.json({ cohorts: result.rows });
  } catch (err) {
    console.error('List cohorts error:', err);
    res.status(500).json({ error: 'Failed to fetch cohorts' });
  }
}
