import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAuthToken } from '../utils/jwt';
import { normalizePhoneNumber } from '../utils/phone';

const registerSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  password: z.string(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
});
const phoneCheckSchema = z.object({ phone: z.string().min(1) });

function parseDateOfBirth(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date > new Date()) return null;
  return date;
}

export async function checkPhoneAccount(req: Request, res: Response) {
  const parsed = phoneCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const phone = normalizePhoneNumber(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number with country code' });
  try {
    const result = await pool.query('SELECT 1 FROM users WHERE phone = $1 AND deleted_at IS NULL', [phone]);
    return res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error('Phone account check error:', err);
    return res.status(500).json({ error: 'Unable to check phone number' });
  }
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { password, displayName, dateOfBirth } = parsed.data;
  const phone = normalizePhoneNumber(parsed.data.phone);
  const dob = parseDateOfBirth(dateOfBirth);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number with country code' });
  if (!dob) return res.status(400).json({ error: 'Enter a real date of birth that is not in the future' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM users WHERE phone = $1', [phone]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email or phone already exists' });
    }

    const passwordHash = await hashPassword(password);

    const userResult = await client.query(
      `INSERT INTO users (phone, password_hash, date_of_birth)
       VALUES ($1, $2, $3) RETURNING id, phone, created_at`,
      [phone, passwordHash, dateOfBirth]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)`,
      [user.id, displayName]
    );
    const year = dob.getUTCFullYear();
    await client.query(`INSERT INTO cohorts (birth_year, label, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (birth_year) DO NOTHING`, [year, `${year} Generation`]);
    const cohort = await client.query('SELECT id FROM cohorts WHERE birth_year = $1', [year]);
    await client.query('INSERT INTO cohort_members (user_id, cohort_id, is_primary) VALUES ($1, $2, TRUE)', [user.id, cohort.rows[0].id]);

    await client.query('COMMIT');

    const token = signAuthToken({ userId: user.id, isAdmin: false });
    return res.status(201).json({
      token,
      user: { id: user.id, phone: user.phone, displayName },
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
  const { email, password } = parsed.data;
  const phone = parsed.data.phone ? normalizePhoneNumber(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return res.status(400).json({ error: 'Enter a valid phone number with country code' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.password_hash, u.is_admin, u.account_status, p.display_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE ((u.email = $1 AND $1 IS NOT NULL) OR (u.phone = $2 AND $2 IS NOT NULL))
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
