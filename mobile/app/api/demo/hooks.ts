import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DemoStatus } from '../types';

export const DEMO_STATUS_QUERY_KEY = ['demo-status'];

export function useDemoStatus(options?: { enabled?: boolean }) {
  return useQuery<DemoStatus>({
    queryKey: DEMO_STATUS_QUERY_KEY,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await api.get('/demo/status');
      return res.data as DemoStatus;
    },
  });
}
