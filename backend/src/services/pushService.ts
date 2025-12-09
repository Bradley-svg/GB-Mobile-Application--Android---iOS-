import {
  isExpoPushToken,
  sendPushNotification,
  sendPushNotifications,
  type ExpoPushMessage,
} from '../integrations/push/expoClient';
import {
  type AlertRow,
  getOrganisationIdForAlert as fetchOrganisationIdForAlert,
} from '../repositories/alertsRepository';
import {
  getExistingUserPushToken,
  getLatestPushToken,
  getPushTokensForOrganisation,
  upsertUserPushToken,
} from '../repositories/pushTokensRepository';
import { markPushSampleResult } from './statusService';
import { logger } from '../config/logger';

const PUSH_HEALTHCHECK_ENABLED = process.env.PUSH_HEALTHCHECK_ENABLED === 'true';
const PUSH_HEALTHCHECK_INTERVAL_MINUTES = Number(
  process.env.PUSH_HEALTHCHECK_INTERVAL_MINUTES || 30
);
const PUSH_HEALTHCHECK_TOKEN = process.env.PUSH_HEALTHCHECK_TOKEN;
const PUSH_NOTIFICATIONS_DISABLED = process.env.PUSH_NOTIFICATIONS_DISABLED === 'true';

type PushHealthSample = {
  status: 'ok' | 'error' | 'skipped';
  detail?: string;
  at: string;
};

export type PushHealthStatus = {
  configured: boolean;
  tokensPresent: boolean;
  lastSample: PushHealthSample | null;
};

let lastPushSample: PushHealthSample | null = null;
const log = logger.child({ module: 'push' });

async function recordPushSample(now: Date, err: unknown) {
  try {
    await markPushSampleResult(now, err);
  } catch (statusErr) {
    log.warn({ err: statusErr }, 'failed to record push health sample');
  }
}

function maskToken(token: string | null) {
  if (!token) return null;
  const tail = token.slice(-6);
  return `***${tail}`;
}

export async function registerPushTokenForUser(
  userId: string,
  token: string,
  recentMinutes: number
) {
  const recentThreshold = new Date(Date.now() - recentMinutes * 60 * 1000);
  const existing = await getExistingUserPushToken(userId, token);

  const lastUsedRaw = existing?.last_used_at;
  const lastUsedAt = lastUsedRaw ? new Date(lastUsedRaw) : null;

  if (lastUsedAt && lastUsedAt > recentThreshold) {
    return { skipped: true };
  }

  await upsertUserPushToken(userId, token);
  return { skipped: false };
}

async function resolveOrganisationIdForAlert(alert: AlertRow): Promise<string | null> {
  return fetchOrganisationIdForAlert(alert.id);
}

export async function sendAlertNotification(alert: AlertRow) {
  if (PUSH_NOTIFICATIONS_DISABLED) return;

  if (alert.severity !== 'critical') return;

  const mutedUntil = alert.muted_until ? new Date(alert.muted_until) : null;
  if (mutedUntil && mutedUntil > new Date()) {
    log.info(
      { alertId: alert.id, mutedUntil: mutedUntil.toISOString() },
      'skipping notification for muted alert'
    );
    return;
  }

  const organisationId = await resolveOrganisationIdForAlert(alert);
  if (!organisationId) {
    log.warn({ alertId: alert.id }, 'skipping alert push because organisation is unknown');
    return;
  }

  const tokens = await getPushTokensForOrganisation(organisationId);
  if (tokens.length === 0) {
    return;
  }

  const messages: ExpoPushMessage[] = [];

  for (const token of tokens) {
    if (!isExpoPushToken(token)) {
      log.warn({ token: maskToken(token) }, 'invalid Expo push token');
      continue;
    }

    messages.push({
      to: token,
      sound: 'default',
      title: `[${alert.severity.toUpperCase()}] ${alert.type}`,
      body: alert.message,
      data: {
        alertId: alert.id,
        deviceId: alert.device_id,
        siteId: alert.site_id,
        type: alert.type,
      },
    });
  }

  try {
    const tickets = await sendPushNotifications(messages);
    log.info({ tickets: (tickets ?? []).length }, 'push tickets sent');
  } catch (e) {
    log.error({ err: e }, 'error sending push notifications');
  }
}

export async function runPushHealthCheck(): Promise<PushHealthStatus> {
  const configured = PUSH_NOTIFICATIONS_DISABLED ? false : Boolean(process.env.EXPO_ACCESS_TOKEN);
  const token = PUSH_HEALTHCHECK_TOKEN || (await getLatestPushToken());
  const tokensPresent = Boolean(token);
  const now = new Date();
  const intervalMs = Math.max(1, PUSH_HEALTHCHECK_INTERVAL_MINUTES) * 60 * 1000;

  const buildResponse = () => ({
    configured,
    tokensPresent,
    lastSample: lastPushSample,
  });

  if (!configured) {
    lastPushSample = {
      status: 'skipped',
      detail: 'EXPO_ACCESS_TOKEN missing',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (!token) {
    lastPushSample = {
      status: 'skipped',
      detail: 'No push tokens registered',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (!PUSH_HEALTHCHECK_ENABLED) {
    lastPushSample = {
      status: 'skipped',
      detail: 'PUSH_HEALTHCHECK_ENABLED is false',
      at: now.toISOString(),
    };
    return buildResponse();
  }

  if (lastPushSample) {
    const lastAt = new Date(lastPushSample.at).getTime();
    if (now.getTime() - lastAt < intervalMs) {
      return buildResponse();
    }
  }

  try {
    const message: ExpoPushMessage = {
      to: token,
      sound: 'default',
      title: 'Greenbro health check',
      body: 'Push delivery path verified',
      data: { type: 'healthcheck' },
    };
    await sendPushNotification(message);
    lastPushSample = {
      status: 'ok',
      detail: `Sent to token ${maskToken(token)}`,
      at: now.toISOString(),
    };
    await recordPushSample(now, null);
  } catch (e) {
    lastPushSample = {
      status: 'error',
      detail: (e as Error | undefined)?.message || 'Push health send failed',
      at: now.toISOString(),
    };
    await recordPushSample(now, e);
  }

  return buildResponse();
}
