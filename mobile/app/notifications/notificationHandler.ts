import * as Notifications from 'expo-notifications';

type NotificationContent = {
  data?: Record<string, unknown>;
  title?: string | null;
  body?: string | null;
};

export type AlertNotificationInstruction = {
  kind: 'alert';
  alertId?: string;
  deviceId?: string;
  orgId?: string;
  severity?: string;
  alertType?: string;
  summary?: string;
  title?: string;
  body?: string;
};

export type NotificationInstruction =
  | AlertNotificationInstruction
  | {
      kind: 'test';
      source?: string;
      title?: string;
      body?: string;
    }
  | { kind: 'unknown' };

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function buildInstruction(content: NotificationContent): NotificationInstruction {
  const data = content.data ?? {};
  const title = asString(content.title ?? undefined);
  const body = asString(content.body ?? undefined);
  const type = asString((data as { type?: unknown }).type);
  const alertId = asString((data as { alertId?: unknown }).alertId ?? (data as { alert_id?: unknown }).alert_id);
  const deviceId = asString(
    (data as { deviceId?: unknown }).deviceId ?? (data as { device_id?: unknown }).device_id
  );
  const orgId = asString((data as { orgId?: unknown }).orgId ?? (data as { org_id?: unknown }).org_id);
  const severity = asString((data as { severity?: unknown }).severity);
  const alertType =
    asString((data as { alertType?: unknown }).alertType ?? (data as { alert_type?: unknown }).alert_type) ??
    (type === 'alert' ? undefined : type);
  const summary = asString((data as { summary?: unknown }).summary) ?? body;

  if (type === 'alert' || alertId || deviceId) {
    return {
      kind: 'alert',
      alertId,
      deviceId,
      orgId,
      severity,
      alertType,
      summary,
      title,
      body,
    };
  }

  if (type === 'test' || type === 'diagnostic') {
    return {
      kind: 'test',
      source: asString((data as { source?: unknown }).source),
      title,
      body,
    };
  }

  return { kind: 'unknown' };
}

export function handleNotificationReceived(notification: Notifications.Notification): NotificationInstruction {
  const content = notification?.request?.content ?? {};
  return buildInstruction({
    data: content.data,
    title: content.title,
    body: content.body,
  });
}

export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): NotificationInstruction {
  const content = response?.notification?.request?.content ?? {};
  return buildInstruction({
    data: content.data,
    title: content.title,
    body: content.body,
  });
}
