import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { FleetSearchResult, HealthStatus } from '../types';

type FleetSearchParams = {
  q?: string;
  health?: HealthStatus[];
  tag?: string | null;
  enabled?: boolean;
};

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

export function useFleetSearch(params: FleetSearchParams) {
  const { q, health, tag, enabled = true } = params;
  return useQuery<FleetSearchResult>({
    queryKey: ['fleet', q, health?.join(','), tag],
    queryFn: async () => {
      const res = await api.get('/fleet', {
        params: {
          q: q?.trim() || undefined,
          health: health && health.length > 0 ? health : undefined,
          tag: tag || undefined,
        },
      });
      return res.data;
    },
    enabled,
    retry: shouldRetry,
    retryDelay,
  });
}
