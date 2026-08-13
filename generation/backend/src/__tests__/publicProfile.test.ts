import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/pool';

const app = createApp();
const suffix = String(Date.now()).slice(-8);
const viewer = { phone: `+9185${suffix}`, username: `viewer${suffix}`, displayName: 'Viewer', dateOfBirth: '2006-04-12' };
const sameCohort = { phone: `+9186${suffix}`, username: `sameuser${suffix}`, displayName: 'Same Cohort', dateOfBirth: '2006-10-12' };
const incomingSender = { phone: `+9187${suffix}`, username: `sender${suffix}`, displayName: 'Incoming Sender', dateOfBirth: '2006-11-12' };
const otherCohort = { phone: `+9188${suffix}`, username: `otheruser${suffix}`, displayName: 'Other Cohort', dateOfBirth: '2007-04-12' };
const inactiveUser = { phone: `+9189${suffix}`, username: `inactive${suffix}`, displayName: 'Inactive User', dateOfBirth: '2006-04-12' };
const users = [viewer, sameCohort, incomingSender, otherCohort, inactiveUser];
let viewerToken = ''; let sameToken = ''; let incomingToken = ''; let otherToken = ''; let sameId = ''; let incomingRequestId = '';

async function register(user: typeof viewer) {
  const response = await request(app).post('/auth/register').send({ ...user, password: 'a-strong-password' });
  expect(response.status).toBe(201);
  return response.body;
}

describe('Other user profile APIs', () => {
  beforeAll(async () => {
    viewerToken = (await register(viewer)).token;
    const same = await register(sameCohort); sameToken = same.token; sameId = same.user.id;
    incomingToken = (await register(incomingSender)).token;
    otherToken = (await register(otherCohort)).token;
    await register(inactiveUser);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE phone = ANY($1::text[])', [users.map((user) => user.phone)]);
    await pool.end();
  });

  it('returns no friendship when no request exists', async () => {
    const response = await request(app).get(`/users/${sameCohort.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'none' });
  });

  it('returns outgoing pending and friends states from the database', async () => {
    expect((await request(app).post(`/users/${sameCohort.username}/friend-request`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(201);
    const pending = await request(app).get(`/users/${sameCohort.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`);
    expect(pending.body).toMatchObject({ status: 'outgoing_pending' });
    expect(pending.body.requestId).toEqual(expect.any(String));

    await pool.query("UPDATE friend_requests SET status = 'accepted', responded_at = now() WHERE id = $1", [pending.body.requestId]);
    const accepted = await request(app).get(`/users/${sameCohort.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`);
    expect(accepted.body).toEqual({ status: 'friends' });
  });

  it('returns incoming pending and protects accept/reject ownership', async () => {
    const sent = await request(app).post(`/users/${viewer.username}/friend-request`).set('Authorization', `Bearer ${incomingToken}`);
    expect(sent.status).toBe(201);
    incomingRequestId = sent.body.id;
    const incoming = await request(app).get(`/users/${incomingSender.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`);
    expect(incoming.body).toMatchObject({ status: 'incoming_pending', requestId: incomingRequestId });

    expect((await request(app).post(`/users/friend-requests/${incomingRequestId}/accept`).set('Authorization', `Bearer ${sameToken}`)).status).toBe(404);
    expect((await request(app).post(`/users/friend-requests/${incomingRequestId}/reject`).set('Authorization', `Bearer ${sameToken}`)).status).toBe(404);
    expect((await request(app).post(`/users/friend-requests/${incomingRequestId}/reject`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(200);
    const rejected = await request(app).get(`/users/${incomingSender.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`);
    expect(rejected.body).toEqual({ status: 'none' });
  });

  it('does not expose missing, inactive, or deleted users through relationship status', async () => {
    expect((await request(app).get('/users/missing_user/friendship-status').set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
    expect((await request(app).get('/posts/user/missing_user').set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
    await pool.query("UPDATE users SET account_status = 'suspended' WHERE phone = $1", [inactiveUser.phone]);
    expect((await request(app).get(`/users/${inactiveUser.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
    expect((await request(app).get(`/posts/user/${inactiveUser.username}`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
    await pool.query("UPDATE users SET account_status = 'active', deleted_at = now() WHERE phone = $1", [inactiveUser.phone]);
    expect((await request(app).get(`/users/${inactiveUser.username}/friendship-status`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
    expect((await request(app).get(`/posts/user/${inactiveUser.username}`).set('Authorization', `Bearer ${viewerToken}`)).status).toBe(404);
  });

  it('shows only active, non-deleted text posts to users in the same cohort', async () => {
    expect((await request(app).post('/posts').set('Authorization', `Bearer ${sameToken}`).send({ content: 'Visible same-cohort post' })).status).toBe(201);
    expect((await request(app).post('/posts').set('Authorization', `Bearer ${viewerToken}`).send({ content: 'A different author post' })).status).toBe(201);
    const cohort = await pool.query<{ cohort_id: string }>('SELECT cohort_id FROM cohort_members WHERE user_id = $1 AND is_primary = TRUE', [sameId]);
    await pool.query("INSERT INTO posts (author_id, cohort_id, type, body) VALUES ($1, $2, 'question', 'Not a text post'), ($1, $2, 'text', 'Deleted post')", [sameId, cohort.rows[0].cohort_id]);
    await pool.query("UPDATE posts SET deleted_at = now() WHERE author_id = $1 AND body = 'Deleted post'", [sameId]);

    const response = await request(app).get(`/posts/user/${sameCohort.username}`).set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('visible');
    expect(response.body.posts.map((post: { content: string }) => post.content)).toEqual(['Visible same-cohort post']);
    expect(response.body.posts[0].author).not.toHaveProperty('phone');
  });

  it('does not return posts across primary cohorts', async () => {
    expect((await request(app).post('/posts').set('Authorization', `Bearer ${otherToken}`).send({ content: 'Other-cohort post' })).status).toBe(201);
    const response = await request(app).get(`/posts/user/${otherCohort.username}`).set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ posts: [], visibility: 'limited_to_same_cohort' });
  });
});
