import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { NOTIFICATION_PREFERENCES_QUERY_KEY } from '../api/preferences/hooks';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferences,
} from '../api/preferences/storage';
import {
  LAST_REGISTERED_PUSH_TOKEN_KEY,
  LAST_REGISTERED_USER_ID_KEY,
} from '../constants/pushTokens';
import { queryClient } from '../queryClient';
import { NotificationPreferences } from '../api/types';

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
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const userId = useAuthStore((s) => s.user?.id);
  const preferences = useAuthStore((s) => s.notificationPreferences);
  const preferencesHydrated = useAuthStore((s) => s.preferencesHydrated);
  const hydrateNotificationPreferences = useAuthStore((s) => s.hydrateNotificationPreferences);
  const setNotificationPreferences = useAuthStore((s) => s.setNotificationPreferences);

  useEffect(() => {
    if (!userId || preferencesHydrated) return;
    hydrateNotificationPreferences(userId);
  }, [hydrateNotificationPreferences, preferencesHydrated, userId]);

  useEffect(() => {
    let cancelled = false;

    const primeQueryCache = async () => {
      if (!userId || !preferencesHydrated) return;

      const existing = queryClient.getQueryData<NotificationPreferences>(
        NOTIFICATION_PREFERENCES_QUERY_KEY
      );
      if (existing) {
        return;
      }

      const cached = await readNotificationPreferences(userId);
      if (!cancelled) {
        queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, cached);
        setNotificationPreferences(cached);
      }
    };

    primeQueryCache();

    return () => {
      cancelled = true;
    };
  }, [preferencesHydrated, setNotificationPreferences, userId]);

  useEffect(() => {
    if (userId) return;
    queryClient.removeQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isAuthHydrated || !userId || !preferencesHydrated) return;

      const cachedPreferences =
        queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY);
      const loadedPreferences = cachedPreferences ?? preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
      if (preferences.alertsEnabled !== loadedPreferences.alertsEnabled) {
        setNotificationPreferences(loadedPreferences);
      }
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
  }, [isAuthHydrated, preferences, preferencesHydrated, setNotificationPreferences, userId]);
}
