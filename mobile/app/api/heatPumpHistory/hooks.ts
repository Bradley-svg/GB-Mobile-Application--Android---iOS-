import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { HeatPumpHistoryRequest, HeatPumpHistoryResponse } from '../types';

export type HeatPumpHistoryError = {
  status?: number;
  message?: string;
  original?: unknown;
  kind?: 'circuitOpen' | 'upstream' | 'unavailable' | 'otherError';
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

type UseHeatPumpHistoryOptions = {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
};

export function useHeatPumpHistory(
  params: HeatPumpHistoryRequest,
  options?: UseHeatPumpHistoryOptions
) {
  const aggregation = params.aggregation ?? 'raw';
  const mode = params.mode ?? 'live';
  const normalizedParams: HeatPumpHistoryRequest = { ...params, aggregation, mode };
  const isLive = mode === 'live';
  const resolvedStaleTime = options?.staleTime ?? (isLive ? 15_000 : 60_000);
  const resolvedRefetchInterval =
    options?.refetchInterval ?? (isLive ? 15_000 : false);

  return useQuery({
    queryKey: [...HEAT_PUMP_HISTORY_QUERY_KEY, normalizedParams],
    enabled: options?.enabled ?? true,
    staleTime: resolvedStaleTime,
    refetchInterval: resolvedRefetchInterval,
    queryFn: async (): Promise<HeatPumpHistoryResponse> => {
      try {
        const response = await api.post<HeatPumpHistoryResponse>('/heat-pump-history', {
          ...normalizedParams,
        });
        return response.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const message = err.response?.data?.message || err.message;
          let kind: HeatPumpHistoryError['kind'] = 'otherError';
          if (status === 503) {
            kind = 'circuitOpen';
          } else if (status === 502) {
            kind = 'upstream';
          } else if (status && status >= 500) {
            kind = 'unavailable';
          }
          throw { status, message, original: err, kind } as HeatPumpHistoryError;
        }
        throw { original: err, kind: 'otherError' } as HeatPumpHistoryError;
      }
    },
    retry: shouldRetry,
    retryDelay,
  });
}
