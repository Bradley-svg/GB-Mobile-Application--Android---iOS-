import * as Notifications from 'expo-notifications';
import {
  handleNotificationReceived,
  handleNotificationResponse,
} from '../notifications/notificationHandler';

const buildNotification = (data: Record<string, unknown>): Notifications.Notification =>
  ({
    request: {
      content: {
        data,
        title: 'Alert title',
        body: 'Alert body',
      },
    },
  } as unknown as Notifications.Notification);

const buildResponse = (data: Record<string, unknown>): Notifications.NotificationResponse =>
  ({
    notification: buildNotification(data),
  } as unknown as Notifications.NotificationResponse);

describe('notificationHandler', () => {
  it('returns alert instructions with metadata', () => {
    const instruction = handleNotificationReceived(
      buildNotification({
        type: 'alert',
        alertId: 'alert-123',
        deviceId: 'device-456',
        orgId: 'org-1',
        alertType: 'offline',
        severity: 'critical',
        summary: 'Device offline',
      })
    );

    expect(instruction).toEqual(
      expect.objectContaining({
        kind: 'alert',
        alertId: 'alert-123',
        deviceId: 'device-456',
        orgId: 'org-1',
        alertType: 'offline',
        severity: 'critical',
        summary: 'Device offline',
        title: 'Alert title',
        body: 'Alert body',
      })
    );
  });

  it('returns test instructions', () => {
    const instruction = handleNotificationResponse(
      buildResponse({
        type: 'test',
        source: 'diagnostics',
      })
    );

    expect(instruction).toEqual(
      expect.objectContaining({
        kind: 'test',
        source: 'diagnostics',
        title: 'Alert title',
        body: 'Alert body',
      })
    );
  });

  it('falls back to unknown for other payloads', () => {
    const instruction = handleNotificationReceived(buildNotification({}));

    expect(instruction).toEqual({ kind: 'unknown' });
  });
});
