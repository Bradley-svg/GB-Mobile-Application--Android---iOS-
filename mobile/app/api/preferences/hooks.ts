import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api as client } from '../client';
import { NotificationPreferences } from '../types';

export const NOTIFICATION_PREFERENCES_KEY_PREFIX = 'notificationPreferences:';
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.freeze({
  alertsEnabled: true,
});
export const NOTIFICATION_PREFERENCES_QUERY_KEY = ['notificationPreferences'];

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

export function useNotificationPreferencesQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  const setNotificationPreferences = useAuthStore((s) => s.setNotificationPreferences);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
    }
    previousUserId.current = userId ?? null;

    if (!userId) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    let cancelled = false;

    const primeFromCache = async () => {
      const existing = queryClient.getQueryData<NotificationPreferences>(
        NOTIFICATION_PREFERENCES_QUERY_KEY
      );
      if (existing) {
        setNotificationPreferences(existing);
        return;
      }

      const cached = await readNotificationPreferences(userId);
      if (!cancelled) {
        queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, cached);
        setNotificationPreferences(cached);
      }
    };

    primeFromCache();

    return () => {
      cancelled = true;
    };
  }, [queryClient, setNotificationPreferences, userId]);

  return useQuery<NotificationPreferences>({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    enabled: !!userId,
    initialData: () =>
      queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY) ??
      DEFAULT_NOTIFICATION_PREFERENCES,
    queryFn: async () => {
      const response = await client.get('/user/preferences');
      return response.data as NotificationPreferences;
    },
    onSuccess: async (data) => {
      if (userId) {
        await persistNotificationPreferences(userId, data);
      }
      setNotificationPreferences(data);
    },
    onError: async () => {
      if (!userId) return;
      const cached = await readNotificationPreferences(userId);
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, cached);
      setNotificationPreferences(cached);
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const userId = useAuthStore((s) => s.user?.id);
  const setNotificationPreferences = useAuthStore((s) => s.setNotificationPreferences);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<NotificationPreferences>) => {
      const response = await client.put('/user/preferences', input);
      return response.data as NotificationPreferences;
    },
    onMutate: async (nextPrefs) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
      const previous =
        queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY) ??
        DEFAULT_NOTIFICATION_PREFERENCES;

      if (typeof nextPrefs.alertsEnabled === 'boolean') {
        const optimistic: NotificationPreferences = {
          ...previous,
          alertsEnabled: nextPrefs.alertsEnabled,
        };
        queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, optimistic);
        setNotificationPreferences(optimistic);
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      const fallback = context?.previous ?? DEFAULT_NOTIFICATION_PREFERENCES;
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, fallback);
      setNotificationPreferences(fallback);
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, data);
      setNotificationPreferences(data);
      if (userId) {
        await persistNotificationPreferences(userId, data);
      }
    },
  });
}
