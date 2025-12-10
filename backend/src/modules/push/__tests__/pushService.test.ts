import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAlertNotification, sendTestNotification } from '../pushService';
import type { AlertRow } from '../../../repositories/alertsRepository';

const sendExpoPushMessagesMock = vi.fn();
const getOrgMock = vi.fn();
const getUsersByRolesMock = vi.fn();
const getTokensMock = vi.fn();
const recordAuditEventMock = vi.fn();

vi.mock('../expoPushClient', () => ({
  isExpoPushToken: (token: string) => token.startsWith('ExpoToken'),
  sendExpoPushMessages: (...args: unknown[]) => sendExpoPushMessagesMock(...args),
}));

vi.mock('../pushTokensRepository', () => ({
  getActiveTokensForOrg: (...args: unknown[]) => getTokensMock(...args),
  getLatestActiveToken: vi.fn(),
  getActiveTokensForUser: vi.fn(),
  upsertPushToken: vi.fn(),
  deactivatePushToken: vi.fn(),
}));

vi.mock('../../audit/auditService', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args),
}));

vi.mock('../../../repositories/alertsRepository', () => ({
  getOrganisationIdForAlert: (...args: unknown[]) => getOrgMock(...args),
}));

vi.mock('../../../repositories/usersRepository', () => ({
  getUsersByRoles: (...args: unknown[]) => getUsersByRolesMock(...args),
}));

const baseAlert: AlertRow = {
  id: 'alert-1',
  site_id: 'site-1',
  device_id: 'device-1',
  severity: 'critical',
  type: 'offline',
  message: 'Device offline',
  status: 'active',
  first_seen_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  acknowledged_by: null,
  acknowledged_at: null,
  muted_until: null,
  rule_id: null,
};

describe('pushService.sendAlertNotification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, EXPO_ACCESS_TOKEN: 'expo-token', PUSH_NOTIFICATIONS_DISABLED: 'false' };
    getOrgMock.mockResolvedValue('org-1');
    getUsersByRolesMock.mockResolvedValue([{ id: 'user-1', role: 'owner', email: 'a@example.com', name: 'Owner' }]);
    getTokensMock.mockResolvedValue([
      {
        id: 'token-1',
        user_id: 'user-1',
        org_id: 'org-1',
        expo_push_token: 'ExpoToken-123',
        platform: 'android',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      },
    ]);
    sendExpoPushMessagesMock.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
  });

  it('skips when push is disabled', async () => {
    process.env.PUSH_NOTIFICATIONS_DISABLED = 'true';

    await sendAlertNotification({ alert: baseAlert });

    expect(sendExpoPushMessagesMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'push_notification_sent',
        metadata: expect.objectContaining({ reason: 'disabled', success: false }),
      })
    );
  });

  it('sends push for critical alerts', async () => {
    const result = await sendAlertNotification({ alert: baseAlert });

    expect(getUsersByRolesMock).toHaveBeenCalledWith('org-1', ['owner', 'admin', 'facilities']);
    expect(getTokensMock).toHaveBeenCalledWith('org-1', ['user-1']);
    expect(sendExpoPushMessagesMock).toHaveBeenCalledTimes(1);
    expect(sendExpoPushMessagesMock.mock.calls[0][0]).toHaveLength(1);
    expect(result?.sent).toBe(1);
  });

  it('includes navigation metadata in alert payloads', async () => {
    await sendAlertNotification({ alert: baseAlert });

    const sentMessages = sendExpoPushMessagesMock.mock.calls[0][0];
    expect(sentMessages[0].data).toEqual(
      expect.objectContaining({
        type: 'alert',
        alertId: baseAlert.id,
        deviceId: baseAlert.device_id,
        siteId: baseAlert.site_id,
        orgId: 'org-1',
        severity: baseAlert.severity,
        alertType: baseAlert.type,
        summary: baseAlert.message,
      })
    );
  });

  it('skips non-eligible severities', async () => {
    await sendAlertNotification({ alert: { ...baseAlert, severity: 'warning' } });

    expect(sendExpoPushMessagesMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it('handles push send failures gracefully', async () => {
    sendExpoPushMessagesMock.mockRejectedValueOnce(new Error('network down'));

    await expect(sendAlertNotification({ alert: baseAlert })).resolves.toBeDefined();

    expect(sendExpoPushMessagesMock).toHaveBeenCalled();
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'push_notification_sent',
        metadata: expect.objectContaining({ success: false }),
      })
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });
});

describe('pushService.sendTestNotification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, EXPO_ACCESS_TOKEN: 'expo-token', PUSH_NOTIFICATIONS_DISABLED: 'false' };
    sendExpoPushMessagesMock.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
  });

  it('sends test notifications with test metadata', async () => {
    await sendTestNotification({
      orgId: 'org-1',
      userId: 'user-1',
      tokens: [
        {
          id: 'token-1',
          user_id: 'user-1',
          org_id: 'org-1',
          expo_push_token: 'ExpoToken-abc',
          platform: 'android',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
      ],
    });

    expect(sendExpoPushMessagesMock).toHaveBeenCalled();
    const sentMessages = sendExpoPushMessagesMock.mock.calls[0][0];
    expect(sentMessages[0].data).toEqual(
      expect.objectContaining({
        type: 'test',
        source: 'diagnostics',
        userId: 'user-1',
      })
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });
});
