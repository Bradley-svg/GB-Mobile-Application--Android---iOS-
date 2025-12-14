import React from 'react';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { useHeatPumpHistory } from '../api/heatPumpHistory/hooks';
import { api } from '../api/client';
import type { HeatPumpHistoryResponse } from '../api/types';

const historyResponse: HeatPumpHistoryResponse = {
  series: [
    {
      field: 'metric_compCurrentA',
      points: [{ timestamp: '2025-12-03T08:12:46.503Z', value: 12.3 }],
    },
  ],
};

const requestBody = {
  deviceId: 'device-123',
  from: '2025-12-03T08:12:46.503Z',
  to: '2025-12-03T14:12:46.503Z',
  fields: [{ field: 'metric_compCurrentA' }],
};

const HistoryProbe = () => {
  const { data, isLoading } = useHeatPumpHistory(requestBody);

  if (isLoading) {
    return <Text>Loading history...</Text>;
  }

  return (
    <Text>
      Value: {data?.series?.[0]?.points?.[0]?.value} @ {data?.series?.[0]?.points?.[0]?.timestamp}
    </Text>
  );
};

describe('useHeatPumpHistory', () => {
  it('posts to the backend and returns history data', async () => {
    const postSpy = jest.spyOn(api, 'post').mockResolvedValue({ data: historyResponse });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    const { findByText, unmount } = render(
      <QueryClientProvider client={client}>
        <HistoryProbe />
      </QueryClientProvider>
    );

    expect(
      await findByText('Value: 12.3 @ 2025-12-03T08:12:46.503Z')
    ).toBeTruthy();

    expect(postSpy).toHaveBeenCalledWith('/heat-pump-history', {
      ...requestBody,
      aggregation: 'raw',
      mode: 'live',
    });

    postSpy.mockRestore();
    unmount();
    client.clear();
  });

  it('polls in live mode using the refetch interval', async () => {
    jest.useFakeTimers();
    const postSpy = jest.spyOn(api, 'post').mockResolvedValue({ data: historyResponse });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    const { findByText, unmount } = render(
      <QueryClientProvider client={client}>
        <HistoryProbe />
      </QueryClientProvider>
    );

    expect(
      await findByText('Value: 12.3 @ 2025-12-03T08:12:46.503Z')
    ).toBeTruthy();

    expect(postSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(16_000);
    });

    expect(postSpy).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
    postSpy.mockRestore();
    unmount();
    client.clear();
  });
});
