import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/pool';

// NOTE: these tests require a real Postgres database reachable via
// DATABASE_URL, with migrations applied. Run `npm run migrate` first.
// A dedicated test database is strongly recommended over the dev DB.

const app = createApp();

const testEmail = `test_${Date.now()}@example.com`;

describe('Auth', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
    await pool.end();
  });

  it('rejects registration with a short password', async () => {
    const res = await request(app).post('/auth/register').send({
      email: testEmail,
      password: '123',
      displayName: 'Test User',
    });
    expect(res.status).toBe(400);
  });

  it('registers a new user', async () => {
    const res = await request(app).post('/auth/register').send({
      email: testEmail,
      password: 'a-strong-password',
      displayName: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/auth/register').send({
      email: testEmail,
      password: 'another-password',
      displayName: 'Duplicate',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: testEmail,
      password: 'a-strong-password',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: testEmail,
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });
});
