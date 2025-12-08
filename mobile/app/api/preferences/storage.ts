import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPreferences } from '../types';

export const NOTIFICATION_PREFERENCES_KEY_PREFIX = 'notificationPreferences:';
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.freeze({
  alertsEnabled: true,
});

function getStorageKey(userId: string) {
  return `${NOTIFICATION_PREFERENCES_KEY_PREFIX}${userId}`;
}

export async function readNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    if (typeof parsed.alertsEnabled === 'boolean') {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
    }
  } catch (err) {
    console.error('Failed to read cached notification preferences; defaulting to enabled', err);
  }

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function persistNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
) {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(prefs));
  return prefs;
}

export async function deleteNotificationPreferences(userId: string) {
  await AsyncStorage.removeItem(getStorageKey(userId));
}
