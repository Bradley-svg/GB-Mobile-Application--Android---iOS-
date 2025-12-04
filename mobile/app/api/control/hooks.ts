import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

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
