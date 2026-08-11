import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/pool';

// NOTE: these tests require a real Postgres database reachable via
// DATABASE_URL, with migrations applied. Run `npm run migrate` first.
// A dedicated test database is strongly recommended over the dev DB.

const app = createApp();

const testPhone = `+919${String(Date.now()).slice(-9)}`;
let authToken = '';
let userId = '';

describe('Auth', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE phone = $1', [testPhone]);
    await pool.end();
  });

  it('rejects registration with a short password', async () => {
    const res = await request(app).post('/auth/register').send({
      phone: testPhone,
      password: '123',
      displayName: 'Test User',
      dateOfBirth: '2006-05-14',
    });
    expect(res.status).toBe(400);
  });

  it('registers a new user', async () => {
    const res = await request(app).post('/auth/register').send({
      phone: testPhone.replace('+91', '+91 '),
      password: 'a-strong-password',
      displayName: 'Test User',
      dateOfBirth: '2006-05-14',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.phone).toBe(testPhone);
    userId = res.body.user.id;
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/auth/register').send({
      phone: testPhone,
      password: 'another-password',
      displayName: 'Duplicate',
      dateOfBirth: '2005-01-01',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      phone: testPhone,
      password: 'a-strong-password',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('returns a private-safe public profile and updates only allowed fields', async () => {
    const publicProfile = await request(app)
      .get(`/profile/${userId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.profile.phone).toBeUndefined();
    expect(publicProfile.body.profile.date_of_birth).toBeUndefined();

    const updated = await request(app).patch('/profile').set('Authorization', `Bearer ${authToken}`).send({
      displayName: 'Updated User', bio: 'Building Generation', interests: ['AI', 'Coding'],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.display_name).toBe('Updated User');
  });

  it('rejects invalid or private profile changes', async () => {
    for (const payload of [
      { displayName: '' }, { bio: 'x'.repeat(501) }, { interests: [''] },
      { dateOfBirth: '2005-01-01' }, { phone: '+919999999999' }, { generation: '2005' },
    ]) {
      const res = await request(app).patch('/profile').set('Authorization', `Bearer ${authToken}`).send(payload);
      expect(res.status).toBe(400);
    }
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      phone: testPhone,
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('rejects an existing token after the account is suspended', async () => {
    await pool.query("UPDATE users SET account_status = 'suspended' WHERE phone = $1", [testPhone]);

    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(401);
  });

  it('does not allow a deleted account to log in by email', async () => {
    await pool.query(
      "UPDATE users SET account_status = 'active', deleted_at = now() WHERE phone = $1",
      [testPhone]
    );

    const res = await request(app).post('/auth/login').send({
      phone: testPhone,
      password: 'a-strong-password',
    });

    expect(res.status).toBe(401);
  });
});
