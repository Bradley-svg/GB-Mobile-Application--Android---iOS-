import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from './client';

export type ApiSite = {
  id: string;
  name: string;
  city?: string;
  status?: string;
  last_seen_at?: string;
  online_devices?: number;
  device_count_online?: number;
};

export type ApiDevice = {
  id: string;
  site_id: string;
  name: string;
  type: string;
  status?: string;
  last_seen_at?: string;
};

export type DeviceTelemetry = {
  range: '24h' | '7d';
  metrics: Record<string, { ts: string; value: number }[]>;
};

export type Alert = {
  id: string;
  site_id: string | null;
  device_id: string | null;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  status: 'active' | 'cleared';
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id?: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = AuthTokens & { user: AuthUser };

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

export function useSignup() {
  return useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      const res = await api.post<AuthResponse>('/auth/signup', payload);
      return res.data;
    },
    onSuccess: (data) => {
      console.log('Signup SUCCESS:', JSON.stringify(data));
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ error?: string }>;
      console.error('Signup ERROR:', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: { email: string }) => {
      const res = await api.post('/auth/reset-password', payload);
      return res.data as { ok?: boolean; message?: string };
    },
  });
}

export function useSites() {
  return useQuery<ApiSite[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get('/sites');
      return res.data;
    },
  });
}

export function useSite(id: string) {
  return useQuery<ApiSite>({
    queryKey: ['sites', id],
    queryFn: async () => {
      const res = await api.get(`/sites/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDevices(siteId: string) {
  return useQuery<ApiDevice[]>({
    queryKey: ['sites', siteId, 'devices'],
    queryFn: async () => {
      const res = await api.get(`/sites/${siteId}/devices`);
      return res.data;
    },
    enabled: !!siteId,
  });
}

export function useDevice(deviceId: string) {
  return useQuery<ApiDevice>({
    queryKey: ['devices', deviceId],
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}`);
      return res.data;
    },
    enabled: !!deviceId,
  });
}

export function useDeviceTelemetry(deviceId: string, range: '24h' | '7d') {
  return useQuery<DeviceTelemetry>({
    queryKey: ['devices', deviceId, 'telemetry', range],
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/telemetry`, {
        params: { range },
      });
      return res.data;
    },
    enabled: !!deviceId,
  });
}

export function useAlerts(filters?: { status?: string; severity?: string; siteId?: string }) {
  const params: Record<string, string> = {};
  if (filters?.status) params.status = filters.status;
  if (filters?.severity) params.severity = filters.severity;
  if (filters?.siteId) params.siteId = filters.siteId;

  return useQuery<Alert[]>({
    queryKey: ['alerts', params],
    queryFn: async () => {
      const res = await api.get('/alerts', { params });
      return res.data;
    },
  });
}

export function useDeviceAlerts(deviceId: string) {
  return useQuery<Alert[]>({
    queryKey: ['devices', deviceId, 'alerts'],
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/alerts`);
      return res.data;
    },
    enabled: !!deviceId,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`/alerts/${alertId}/acknowledge`, {});
      return res.data as Alert;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: ['devices', data.device_id, 'alerts'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      }
    },
  });
}

export function useMuteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { alertId: string; minutes: number }) => {
      const res = await api.post(`/alerts/${payload.alertId}/mute`, { minutes: payload.minutes });
      return res.data as Alert;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: ['devices', data.device_id, 'alerts'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      }
    },
  });
}

export function useSetpointCommand(deviceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (value: number) => {
      const res = await api.post(`/devices/${deviceId}/commands/setpoint`, {
        metric: 'flow_temp',
        value,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId, 'telemetry'] });
    },
  });
}

export function useModeCommand(deviceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') => {
      const res = await api.post(`/devices/${deviceId}/commands/mode`, { mode });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
    },
  });
}
