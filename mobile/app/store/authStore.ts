import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setAuth: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => Promise<void>;
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

  setAuth: async ({ accessToken, refreshToken, user }) => {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
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
      });
    } catch (e) {
      console.error('Failed to hydrate auth', e);
      set({ isHydrated: true });
    }
  },
}));
