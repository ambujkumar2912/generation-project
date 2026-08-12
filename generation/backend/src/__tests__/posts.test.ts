import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/pool';

const app = createApp();
const suffix = String(Date.now()).slice(-8);
const users = [
  { phone: `+9181${suffix}`, dateOfBirth: '1999-04-12', displayName: 'Post Author', username: `postauthor${suffix}` },
  { phone: `+9182${suffix}`, dateOfBirth: '1999-11-05', displayName: 'Same Cohort', username: `samecohort${suffix}` },
  { phone: `+9183${suffix}`, dateOfBirth: '2000-03-19', displayName: 'Other Cohort', username: `othercohort${suffix}` },
];
let authorToken = ''; let sameCohortToken = ''; let otherCohortToken = '';

async function register(user: typeof users[number]) {
  const response = await request(app).post('/auth/register').send({ ...user, password: 'a-strong-password' });
  expect(response.status).toBe(201);
  return response.body.token as string;
}

describe('Generation text posts', () => {
  beforeAll(async () => {
    authorToken = await register(users[0]);
    sameCohortToken = await register(users[1]);
    otherCohortToken = await register(users[2]);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE phone = ANY($1::text[])', [users.map((user) => user.phone)]);
    await pool.end();
  });

  it('creates a trimmed text post in the authenticated user’s cohort', async () => {
    const response = await request(app).post('/posts').set('Authorization', `Bearer ${authorToken}`).send({ content: '  Hello, generation!  ' });
    expect(response.status).toBe(201);
    expect(response.body.post.content).toBe('Hello, generation!');
    expect(response.body.post.author.displayName).toBe('Post Author');
  });

  it('rejects empty, oversized, and client-controlled post metadata', async () => {
    for (const payload of [
      { content: '   ' }, { content: 'x'.repeat(2001) }, { content: 'No client cohort', cohortId: '00000000-0000-0000-0000-000000000000' },
    ]) {
      const response = await request(app).post('/posts').set('Authorization', `Bearer ${authorToken}`).send(payload);
      expect(response.status).toBe(400);
    }
  });

  it('shows posts only to the same Generation', async () => {
    const sameGeneration = await request(app).get('/posts').set('Authorization', `Bearer ${sameCohortToken}`);
    expect(sameGeneration.status).toBe(200);
    expect(sameGeneration.body.posts.some((post: { content: string }) => post.content === 'Hello, generation!')).toBe(true);

    const otherGeneration = await request(app).get('/posts').set('Authorization', `Bearer ${otherCohortToken}`);
    expect(otherGeneration.status).toBe(200);
    expect(otherGeneration.body.posts).toHaveLength(0);
  });

  it('paginates with an opaque cursor', async () => {
    for (const content of ['Pagination post one', 'Pagination post two', 'Pagination post three']) {
      const created = await request(app).post('/posts').set('Authorization', `Bearer ${authorToken}`).send({ content });
      expect(created.status).toBe(201);
    }
    const firstPage = await request(app).get('/posts?limit=2').set('Authorization', `Bearer ${authorToken}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.posts).toHaveLength(2);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));
    const secondPage = await request(app).get(`/posts?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`).set('Authorization', `Bearer ${authorToken}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.posts.length).toBeGreaterThanOrEqual(2);
    expect(secondPage.body.posts.every((post: { id: string }) => !firstPage.body.posts.some((first: { id: string }) => first.id === post.id))).toBe(true);
  });

  it('blocks a suspended account with an existing token from posting', async () => {
    await pool.query("UPDATE users SET account_status = 'suspended' WHERE phone = $1", [users[0].phone]);
    const response = await request(app).post('/posts').set('Authorization', `Bearer ${authorToken}`).send({ content: 'This must not be created' });
    expect(response.status).toBe(401);
  });
});
