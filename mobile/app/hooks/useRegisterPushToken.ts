import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { getPushTokenStorageKey } from '../constants/pushTokens';

async function registerTokenWithBackend(token: string) {
  await api.post('/auth/me/push-tokens', { token });
}

async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get notification permissions');
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
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const run = async () => {
      const userId = user?.id;
      if (!userId) return;

      const storageKey = getPushTokenStorageKey(userId);
      const already = await AsyncStorage.getItem(storageKey);
      if (already === '1') {
        return;
      }

      const token = await getPushToken();
      if (!token) return;

      try {
        await registerTokenWithBackend(token);
        await AsyncStorage.setItem(storageKey, '1');
        console.log('Push token registered');
      } catch (e) {
        console.error('Failed to register push token', e);
      }
    };

    run();
  }, [user]);
}
