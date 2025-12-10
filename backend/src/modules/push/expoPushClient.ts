import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'push' });

export function isExpoPushToken(token: string) {
  return Expo.isExpoPushToken(token);
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  accessToken: string
): Promise<ExpoPushTicket[]> {
  const client = new Expo({ accessToken });
  const chunks = client.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const result = await client.sendPushNotificationsAsync(chunk);
      tickets.push(...(result ?? []));
    } catch (err) {
      log.error({ err }, 'failed to send expo push chunk');
      throw err;
    }
  }

  return tickets;
}

export type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
