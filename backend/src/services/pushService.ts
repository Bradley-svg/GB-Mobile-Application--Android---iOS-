import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { query } from '../db/pool';
import { AlertRow } from './alertService';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

async function getAllPushTokens(): Promise<string[]> {
  const res = await query<{ expo_token: string }>(
    `
    select distinct expo_token
    from push_tokens
  `
  );

  return res.rows.map((r) => r.expo_token);
}

export async function sendAlertNotification(alert: AlertRow) {
  if (alert.severity !== 'critical') return;

  const tokens = await getAllPushTokens();
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
      console.log('Push tickets sent:', tickets.length);
    } catch (e) {
      console.error('Error sending push notifications', e);
    }
  }
}
