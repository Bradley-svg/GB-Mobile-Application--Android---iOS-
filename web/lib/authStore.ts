"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import * as authApi from "@/lib/api/authApi";
import { registerTokenGetter, registerTokenSetter } from "@/lib/api/tokenStore";
import type { AuthResponse, AuthTokens, AuthUser } from "@/lib/types/auth";
import { AUTH_2FA_ENFORCE_ROLES, AUTH_COOKIE_MODE_ENABLED } from "@/config/env";
import type { SessionExpireReason } from "@/lib/types/session";

type AuthState = {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser | null;
  sessionStartedAt?: number | null;
  lastActiveAt?: number | null;
  twoFactorSetupRequired?: boolean;
  hasHydrated: boolean;
  forcedExpireReason?: SessionExpireReason | null;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<AuthResponse>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<AuthResponse>;
  refresh: () => Promise<AuthTokens | null>;
  logout: () => void;
  logoutAll: (options?: LogoutAllOptions) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: AuthUser | null) => void;
  recordActivity: (timestamp?: number) => void;
  loadFromStorage: () => Promise<void>;
  markSessionExpired: (reason: SessionExpireReason) => void;
  clearForcedExpire: () => void;
};

type LogoutAllOptions = {
  redirectTo?: string;
  hardReload?: boolean;
  delayMs?: number;
  onCleared?: () => void;
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const roleRequiresTwoFactor = (role?: string | null) =>
  AUTH_2FA_ENFORCE_ROLES.includes((role ?? "").toLowerCase());

const persistedStorage = AUTH_COOKIE_MODE_ENABLED
  ? memoryStorage
  : createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : window.localStorage));

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: undefined,
      refreshToken: undefined,
      user: null,
      sessionStartedAt: undefined,
      lastActiveAt: undefined,
      twoFactorSetupRequired: false,
      hasHydrated: false,
      forcedExpireReason: null,
      markSessionExpired: (reason) => set({ forcedExpireReason: reason }),
      clearForcedExpire: () => set({ forcedExpireReason: null }),
      setTokens: (tokens) =>
        set((state) => {
          const now = Date.now();
          return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            sessionStartedAt: state.sessionStartedAt ?? now,
            lastActiveAt: now,
            forcedExpireReason: null,
          };
        }),
      recordActivity: (timestamp) =>
        set((state) => {
          const now = timestamp ?? Date.now();
          return {
            lastActiveAt: now,
            sessionStartedAt: state.sessionStartedAt ?? now,
          };
        }),
      setUser: (user) =>
        set((state) => ({
          user,
          twoFactorSetupRequired: user
            ? roleRequiresTwoFactor(user.role) && !user.two_factor_enabled
            : state.twoFactorSetupRequired,
        })),
      logout: () =>
        set(() => ({
          accessToken: undefined,
          refreshToken: undefined,
          user: null,
          sessionStartedAt: undefined,
          lastActiveAt: undefined,
          twoFactorSetupRequired: false,
          forcedExpireReason: null,
        })),
      logoutAll: (options) => {
        const redirectTo = options?.redirectTo;
        const hardReload = options?.hardReload ?? true;
        const delayMs = options?.delayMs ?? 0;
        useAuthStore.persist?.clearStorage?.();
        set(() => ({
          accessToken: undefined,
          refreshToken: undefined,
          user: null,
          sessionStartedAt: undefined,
          lastActiveAt: undefined,
          twoFactorSetupRequired: false,
          hasHydrated: true,
        }));
        options?.onCleared?.();
        if (hardReload && typeof window !== "undefined") {
          const perform = () => {
            if (redirectTo) {
              window.location.href = redirectTo;
            } else {
              window.location.reload();
            }
          };
          if (delayMs > 0) {
            window.setTimeout(perform, delayMs);
          } else {
            perform();
          }
        }
      },
      login: async (email: string, password: string, twoFactorCode?: string) => {
        const res = await authApi.login(email, password, twoFactorCode);
        if (res.requires2fa) {
          return res;
        }
        if (res.accessToken && res.refreshToken) {
          const now = Date.now();
          set(() => ({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user ?? null,
            sessionStartedAt: now,
            lastActiveAt: now,
            twoFactorSetupRequired: Boolean(res.twoFactorSetupRequired),
            hasHydrated: true,
            forcedExpireReason: null,
          }));
        }
        return res;
      },
      completeTwoFactor: async (challengeToken: string, code: string) => {
        const res = await authApi.completeTwoFactor(challengeToken, code);
        if (res.accessToken && res.refreshToken) {
          const now = Date.now();
          set(() => ({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user ?? null,
            sessionStartedAt: now,
            lastActiveAt: now,
            twoFactorSetupRequired: false,
            hasHydrated: true,
            forcedExpireReason: null,
          }));
        }
        return res;
      },
      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return null;
        const res = await authApi.refresh(refreshToken);
        if (res.accessToken && res.refreshToken) {
          const now = Date.now();
          set((state) => ({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            sessionStartedAt: state.sessionStartedAt ?? now,
            lastActiveAt: now,
            forcedExpireReason: null,
          }));
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
            const state = useAuthStore.getState();
            const now = Date.now();
            if (state.accessToken && !state.lastActiveAt) {
              useAuthStore.setState({
                lastActiveAt: now,
                sessionStartedAt: state.sessionStartedAt ?? now,
              });
            }
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
      storage: persistedStorage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sessionStartedAt: state.sessionStartedAt,
        lastActiveAt: state.lastActiveAt,
        twoFactorSetupRequired: state.twoFactorSetupRequired,
      }),
    },
  ),
);

registerTokenGetter(() => {
  const { accessToken, refreshToken } = useAuthStore.getState();
  return { accessToken, refreshToken };
});

registerTokenSetter((tokens, reason) => {
  const state = useAuthStore.getState();
  if (!tokens) {
    if (reason === "refresh-error") {
      state.markSessionExpired?.("refresh");
      state.logoutAll?.({ hardReload: false });
      return;
    }
    state.logoutAll?.();
    return;
  }
  state.clearForcedExpire?.();
  state.setTokens(tokens);
  state.recordActivity();
});

export { useAuthStore };
