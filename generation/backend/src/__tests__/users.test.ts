import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/pool';

const app = createApp();
const suffix = String(Date.now()).slice(-9);
const first = { phone: `+91771${suffix}`, username: `member_${suffix}`, displayName: 'Search Member' };
const second = { phone: `+91772${suffix}`, username: `hidden_${suffix}`, displayName: 'Hidden Member' };
let firstToken = '';

async function register(user: typeof first, username = user.username) {
  return request(app).post('/auth/register').send({
    phone: user.phone,
    password: 'a-strong-password',
    displayName: user.displayName,
    username,
    dateOfBirth: '2006-05-14',
  });
}

describe('Username identity and search', () => {
  beforeAll(async () => {
    const response = await register(first, first.username.toUpperCase());
    expect(response.status).toBe(201);
    firstToken = response.body.token;
    expect(response.body.user.username).toBe(first.username);
    expect((await register(second)).status).toBe(201);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE phone = ANY($1::text[])', [[first.phone, second.phone]]);
    await pool.end();
  });

  it('keeps initial onboarding selection outside the change cooldown', async () => {
    const me = await request(app).get('/me').set('Authorization', `Bearer ${firstToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.last_username_change_at).toBeNull();

    const changed = await request(app).patch('/users/me/username').set('Authorization', `Bearer ${firstToken}`).send({ username: `renamed_${suffix}` });
    expect(changed.status).toBe(200);
    expect(changed.body.username).toBe(`renamed_${suffix}`);
    expect(changed.body.nextUsernameChangeAt).toEqual(expect.any(String));

    const again = await request(app).patch('/users/me/username').set('Authorization', `Bearer ${firstToken}`).send({ username: `another_${suffix}` });
    expect(again.status).toBe(409);
    expect(again.body.nextUsernameChangeAt).toEqual(expect.any(String));
  });

  it('enforces normalized uniqueness and reserved names', async () => {
    const duplicate = await register({ ...first, phone: `+91773${suffix}`, displayName: 'Duplicate' }, `RENAMED_${suffix}`);
    expect(duplicate.status).toBe(409);

    const reserved = await register({ ...first, phone: `+91774${suffix}`, displayName: 'Reserved' }, 'generation');
    expect(reserved.status).toBe(400);
  });

  it('returns only public information for exact username search', async () => {
    const response = await request(app).get(`/users/search?q=%40hidden_${suffix}`).set('Authorization', `Bearer ${firstToken}`);
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0]).toMatchObject({ username: second.username, displayName: second.displayName });
    expect(response.body.users[0].phone).toBeUndefined();
    expect(response.body.users[0].email).toBeUndefined();
  });

  it('does not expose suspended or deleted users through search', async () => {
    await pool.query("UPDATE users SET account_status = 'suspended' WHERE phone = $1", [second.phone]);
    const suspended = await request(app).get(`/users/search?q=${second.username}`).set('Authorization', `Bearer ${firstToken}`);
    expect(suspended.status).toBe(200);
    expect(suspended.body.users).toHaveLength(0);

    await pool.query("UPDATE users SET account_status = 'active', deleted_at = now() WHERE phone = $1", [second.phone]);
    const deleted = await request(app).get(`/users/search?q=${second.username}`).set('Authorization', `Bearer ${firstToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.users).toHaveLength(0);
  });
});
