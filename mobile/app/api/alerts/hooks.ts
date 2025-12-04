import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Alert } from '../types';

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
