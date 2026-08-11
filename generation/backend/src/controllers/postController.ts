import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';

const createPostSchema = z.object({ content: z.string().trim().min(1).max(2000) }).strict();
const feedQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(15), cursor: z.string().optional() });

type Cursor = { createdAt: string; id: string };
function encodeCursor(cursor: Cursor): string { return Buffer.from(JSON.stringify(cursor)).toString('base64url'); }
function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).safeParse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
async function getPrimaryCohortId(userId: string): Promise<string | null> {
  const result = await pool.query<{ cohort_id: string }>(
    `SELECT cm.cohort_id FROM cohort_members cm JOIN cohorts c ON c.id = cm.cohort_id
     WHERE cm.user_id = $1 AND cm.is_primary = TRUE AND c.is_active = TRUE LIMIT 1`, [userId]
  );
  return result.rows[0]?.cohort_id ?? null;
}
function toPost(row: any) {
  return { id: row.id, content: row.body, createdAt: row.created_at, updatedAt: row.updated_at, cohortId: row.cohort_id,
    author: { id: row.author_id, displayName: row.display_name, avatarUrl: row.avatar_url } };
}

export async function createTextPost(req: AuthedRequest, res: Response) {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const cohortId = await getPrimaryCohortId(req.user!.userId);
    if (!cohortId) return res.status(403).json({ error: 'Generation membership is required to create a post' });
    const result = await pool.query(
      `INSERT INTO posts (author_id, cohort_id, type, body)
       VALUES ($1, $2, 'text', $3)
       RETURNING id, author_id, cohort_id, body, created_at, updated_at`,
      [req.user!.userId, cohortId, parsed.data.content]
    );
    const profile = await pool.query<{ display_name: string; avatar_url: string | null }>('SELECT display_name, avatar_url FROM profiles WHERE user_id = $1', [req.user!.userId]);
    return res.status(201).json({ post: { ...toPost(result.rows[0]), author: { id: req.user!.userId, displayName: profile.rows[0].display_name, avatarUrl: profile.rows[0].avatar_url } } });
  } catch (err) { console.error('Create post error:', err); return res.status(500).json({ error: 'Failed to create post' }); }
}

export async function getGenerationFeed(req: AuthedRequest, res: Response) {
  const parsed = feedQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) return res.status(400).json({ error: 'Invalid feed cursor' });
  try {
    const cohortId = await getPrimaryCohortId(req.user!.userId);
    if (!cohortId) return res.status(403).json({ error: 'Generation membership is required to view this feed' });
    const params: unknown[] = [cohortId];
    let cursorFilter = '';
    if (cursor) { params.push(cursor.createdAt, cursor.id); cursorFilter = 'AND (p.created_at, p.id) < ($2::timestamptz, $3::uuid)'; }
    params.push(parsed.data.limit + 1);
    const result = await pool.query(
      `SELECT p.id, p.author_id, p.cohort_id, p.body, p.created_at, p.updated_at, pr.display_name, pr.avatar_url
       FROM posts p JOIN users u ON u.id = p.author_id JOIN profiles pr ON pr.user_id = p.author_id
       WHERE p.cohort_id = $1 AND p.type = 'text' AND p.deleted_at IS NULL
         AND u.account_status = 'active' AND u.deleted_at IS NULL ${cursorFilter}
       ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length}`,
      params
    );
    const hasMore = result.rows.length > parsed.data.limit;
    const rows = hasMore ? result.rows.slice(0, -1) : result.rows;
    const last = rows[rows.length - 1];
    return res.json({ posts: rows.map(toPost), nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id }) : null });
  } catch (err) { console.error('Get generation feed error:', err); return res.status(500).json({ error: 'Failed to fetch feed' }); }
}
