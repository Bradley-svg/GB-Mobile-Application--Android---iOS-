import { createHash } from 'crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../config/logger';
import { query } from '../../../config/db';
import { resetAuthRateLimiter } from '../../../middleware/rateLimit';
import { resetTestDb } from '../../../../test/testDbSetup';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.PASSWORD_RESET_TOKEN_MINUTES = '5';
  const mod = await import('../../../index');
  app = mod.default;
});

beforeEach(async () => {
  resetAuthRateLimiter();
  await resetTestDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function extractTokenFromLogs(infoSpy: ReturnType<typeof vi.spyOn>) {
  for (const call of infoSpy.mock.calls) {
    const [payload, message] = call;
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'resetToken' in (payload as Record<string, unknown>) &&
      typeof (payload as Record<string, unknown>).resetToken === 'string' &&
      typeof message === 'string' &&
      message.includes('password reset token')
    ) {
      return (payload as { resetToken: string }).resetToken;
    }
  }
  return null;
}

describe('password reset flow', () => {
  it('allows requesting and consuming a password reset token once', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'demo@example.com' })
      .expect(200);

    const token = extractTokenFromLogs(infoSpy);
    expect(token).toBeTruthy();

    await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'newPassword123!' })
      .expect(200);

    // Token is single use
    await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'anotherPassword123!' })
      .expect(400);

    // Old password should no longer work; new password should
    await request(app)
      .post('/auth/login')
      .send({ email: 'demo@example.com', password: 'password123' })
      .expect(401);

    await request(app)
      .post('/auth/login')
      .send({ email: 'demo@example.com', password: 'newPassword123!' })
      .expect(200);
  });

  it('rejects expired or invalid reset tokens', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email: 'demo@example.com' })
      .expect(200);

    const token = extractTokenFromLogs(infoSpy);
    expect(token).toBeTruthy();

    const tokenHash = createHash('sha256').update(token || '').digest('hex');
    await query(`update password_reset_tokens set expires_at = now() - interval '5 minutes' where token_hash = $1`, [
      tokenHash,
    ]);

    await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'anotherPass123!' })
      .expect(400);

    await request(app)
      .post('/auth/reset-password')
      .send({ token: 'totally-invalid-token', password: 'anotherPass123!' })
      .expect(400);
  });
});
