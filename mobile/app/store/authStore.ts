import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import {
  LAST_REGISTERED_PUSH_TOKEN_KEY,
  LAST_REGISTERED_USER_ID_KEY,
  LEGACY_PUSH_TOKEN_KEY,
  PUSH_TOKEN_STORAGE_PREFIX,
} from '../constants/pushTokens';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id?: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  sessionExpired: boolean;
  setAuth: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => Promise<void>;
  updateTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setSessionExpired: (expired: boolean) => void;
  clearAuth: () => Promise<void>;
  hydrateFromSecureStore: () => Promise<void>;
};

const ACCESS_KEY = 'greenbro_access_token';
const REFRESH_KEY = 'greenbro_refresh_token';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  sessionExpired: false,

  setAuth: async ({ accessToken, refreshToken, user }) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken, user, sessionExpired: false });
  },

  updateTokens: async ({ accessToken, refreshToken }) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user: AuthUser | null) => {
    set({ user });
  },

  setSessionExpired: (expired: boolean) => {
    set({ sessionExpired: expired });
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
      const uniqueKeys = Array.from(
        new Set([
          ...pushTokenKeys,
          LAST_REGISTERED_PUSH_TOKEN_KEY,
          LAST_REGISTERED_USER_ID_KEY,
          LEGACY_PUSH_TOKEN_KEY,
        ])
      );
      if (uniqueKeys.length) {
        await AsyncStorage.multiRemove(uniqueKeys);
      }
    } catch (err) {
      console.error('Failed to clear push token flags on logout', err);
    }

    set({ accessToken: null, refreshToken: null, user: null, sessionExpired: false });
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
