import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../../../config/db';
import { resetAuthRateLimiter } from '../../../middleware/rateLimit';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore test helpers live outside src rootDir
import { resetTestDb } from '../../../../test/testDbSetup';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'password123';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.AUTH_MAX_ATTEMPTS = '5';
  const mod = await import('../../../index');
  app = mod.default;
});

beforeEach(async () => {
  resetAuthRateLimiter();
  await resetTestDb();
});

async function login() {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

describe('refresh token rotation', () => {
  it('rotates refresh tokens and revokes the old session', async () => {
    const initial = await login();
    const initialSessionId = (jwt.decode(initial.refreshToken) as { jti?: string } | null)?.jti;
    expect(initialSessionId).toBeTruthy();

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: initial.refreshToken })
      .expect(200);

    const nextRefreshToken = refreshed.body.refreshToken as string;
    const nextSessionId = (jwt.decode(nextRefreshToken) as { jti?: string } | null)?.jti;
    expect(nextSessionId).toBeTruthy();
    expect(nextSessionId).not.toBe(initialSessionId);

    await request(app).post('/auth/refresh').send({ refreshToken: initial.refreshToken }).expect(401);

    const sessions = await query(
      `
        select id, revoked_at, replaced_by
        from auth_sessions
        where id in ($1, $2)
      `,
      [initialSessionId, nextSessionId]
    );
    const sessionMap = Object.fromEntries(sessions.rows.map((row) => [row.id, row]));

    expect(sessionMap[initialSessionId!].revoked_at).not.toBeNull();
    expect(sessionMap[initialSessionId!].replaced_by).toBe(nextSessionId);
    expect(sessionMap[nextSessionId!].revoked_at).toBeNull();
  });

  it('revokes the active session on logout', async () => {
    const { accessToken, refreshToken } = await login();
    const sessionId = (jwt.decode(refreshToken) as { jti?: string } | null)?.jti;
    expect(sessionId).toBeTruthy();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(204);

    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);

    const sessionRow = await query(
      `select revoked_at from auth_sessions where id = $1`,
      [sessionId]
    );
    expect(sessionRow.rows[0].revoked_at).not.toBeNull();
  });
});
