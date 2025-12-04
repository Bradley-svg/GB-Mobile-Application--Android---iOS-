import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ApiSite } from '../types';

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
