import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { DeviceSchedule } from '../types';

export type ScheduleInput = {
  name?: string;
  enabled?: boolean;
  startHour: number;
  endHour: number;
  targetSetpoint: number;
  targetMode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO';
};

export function useDeviceSchedule(deviceId: string) {
  return useQuery<DeviceSchedule | null>({
    queryKey: ['devices', deviceId, 'schedule'],
    enabled: !!deviceId,
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/schedule`);
      return res.data;
    },
  });
}

export function useUpsertDeviceSchedule(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScheduleInput) => {
      const res = await api.put(`/devices/${deviceId}/schedule`, payload);
      return res.data as DeviceSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId, 'schedule'] });
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
    },
  });
}
