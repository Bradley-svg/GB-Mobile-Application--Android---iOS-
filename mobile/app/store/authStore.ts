import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { NotificationPreferences } from '../api/types';
import {
  LAST_REGISTERED_PUSH_TOKEN_KEY,
  LAST_REGISTERED_USER_ID_KEY,
  LEGACY_PUSH_TOKEN_KEY,
  PUSH_TOKEN_STORAGE_PREFIX,
} from '../constants/pushTokens';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCES_KEY_PREFIX,
  readNotificationPreferences,
} from '../api/preferences/hooks';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id?: string | null;
  role?: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  sessionExpired: boolean;
  preferencesHydrated: boolean;
  notificationPreferences: NotificationPreferences;
  setAuth: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => Promise<void>;
  updateTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setNotificationPreferences: (prefs: NotificationPreferences) => void;
  hydrateNotificationPreferences: (userId: string | null) => Promise<NotificationPreferences>;
  setSessionExpired: (expired: boolean) => void;
  clearAuth: () => Promise<void>;
  hydrateFromSecureStore: () => Promise<void>;
};

const ACCESS_KEY = 'greenbro_access_token';
const REFRESH_KEY = 'greenbro_refresh_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  sessionExpired: false,
  preferencesHydrated: false,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,

  setAuth: async ({ accessToken, refreshToken, user }) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({
      accessToken,
      refreshToken,
      user,
      sessionExpired: false,
      preferencesHydrated: false,
    });
  },

  updateTokens: async ({ accessToken, refreshToken }) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user: AuthUser | null) => {
    set((state) => ({
      user,
      preferencesHydrated:
        user && state.user && user.id === state.user.id ? state.preferencesHydrated : false,
    }));
  },

  setSessionExpired: (expired: boolean) => {
    set({ sessionExpired: expired });
  },

  setNotificationPreferences: (prefs: NotificationPreferences) => {
    set({ notificationPreferences: prefs, preferencesHydrated: true });
  },

  hydrateNotificationPreferences: async (userId: string | null) => {
    if (!userId) {
      set({
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        preferencesHydrated: true,
      });
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
    const prefs = await readNotificationPreferences(userId);
    set({ notificationPreferences: prefs, preferencesHydrated: true });
    return prefs;
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const pushTokenKeys = allKeys.filter(
        (key) =>
          key === LEGACY_PUSH_TOKEN_KEY ||
          key.startsWith(PUSH_TOKEN_STORAGE_PREFIX) ||
          key === LAST_REGISTERED_PUSH_TOKEN_KEY ||
          key === LAST_REGISTERED_USER_ID_KEY
      );
      const preferenceKeys = allKeys.filter((key) =>
        key.startsWith(NOTIFICATION_PREFERENCES_KEY_PREFIX)
      );
      const currentUserPreferenceKey = get().user?.id
        ? `${NOTIFICATION_PREFERENCES_KEY_PREFIX}${get().user?.id}`
        : null;
      const uniqueKeys = Array.from(
        new Set([
          ...pushTokenKeys,
          ...preferenceKeys,
          LAST_REGISTERED_PUSH_TOKEN_KEY,
          LAST_REGISTERED_USER_ID_KEY,
          LEGACY_PUSH_TOKEN_KEY,
          ...(currentUserPreferenceKey ? [currentUserPreferenceKey] : []),
        ])
      );
      if (uniqueKeys.length) {
        await AsyncStorage.multiRemove(uniqueKeys);
      }
    } catch (err) {
      console.error('Failed to clear push token flags on logout', err);
    }

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      sessionExpired: false,
      preferencesHydrated: false,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    });
  },

  hydrateFromSecureStore: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      set({
        accessToken,
        refreshToken,
        user: null,
        isHydrated: true,
        sessionExpired: false,
      });
    } catch (e) {
      console.error('Failed to hydrate auth', e);
      set({ isHydrated: true });
    }
  },
}));

export function isAdminOrOwner(role?: string | null) {
  const value = role ?? useAuthStore.getState().user?.role;
  return value === 'owner' || value === 'admin';
}

export function isFacilities(role?: string | null) {
  const value = role ?? useAuthStore.getState().user?.role;
  return value === 'facilities';
}

export function isContractor(role?: string | null) {
  const value = role ?? useAuthStore.getState().user?.role;
  return value === 'contractor';
}
