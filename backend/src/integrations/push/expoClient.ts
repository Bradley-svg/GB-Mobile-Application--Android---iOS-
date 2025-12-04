import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

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
      console.error('Error sending push notifications', err);
      throw err;
    }
  }

  return tickets;
}

export async function sendPushNotification(message: ExpoPushMessage) {
  return sendPushNotifications([message]);
}

export type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
