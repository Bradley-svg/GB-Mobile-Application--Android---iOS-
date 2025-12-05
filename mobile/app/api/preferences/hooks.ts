import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    console.error('Failed to read notification preferences; defaulting to enabled', err);
  }

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function persistNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
) {
  // TODO: replace local storage with backend /user/preferences when available.
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(prefs));
  return prefs;
}

export async function deleteNotificationPreferences(userId: string) {
  await AsyncStorage.removeItem(getStorageKey(userId));
}

export function useNotificationPreferences(userId?: string) {
  const enabled = !!userId;
  return useQuery<NotificationPreferences>({
    queryKey: ['notificationPreferences', userId ?? 'anonymous'],
    queryFn: async () => {
      if (!userId) return DEFAULT_NOTIFICATION_PREFERENCES;
      return readNotificationPreferences(userId);
    },
    enabled,
    initialData: DEFAULT_NOTIFICATION_PREFERENCES,
  });
}

export function useUpdateNotificationPreferences(userId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['notificationPreferences', userId ?? 'anonymous'];

  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      if (!userId) throw new Error('Cannot update preferences without a user');
      return persistNotificationPreferences(userId, prefs);
    },
    onMutate: async (nextPrefs) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey);
      queryClient.setQueryData(queryKey, nextPrefs);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
}
