import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export type ApiSite = {
  id: string;
  name: string;
  city?: string;
  status?: string;
  last_seen_at?: string;
};

export type ApiDevice = {
  id: string;
  site_id: string;
  name: string;
  type: string;
  status?: string;
  last_seen_at?: string;
};

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
