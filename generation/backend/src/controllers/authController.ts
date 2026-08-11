import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAuthToken } from '../utils/jwt';

const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(80),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, phone, password, displayName } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM users WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL)',
      [email ?? null, phone ?? null]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email or phone already exists' });
    }

    const passwordHash = await hashPassword(password);

    const userResult = await client.query(
      `INSERT INTO users (email, phone, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, phone, created_at`,
      [email ?? null, phone ?? null, passwordHash]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)`,
      [user.id, displayName]
    );

    await client.query('COMMIT');

    const token = signAuthToken({ userId: user.id, isAdmin: false });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, phone: user.phone, displayName },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to register' });
  } finally {
    client.release();
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, phone, password } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT u.id, u.password_hash, u.is_admin, u.account_status, p.display_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE (u.email = $1 AND $1 IS NOT NULL) OR (u.phone = $2 AND $2 IS NOT NULL)
       AND u.deleted_at IS NULL`,
      [email ?? null, phone ?? null]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.account_status === 'banned' || user.account_status === 'suspended') {
      return res.status(403).json({ error: `Account is ${user.account_status}` });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const token = signAuthToken({ userId: user.id, isAdmin: user.is_admin });
    return res.json({
      token,
      user: { id: user.id, displayName: user.display_name, isAdmin: user.is_admin },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
}
