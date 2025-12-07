import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ControlCommandHistoryRow } from '../types';

export function useDeviceCommands(deviceId: string) {
  return useQuery<ControlCommandHistoryRow[]>({
    queryKey: ['devices', deviceId, 'commands'],
    enabled: !!deviceId,
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/commands`);
      return res.data;
    },
  });
}
