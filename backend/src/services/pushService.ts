import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { query } from '../db/pool';
import { AlertRow } from './alertService';
import { markPushSampleResult } from './statusService';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});
const PUSH_HEALTHCHECK_ENABLED = process.env.PUSH_HEALTHCHECK_ENABLED === 'true';
const PUSH_HEALTHCHECK_INTERVAL_MINUTES = Number(
  process.env.PUSH_HEALTHCHECK_INTERVAL_MINUTES || 30
);
const PUSH_HEALTHCHECK_TOKEN = process.env.PUSH_HEALTHCHECK_TOKEN;

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

async function recordPushSample(now: Date, err: unknown) {
  try {
    await markPushSampleResult(now, err);
  } catch (statusErr) {
    console.warn('[push] failed to record push health sample', statusErr);
  }
}

function maskToken(token: string | null) {
  if (!token) return null;
  const tail = token.slice(-6);
  return `***${tail}`;
}

async function getOrganisationIdForAlert(alert: AlertRow): Promise<string | null> {
  const res = await query<{ organisation_id: string | null }>(
    `
    select s.organisation_id
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    where a.id = $1
    limit 1
  `,
    [alert.id]
  );

  return res.rows[0]?.organisation_id ?? null;
}

async function getPushTokensForOrganisation(organisationId: string): Promise<string[]> {
  const res = await query<{ expo_token: string }>(
    `
    select distinct pt.expo_token
    from push_tokens pt
    join users u on pt.user_id = u.id
    where u.organisation_id = $1
  `,
    [organisationId]
  );

  return res.rows.map((r: { expo_token: string }) => r.expo_token);
}

async function getLatestPushToken(): Promise<string | null> {
  const res = await query<{ expo_token: string }>(
    `
    select expo_token
    from push_tokens
    order by coalesce(last_used_at, created_at) desc
    limit 1
  `
  );

  return res.rows[0]?.expo_token ?? null;
}

export async function sendAlertNotification(alert: AlertRow) {
  if (alert.severity !== 'critical') return;

  const mutedUntil = alert.muted_until ? new Date(alert.muted_until) : null;
  if (mutedUntil && mutedUntil > new Date()) {
    console.log(
      `[push] skipping notification for alert=${alert.id} muted_until=${mutedUntil.toISOString()}`
    );
    return;
  }

  const organisationId = await getOrganisationIdForAlert(alert);
  if (!organisationId) {
    console.warn(`[push] skipping alert=${alert.id} because organisation is unknown`);
    return;
  }

  const tokens = await getPushTokensForOrganisation(organisationId);
  if (tokens.length === 0) {
    return;
  }

  const messages: ExpoPushMessage[] = [];

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`Invalid Expo push token: ${token}`);
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

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      console.log('Push tickets sent:', (tickets ?? []).length);
    } catch (e) {
      console.error('Error sending push notifications', e);
    }
  }
}

export async function runPushHealthCheck(): Promise<PushHealthStatus> {
  const configured = Boolean(process.env.EXPO_ACCESS_TOKEN);
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
    await expo.sendPushNotificationsAsync([message]);
    lastPushSample = {
      status: 'ok',
      detail: `Sent to token ${maskToken(token)}`,
      at: now.toISOString(),
    };
    await recordPushSample(now, null);
  } catch (e: any) {
    lastPushSample = {
      status: 'error',
      detail: e?.message || 'Push health send failed',
      at: now.toISOString(),
    };
    await recordPushSample(now, e);
  }

  return buildResponse();
}
