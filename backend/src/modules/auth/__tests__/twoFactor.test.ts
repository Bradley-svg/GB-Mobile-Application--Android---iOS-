import type { Express } from 'express';
import request from 'supertest';
import { authenticator } from 'otplib';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../../../config/db';
import { resetAuthRateLimiter } from '../../../middleware/rateLimit';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore test helpers live outside src rootDir
import { resetTestDb } from '../../../../test/testDbSetup';

const FACILITIES_EMAIL = 'demo@example.com';
const OWNER_EMAIL = 'owner@example.com';
const PASSWORD = 'password123';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.AUTH_2FA_ENABLED = 'true';
  process.env.AUTH_2FA_ENFORCE_ROLES = 'owner,admin';
  process.env.AUTH_2FA_ISSUER = 'Greenbro';
  const mod = await import('../../../index');
  app = mod.default;
});

beforeEach(async () => {
  resetAuthRateLimiter();
  await resetTestDb();
});

async function login(email = FACILITIES_EMAIL, password = PASSWORD) {
  return request(app).post('/auth/login').send({ email, password });
}

async function enableTwoFactorForUser(userId: string, secret: string) {
  await query(
    `
    update users
    set two_factor_secret = $2, two_factor_enabled = true, two_factor_temp_secret = null
    where id = $1
  `,
    [userId, secret]
  );
}

describe('two-factor authentication flow', () => {
  it('provisions and confirms 2FA, then requires a challenge on login', async () => {
    const loginRes = await login(FACILITIES_EMAIL);
    expect(loginRes.status).toBe(200);
    const { accessToken } = loginRes.body;
    expect(accessToken).toBeTruthy();

    const setupRes = await request(app)
      .post('/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send()
      .expect(200);

    const secret = setupRes.body.secret as string;
    expect(secret).toBeTruthy();
    expect(setupRes.body.otpauthUrl).toContain(secret);

    const code = authenticator.generate(secret);
    await request(app)
      .post('/auth/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);

    const loginAfterEnable = await login(FACILITIES_EMAIL);
    expect(loginAfterEnable.status).toBe(200);
    expect(loginAfterEnable.body.requires2fa).toBe(true);
    const challengeToken = loginAfterEnable.body.challengeToken as string;
    expect(challengeToken).toBeTruthy();

    const code2 = authenticator.generate(secret);
    const finalLogin = await request(app)
      .post('/auth/login/2fa')
      .send({ challengeToken, code: code2 })
      .expect(200);

    expect(finalLogin.body.accessToken).toBeTruthy();
    expect(finalLogin.body.refreshToken).toBeTruthy();
    expect(finalLogin.body.user?.email).toBe(FACILITIES_EMAIL);
  });

  it('rejects invalid 2FA codes during login challenge', async () => {
    const loginRes = await login(FACILITIES_EMAIL);
    const accessToken = loginRes.body.accessToken as string;

    const setupRes = await request(app)
      .post('/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send()
      .expect(200);

    const secret = setupRes.body.secret as string;
    const code = authenticator.generate(secret);
    await request(app)
      .post('/auth/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);

    const challenge = await login(FACILITIES_EMAIL);
    const challengeToken = challenge.body.challengeToken as string;

    await request(app)
      .post('/auth/login/2fa')
      .send({ challengeToken, code: '000000' })
      .expect(401);
  });

  it('signals setup requirement for enforced roles without 2FA and challenges when enabled', async () => {
    const ownerLogin = await login(OWNER_EMAIL);
    expect(ownerLogin.status).toBe(200);
    expect(ownerLogin.body.twoFactorSetupRequired).toBe(true);

    const ownerIdResult = await query(`select id from users where email = $1`, [OWNER_EMAIL]);
    const ownerId = ownerIdResult.rows[0].id as string;
    const secret = authenticator.generateSecret();
    await enableTwoFactorForUser(ownerId, secret);

    const enforcedLogin = await login(OWNER_EMAIL);
    expect(enforcedLogin.status).toBe(200);
    expect(enforcedLogin.body.requires2fa).toBe(true);
    const challengeToken = enforcedLogin.body.challengeToken as string;
    const code = authenticator.generate(secret);

    const completed = await request(app)
      .post('/auth/login/2fa')
      .send({ challengeToken, code })
      .expect(200);
    expect(completed.body.accessToken).toBeTruthy();
  });
});
