import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../api/preferences/hooks';
import {
  LAST_REGISTERED_PUSH_TOKEN_KEY,
  LAST_REGISTERED_USER_ID_KEY,
} from '../constants/pushTokens';

async function registerTokenWithBackend(token: string) {
  await api.post('/auth/me/push-tokens', { token });
}

export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function ensureNotificationPermission() {
  const currentStatus = await getNotificationPermissionStatus();
  if (currentStatus === 'granted' || currentStatus === 'denied') {
    return currentStatus;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const permissionStatus = await ensureNotificationPermission();
  if (permissionStatus !== 'granted') {
    console.log('Notification permission not granted; skipping push registration');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId found; push may not work');
  }

  const token = (
    await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  ).data;

  return token;
}

export function useRegisterPushToken() {
  const userId = useAuthStore((s) => s.user?.id);
  const preferences = useAuthStore((s) => s.notificationPreferences);
  const preferencesHydrated = useAuthStore((s) => s.preferencesHydrated);
  const hydrateNotificationPreferences = useAuthStore((s) => s.hydrateNotificationPreferences);

  useEffect(() => {
    if (!userId || preferencesHydrated) return;
    hydrateNotificationPreferences(userId);
  }, [hydrateNotificationPreferences, preferencesHydrated, userId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId || !preferencesHydrated) return;

      const loadedPreferences = preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
      if (!loadedPreferences.alertsEnabled) {
        console.log('Notification alerts disabled; skipping push registration');
        return;
      }

      const token = await getPushToken();
      if (!token) return;

      const [lastToken, lastUserId] = await Promise.all([
        AsyncStorage.getItem(LAST_REGISTERED_PUSH_TOKEN_KEY),
        AsyncStorage.getItem(LAST_REGISTERED_USER_ID_KEY),
      ]);

      const alreadyRegistered = lastToken === token && lastUserId === userId;
      if (alreadyRegistered) return;

      try {
        await registerTokenWithBackend(token);
        if (cancelled) return;
        await AsyncStorage.multiSet([
          [LAST_REGISTERED_PUSH_TOKEN_KEY, token],
          [LAST_REGISTERED_USER_ID_KEY, userId],
        ]);
        console.log('Push token registered');
      } catch (e) {
        console.error('Failed to register push token', e);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [preferences, preferencesHydrated, userId]);
}
