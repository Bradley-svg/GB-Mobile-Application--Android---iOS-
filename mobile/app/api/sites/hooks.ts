import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ApiSite } from '../types';

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

export function useSites() {
  return useQuery<ApiSite[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get('/sites');
      return res.data;
    },
    retry: shouldRetry,
    retryDelay,
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
    retry: shouldRetry,
    retryDelay,
  });
}
