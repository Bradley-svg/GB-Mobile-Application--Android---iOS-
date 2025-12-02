import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { query } from '../db/pool';
import { AlertRow } from './alertService';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

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
