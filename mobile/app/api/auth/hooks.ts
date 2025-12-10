import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../client';
import type {
  AuthResponse,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
} from '../types';

type LoginPayload = { email: string; password: string };
type LoginErrorResponse = { message?: string; error?: string };

type TwoFactorLoginPayload = { challengeToken: string; code: string };
type TwoFactorCodePayload = { code: string };

type PasswordResetRequestPayload = { email: string };
type ResetPasswordPayload = { token: string; password: string };

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async ({ email, password }: LoginPayload) => {
      console.log('Login mutation: start', { email });
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      return res.data;
    },
    onSuccess: async (data, variables) => {
      console.log('Login mutation: SUCCESS', { email: variables.email, user: data?.user?.email });
      if (data.requires2fa) {
        return;
      }
      if (data.accessToken && data.refreshToken && data.user) {
        await setAuth({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
      }
    },
    onError: (error, variables) => {
      const axiosError = error as AxiosError<LoginErrorResponse>;
      console.log('Login mutation: ERROR', {
        email: variables.email,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
    },
  });
}

export function useLoginTwoFactor() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async ({ challengeToken, code }: TwoFactorLoginPayload) => {
      const res = await api.post<AuthResponse>('/auth/login/2fa', { challengeToken, code });
      return res.data;
    },
    onSuccess: async (data, variables) => {
      console.log('2FA login SUCCESS', { user: data?.user?.email });
      if (data.accessToken && data.refreshToken && data.user) {
        await setAuth({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
      } else {
        console.warn('2FA login succeeded but tokens were missing', { variables });
      }
    },
  });
}

export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TwoFactorSetupResponse>('/auth/2fa/setup');
      return res.data;
    },
  });
}

export function useTwoFactorConfirm() {
  return useMutation({
    mutationFn: async ({ code }: TwoFactorCodePayload) => {
      const res = await api.post<TwoFactorStatusResponse>('/auth/2fa/confirm', { code });
      return res.data;
    },
  });
}

export function useTwoFactorDisable() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TwoFactorStatusResponse>('/auth/2fa/disable');
      return res.data;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async ({ email }: PasswordResetRequestPayload) => {
      const res = await api.post<{ message?: string }>('/auth/request-password-reset', { email });
      return res.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }: ResetPasswordPayload) => {
      const res = await api.post<{ ok: boolean }>('/auth/reset-password', { token, password });
      return res.data;
    },
  });
}
