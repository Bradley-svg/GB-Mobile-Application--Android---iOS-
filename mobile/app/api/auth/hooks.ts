import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../client';
import type { AuthResponse } from '../types';

type LoginPayload = { email: string; password: string };
type LoginErrorResponse = { message?: string; error?: string };

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
      await setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
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
