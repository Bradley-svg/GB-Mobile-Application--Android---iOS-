import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ApiDevice, DeviceTelemetry } from '../types';

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
