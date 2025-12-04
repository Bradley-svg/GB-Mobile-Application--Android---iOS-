import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { HeatPumpHistoryRequest, HeatPumpHistoryResponse } from '../types';

const HEAT_PUMP_HISTORY_QUERY_KEY = ['heatPumpHistory'];

export function useHeatPumpHistory(
  params: HeatPumpHistoryRequest,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...HEAT_PUMP_HISTORY_QUERY_KEY, params],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const response = await api.post<HeatPumpHistoryResponse>('/heat-pump-history', {
        ...params,
        aggregation: params.aggregation ?? 'raw',
        mode: params.mode ?? 'live',
      });
      return response.data;
    },
  });
}
