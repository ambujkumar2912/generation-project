import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { AuthedRequest } from '../middleware/auth';

// Public profile — shown to other users. Deliberately excludes email,
// phone, and anything else that shouldn't be exposed platform-wide.
export async function getPublicProfile(req: AuthedRequest, res: Response) {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.user_id, p.display_name, p.bio, p.avatar_url,
              p.education_category, p.career_category, p.broad_location,
              p.interests, p.helpful_contributions_count
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1 AND u.deleted_at IS NULL AND u.account_status = 'active'`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const cohorts = await pool.query(
      `SELECT c.birth_year, c.label
       FROM cohort_members cm
       JOIN cohorts c ON c.id = cm.cohort_id
       WHERE cm.user_id = $1 AND cm.is_primary = TRUE`,
      [userId]
    );

    const communities = await pool.query(
      `SELECT c.id, c.slug, c.name
       FROM community_members cmem
       JOIN communities c ON c.id = cmem.community_id
       WHERE cmem.user_id = $1 AND c.deleted_at IS NULL
       ORDER BY cmem.joined_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({
      profile: result.rows[0],
      cohort: cohorts.rows[0] ?? null,
      communities: communities.rows,
    });
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  educationCategory: z.string().max(100).optional(),
  careerCategory: z.string().max(100).optional(),
  broadLocation: z.string().max(100).optional(),
  interests: z.array(z.string().max(40)).max(15).optional(),
});

export async function updateMyProfile(req: AuthedRequest, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = req.user!.userId;
  const updates = parsed.data;

  // Build a dynamic SET clause from only the fields the client sent,
  // so a partial update doesn't null out fields that weren't included.
  const columnMap: Record<string, string> = {
    displayName: 'display_name',
    bio: 'bio',
    educationCategory: 'education_category',
    careerCategory: 'career_category',
    broadLocation: 'broad_location',
    interests: 'interests',
  };

  const setClauses: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${columnMap[key]} = $${i}`);
    values.push(value);
    i++;
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(userId);

  try {
    const result = await pool.query(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE user_id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}
