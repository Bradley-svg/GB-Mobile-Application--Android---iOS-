import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ApiDevice, DeviceTelemetry, TimeRange } from '../types';

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

export function useDevices(siteId: string) {
  return useQuery<ApiDevice[]>({
    queryKey: ['sites', siteId, 'devices'],
    queryFn: async () => {
      const res = await api.get(`/sites/${siteId}/devices`);
      return res.data;
    },
    enabled: !!siteId,
    retry: shouldRetry,
    retryDelay,
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
    retry: shouldRetry,
    retryDelay,
  });
}

export function useDeviceTelemetry(deviceId: string, range: TimeRange) {
  return useQuery<DeviceTelemetry>({
    queryKey: ['devices', deviceId, 'telemetry', range],
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/telemetry`, {
        params: { range },
      });
      return res.data;
    },
    enabled: !!deviceId,
    retry: shouldRetry,
    retryDelay,
  });
}
