import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DemoStatus } from '../types';

export const DEMO_STATUS_QUERY_KEY = ['demo-status'];

export function useDemoStatus(options?: { enabled?: boolean }) {
  return useQuery<DemoStatus | null>({
    queryKey: DEMO_STATUS_QUERY_KEY,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await api.get('/demo/status');
        return res.data as DemoStatus;
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          (err.response?.status === 401 || err.response?.status === 403)
        ) {
          return null;
        }
        throw err;
      }
    },
  });
}
