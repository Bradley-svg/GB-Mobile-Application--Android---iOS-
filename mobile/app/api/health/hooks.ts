import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { HealthPlusPayload } from '../types';

export const HEALTH_PLUS_QUERY_KEY = ['health-plus'];

export function useHealthPlus(options?: { enabled?: boolean }) {
  return useQuery<HealthPlusPayload>({
    queryKey: HEALTH_PLUS_QUERY_KEY,
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const res = await api.get('/health-plus');
      return res.data as HealthPlusPayload;
    },
  });
}
