import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAlertNotification } from '../src/services/pushService';
import type { AlertRow } from '../src/services/alertService';

const queryMock = vi.fn();
const sendPushNotificationsAsync = vi.fn(async () => []);
const chunkPushNotifications = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('expo-server-sdk', () => {
  const ExpoMock = vi.fn().mockImplementation(() => ({
    chunkPushNotifications: (messages: any[]) => {
      chunkPushNotifications(messages);
      return [messages];
    },
    sendPushNotificationsAsync: (chunk: any[]) => sendPushNotificationsAsync(chunk),
  }));
  ExpoMock.isExpoPushToken = (token: string) => token.startsWith('ExpoToken');

  return {
    Expo: ExpoMock,
  };
});

const alert: AlertRow = {
  id: '00000000-0000-0000-0000-0000000000aa',
  site_id: '00000000-0000-0000-0000-0000000000a1',
  device_id: '00000000-0000-0000-0000-0000000000d1',
  severity: 'critical',
  type: 'offline',
  message: 'Offline',
  status: 'active',
  first_seen_at: '2025-01-01T00:00:00.000Z',
  last_seen_at: '2025-01-01T00:00:00.000Z',
  acknowledged_by: null,
  acknowledged_at: null,
  muted_until: null,
};

beforeEach(() => {
  queryMock.mockReset();
  sendPushNotificationsAsync.mockReset();
  chunkPushNotifications.mockReset();
});

describe('pushService', () => {
  it('sends critical alerts only to tokens in the same organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from alerts a')) {
        expect(params).toEqual([alert.id]);
        return { rows: [{ organisation_id: 'org-x' }], rowCount: 1 };
      }

      if (text.includes('from push_tokens') && text.includes('organisation_id')) {
        expect(params).toEqual(['org-x']);
        return {
          rows: [
            { expo_token: 'ExpoToken-org-x-1' },
            { expo_token: 'ExpoToken-org-x-2' },
          ],
          rowCount: 2,
        };
      }

      if (text.includes('from push_tokens')) {
        // Would indicate an unscoped token query
        return {
          rows: [
            { expo_token: 'ExpoToken-org-x-1' },
            { expo_token: 'ExpoToken-org-x-2' },
            { expo_token: 'ExpoToken-org-y-1' },
          ],
          rowCount: 3,
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    await sendAlertNotification(alert);

    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    const sentMessages = sendPushNotificationsAsync.mock.calls[0][0];
    expect(sentMessages.map((m: any) => m.to)).toEqual([
      'ExpoToken-org-x-1',
      'ExpoToken-org-x-2',
    ]);
    expect(sentMessages.map((m: any) => m.to)).not.toContain('ExpoToken-org-y-1');
  });

  it('skips sending when no organisation is resolved', async () => {
    queryMock.mockImplementation((text: string) => {
      if (text.includes('from alerts a')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected query: ${text}`);
    });

    await sendAlertNotification(alert);

    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(chunkPushNotifications).not.toHaveBeenCalled();
  });
});
