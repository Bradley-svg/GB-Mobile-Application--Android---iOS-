import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAuthRateLimiter } from '../src/middleware/rateLimit';
import { resetTestDb } from './testDbSetup';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'password123';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.AUTH_MAX_ATTEMPTS = '5';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  resetAuthRateLimiter();
  await resetTestDb();
});

async function login(email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken as string;
}

describe('/auth/me/push-tokens', () => {
  it('rejects invalid body', async () => {
    const accessToken = await login();

    await request(app)
      .post('/auth/me/push-tokens')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
  });
});

describe('/auth/signup', () => {
  it('blocks public signup by default', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'hunter22', name: 'New User' })
      .expect(403);

    expect(res.body).toEqual({ error: 'Signup disabled. Contact administrator.' });
  });
});

describe('/auth/request-password-reset', () => {
  it('responds with a generic success even when the email is unknown', async () => {
    const res = await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'missing@example.com' })
      .expect(200);

    expect(res.body).toEqual({ message: 'If an account exists, a reset link has been sent.' });
  });
});

describe('login rate limiting', () => {
  it('locks out after repeated failed attempts', async () => {
    const body = { email: DEMO_EMAIL, password: 'wrong-password' };

    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/login').send(body).expect(401);
    }

    await request(app).post('/auth/login').send(body).expect(429);
  });
});
