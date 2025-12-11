import { api } from "./httpClient";
import type {
  AuthResponse,
  AuthSession,
  AuthTokens,
  AuthUser,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
} from "@/lib/types/auth";

type LoginResult = AuthResponse;

export async function login(
  email: string,
  password: string,
  twoFactorCode?: string,
): Promise<LoginResult> {
  const res = await api.post<AuthResponse>("/auth/login", {
    email,
    password,
    code: twoFactorCode,
  });
  return res.data;
}

export async function completeTwoFactor(challengeToken: string, code: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/login/2fa", { challengeToken, code });
  return res.data;
}

export async function setupTwoFactor(): Promise<TwoFactorSetupResponse> {
  const res = await api.post<TwoFactorSetupResponse>("/auth/2fa/setup");
  return res.data;
}

export async function confirmTwoFactor(code: string): Promise<TwoFactorStatusResponse> {
  const res = await api.post<TwoFactorStatusResponse>("/auth/2fa/confirm", { code });
  return res.data;
}

export async function disableTwoFactor(): Promise<TwoFactorStatusResponse> {
  const res = await api.post<TwoFactorStatusResponse>("/auth/2fa/disable");
  return res.data;
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const res = await api.post<AuthTokens>("/auth/refresh", { refreshToken });
  return res.data;
}

export async function requestPasswordReset(email: string) {
  const res = await api.post<{ message?: string }>("/auth/request-password-reset", { email });
  return res.data;
}

export async function resetPassword(payload: { token: string; newPassword: string }) {
  const res = await api.post<{ ok: boolean }>("/auth/reset-password", payload);
  return res.data;
}

export async function me(): Promise<AuthUser> {
  const res = await api.get<AuthUser>("/auth/me");
  return res.data;
}

const stubSessions: AuthSession[] = [
  {
    id: "current-session",
    userAgent: "This browser",
    ip: "127.0.0.1",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastUsedAt: new Date().toISOString(),
    current: true,
  },
  {
    id: "tablet-session",
    userAgent: "iPadOS Safari",
    ip: "203.0.113.24",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    current: false,
  },
];

const normalizeSession = (session: AuthSession | Record<string, unknown>): AuthSession => ({
  id: (session as AuthSession).id,
  userAgent:
    (session as AuthSession).userAgent ??
    (session as { user_agent?: string }).user_agent ??
    (session as { agent?: string }).agent ??
    null,
  ip: (session as AuthSession).ip ?? (session as { ip_address?: string }).ip_address ?? null,
  createdAt:
    (session as AuthSession).createdAt ??
    (session as { created_at?: string }).created_at ??
    new Date().toISOString(),
  lastUsedAt:
    (session as AuthSession).lastUsedAt ??
    (session as { last_used_at?: string }).last_used_at ??
    null,
  current: Boolean((session as AuthSession).current ?? (session as { is_current?: boolean }).is_current),
});

export async function listAuthSessions(): Promise<AuthSession[]> {
  try {
    const res = await api.get<AuthSession[]>("/auth/sessions");
    return res.data.map(normalizeSession);
  } catch (error) {
    // TODO: replace fallback once a dedicated /auth/sessions endpoint ships
    if (process.env.NODE_ENV !== "production") {
      console.info("Using stub auth sessions because /auth/sessions is unavailable.", error);
    }
    return stubSessions;
  }
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  try {
    await api.post(`/auth/sessions/${sessionId}/revoke`);
  } catch {
    // TODO: wire to backend revoke endpoint when available
  }
}

export async function revokeOtherAuthSessions(): Promise<void> {
  try {
    await api.post("/auth/sessions/revoke-others");
  } catch {
    // TODO: wire to backend revoke-all-but-current endpoint when available
  }
}
