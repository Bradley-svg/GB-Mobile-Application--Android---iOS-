import React from 'react';
import { Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { useDeviceTelemetry } from '../api/hooks';
import { api } from '../api/client';

const TelemetryProbe = () => {
  const { data, isLoading } = useDeviceTelemetry('device-1', '24h');

  if (isLoading) {
    return <Text>Loading telemetry...</Text>;
  }

  return (
    <View>
      <Text>Range: {data?.range}</Text>
      <Text>Supply: {data?.metrics?.supply_temp?.[0]?.value}</Text>
    </View>
  );
};

describe('API hooks', () => {
  it('renders device telemetry from a mocked API response', async () => {
    const getSpy = jest.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        range: '24h',
        metrics: {
          supply_temp: [{ ts: '2025-01-01T00:00:00.000Z', value: 42.5 }],
        },
      },
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { findByText } = render(
      <QueryClientProvider client={client}>
        <TelemetryProbe />
      </QueryClientProvider>
    );

    expect(await findByText('Range: 24h')).toBeTruthy();
    expect(await findByText('Supply: 42.5')).toBeTruthy();

    getSpy.mockRestore();
    client.clear();
  });
});
