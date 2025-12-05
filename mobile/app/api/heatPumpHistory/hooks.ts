import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { HeatPumpHistoryRequest, HeatPumpHistoryResponse } from '../types';

export type HeatPumpHistoryError = {
  status?: number;
  message?: string;
  original?: unknown;
  kind?: 'unavailable' | 'otherError';
};

const HEAT_PUMP_HISTORY_QUERY_KEY = ['heatPumpHistory'];

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

export function useHeatPumpHistory(
  params: HeatPumpHistoryRequest,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...HEAT_PUMP_HISTORY_QUERY_KEY, params],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<HeatPumpHistoryResponse> => {
      try {
        const response = await api.post<HeatPumpHistoryResponse>('/heat-pump-history', {
          ...params,
          aggregation: params.aggregation ?? 'raw',
          mode: params.mode ?? 'live',
        });
        return response.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const message = err.response?.data?.message || err.message;
          const kind: HeatPumpHistoryError['kind'] =
            status === 502 || status === 503 ? 'unavailable' : 'otherError';
          throw { status, message, original: err, kind } as HeatPumpHistoryError;
        }
        throw { original: err, kind: 'otherError' } as HeatPumpHistoryError;
      }
    },
    retry: shouldRetry,
    retryDelay,
  });
}
