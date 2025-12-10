import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const registerPushTokenMock = vi.fn();
const sendTestNotificationMock = vi.fn();
const isPushFeatureDisabledMock = vi.fn();
const getActiveTokensForUserMock = vi.fn();
const getUserContextMock = vi.fn();

vi.mock('../../../modules/push/pushService', () => ({
  registerPushToken: (...args: unknown[]) => registerPushTokenMock(...args),
  sendTestNotification: (...args: unknown[]) => sendTestNotificationMock(...args),
  isPushFeatureDisabled: (...args: unknown[]) => isPushFeatureDisabledMock(...args),
}));

vi.mock('../../../modules/push/pushTokensRepository', () => ({
  getActiveTokensForUser: (...args: unknown[]) => getActiveTokensForUserMock(...args),
}));

vi.mock('../../../services/userService', () => ({
  getUserContext: (...args: unknown[]) => getUserContextMock(...args),
  requireOrganisationId: (user: { organisation_id: string | null }) => {
    if (!user.organisation_id) throw new Error('USER_ORG_MISSING');
    return user.organisation_id;
  },
}));

vi.mock('../../../middleware/requireAuth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const roleHeader = req.headers['x-test-role'];
    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
    req.user = { id: 'user-1', role: (role as string) || 'owner' };
    next();
  },
}));

// Prevent accidental DB access when importing the app in route tests.
vi.mock('../../../config/db', () => ({
  query: () => Promise.resolve({ rows: [], rowCount: 0 }),
}));

describe('push routes', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mod = await import('../../../index');
    app = mod.default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    isPushFeatureDisabledMock.mockReturnValue(false);
    getUserContextMock.mockResolvedValue({
      id: 'user-1',
      organisation_id: 'org-1',
      role: 'owner',
    });
    getActiveTokensForUserMock.mockResolvedValue([]);
    sendTestNotificationMock.mockResolvedValue({ attempted: 0, sent: 0, errors: [] });
  });

  it('registers push tokens via /me/push/register', async () => {
    registerPushTokenMock.mockResolvedValue({ ok: true });

    const res = await request(app)
      .post('/me/push/register')
      .send({ expoPushToken: 'ExpoToken-abc', platform: 'android' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(registerPushTokenMock).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
      token: 'ExpoToken-abc',
      platform: 'android',
    });
  });

  it('rejects invalid registration payloads', async () => {
    await request(app).post('/me/push/register').send({}).expect(400);
    expect(registerPushTokenMock).not.toHaveBeenCalled();
  });

  it('accepts contractor roles for registration', async () => {
    registerPushTokenMock.mockResolvedValue({ ok: true });

    const res = await request(app)
      .post('/me/push/register')
      .set('x-test-role', 'contractor')
      .send({ expoPushToken: 'ExpoToken-xyz', platform: 'ios' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(registerPushTokenMock).toHaveBeenCalled();
  });

  it('returns NO_PUSH_TOKENS_REGISTERED when none exist', async () => {
    getActiveTokensForUserMock.mockResolvedValue([]);

    const res = await request(app).post('/me/push/test').expect(404);

    expect(res.body.code).toBe('NO_PUSH_TOKENS_REGISTERED');
    expect(sendTestNotificationMock).not.toHaveBeenCalled();
  });

  it('returns PUSH_DISABLED when feature is disabled', async () => {
    isPushFeatureDisabledMock.mockReturnValue(true);

    const res = await request(app).post('/me/push/test').expect(503);

    expect(res.body.code).toBe('PUSH_DISABLED');
    expect(sendTestNotificationMock).not.toHaveBeenCalled();
  });

  it('sends test push when tokens exist', async () => {
    getActiveTokensForUserMock.mockResolvedValue([
      { expo_push_token: 'ExpoToken-123', is_active: true },
    ]);
    sendTestNotificationMock.mockResolvedValue({ attempted: 1, sent: 1, errors: [] });

    const res = await request(app).post('/me/push/test').expect(200);

    expect(sendTestNotificationMock).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      tokens: [{ expo_push_token: 'ExpoToken-123', is_active: true }],
    });
    expect(res.body.ok).toBe(true);
    expect(res.body.sent).toBe(1);
  });
});
