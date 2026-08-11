import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/jwt';
import { pool } from '../db/pool';

export interface AuthedRequest extends Request {
  user?: { userId: string; isAdmin: boolean };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAuthToken(token);

    // JWTs are stateless, so re-check account status and admin access here.
    // This makes bans, suspensions, deletions, and admin-role changes effective
    // immediately instead of waiting for an existing token to expire.
    const result = await pool.query<{ is_admin: boolean }>(
      `SELECT is_admin
       FROM users
       WHERE id = $1 AND account_status = 'active' AND deleted_at IS NULL`,
      [payload.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account is no longer active' });
    }

    req.user = { userId: payload.userId, isAdmin: result.rows[0].is_admin };
    next();
  } catch (err) {
    if (err instanceof Error && err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
      return next(err);
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
