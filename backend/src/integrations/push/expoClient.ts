import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { logger } from '../../config/logger';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});
const log = logger.child({ module: 'push' });

export function isExpoPushToken(token: string) {
  return Expo.isExpoPushToken(token);
}

export async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...(result ?? []));
    } catch (err) {
      log.error({ err }, 'error sending push notifications');
      throw err;
    }
  }

  return tickets;
}

export async function sendPushNotification(message: ExpoPushMessage) {
  return sendPushNotifications([message]);
}

export type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
