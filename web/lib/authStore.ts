"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import * as authApi from "@/lib/api/authApi";
import { registerTokenGetter, registerTokenSetter } from "@/lib/api/tokenStore";
import type { AuthResponse, AuthTokens, AuthUser } from "@/lib/types/auth";

type AuthState = {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser | null;
  hasHydrated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<AuthResponse>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<AuthResponse>;
  refresh: () => Promise<AuthTokens | null>;
  logout: () => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: AuthUser | null) => void;
  loadFromStorage: () => Promise<void>;
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: undefined,
      refreshToken: undefined,
      user: null,
      hasHydrated: false,
      setTokens: (tokens) => set(() => ({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })),
      setUser: (user) => set(() => ({ user })),
      logout: () => set(() => ({ accessToken: undefined, refreshToken: undefined, user: null })),
      login: async (email: string, password: string, twoFactorCode?: string) => {
        const res = await authApi.login(email, password, twoFactorCode);
        if (res.requires2fa) {
          return res;
        }
        if (res.accessToken && res.refreshToken) {
          set(() => ({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user ?? null,
          }));
        }
        return res;
      },
      completeTwoFactor: async (challengeToken: string, code: string) => {
        const res = await authApi.completeTwoFactor(challengeToken, code);
        if (res.accessToken && res.refreshToken) {
          set(() => ({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user ?? null,
          }));
        }
        return res;
      },
      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return null;
        const res = await authApi.refresh(refreshToken);
        if (res.accessToken && res.refreshToken) {
          set(() => ({ accessToken: res.accessToken, refreshToken: res.refreshToken }));
        }
        return res;
      },
      loadFromStorage: () =>
        new Promise((resolve) => {
          if (get().hasHydrated) {
            resolve();
            return;
          }

          const finish = () => {
            useAuthStore.setState({ hasHydrated: true });
            resolve();
          };

          const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
            finish();
            unsub?.();
          });

          if (!unsub) {
            finish();
          }

          // Ensure hydration kicks off
          void useAuthStore.persist?.rehydrate?.();
        }),
    }),
    {
      name: "gb-web-auth",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : window.localStorage)),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);

registerTokenGetter(() => {
  const { accessToken, refreshToken } = useAuthStore.getState();
  return { accessToken, refreshToken };
});

registerTokenSetter((tokens) => {
  if (!tokens) {
    useAuthStore.getState().logout();
    return;
  }
  useAuthStore.getState().setTokens(tokens);
});

export { useAuthStore };
