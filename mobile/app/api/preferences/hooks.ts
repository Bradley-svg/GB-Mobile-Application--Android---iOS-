import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api as client } from '../client';
import { NotificationPreferences } from '../types';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  persistNotificationPreferences,
  readNotificationPreferences,
} from './storage';

export const NOTIFICATION_PREFERENCES_QUERY_KEY = ['notificationPreferences'];

export function useNotificationPreferencesQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  const setNotificationPreferences = useAuthStore((s) => s.setNotificationPreferences);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);
  const lastPersisted = useRef<NotificationPreferences | null>(null);

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

  const query = useQuery<NotificationPreferences>({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    enabled: !!userId,
    initialData: () =>
      queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY) ??
      DEFAULT_NOTIFICATION_PREFERENCES,
    queryFn: async () => {
      const response = await client.get('/user/preferences');
      return response.data as NotificationPreferences;
    },
  });

  useEffect(() => {
    if (!userId) return;
    if (!query.isError) return;

    (async () => {
      const cached = await readNotificationPreferences(userId);
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, cached);
      setNotificationPreferences(cached);
    })();
  }, [query.isError, queryClient, setNotificationPreferences, userId]);

  useEffect(() => {
    if (!query.data) return;
    if (!query.isSuccess) return;

    setNotificationPreferences(query.data);

    if (!userId) return;

    const hasChanged =
      !lastPersisted.current ||
      lastPersisted.current.alertsEnabled !== query.data.alertsEnabled;

    lastPersisted.current = query.data;

    if (hasChanged) {
      persistNotificationPreferences(userId, query.data).catch((err) => {
        console.error('Failed to persist notification preferences', err);
      });
    }
  }, [query.data, query.isSuccess, setNotificationPreferences, userId]);

  return query;
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
