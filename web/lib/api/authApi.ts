import { api } from "./httpClient";
import type { AuthResponse, AuthTokens, AuthUser } from "@/lib/types/auth";

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
