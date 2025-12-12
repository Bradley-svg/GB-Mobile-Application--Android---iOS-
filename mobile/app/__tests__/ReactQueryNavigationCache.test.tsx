import React from 'react';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import { api } from '../api/client';
import { useSites } from '../api/hooks';

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: () => ({ isOffline: false }),
}));

const SitesConsumer = ({ label }: { label: string }) => {
  const { data, isFetching } = useSites();
  return <Text testID="sites-consumer">{`${label}:${data?.length ?? 0}:${isFetching}`}</Text>;
};

describe('React Query navigation cache', () => {
  const apiGetSpy = jest.spyOn(api, 'get');

  beforeEach(() => {
    apiGetSpy.mockReset();
    apiGetSpy.mockResolvedValue({ data: [{ id: 'site-1', name: 'Site 1' }] });
  });

  it('reuses cached sites data when remounting within the stale window', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60 * 1000 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { rerender, getByTestId } = render(<SitesConsumer label="first" />, { wrapper });

    await waitFor(() => expect(getByTestId('sites-consumer')).toHaveTextContent('first:1:false'));
    expect(apiGetSpy).toHaveBeenCalledTimes(1);

    rerender(<SitesConsumer label="second" />);
    await waitFor(() => expect(getByTestId('sites-consumer')).toHaveTextContent('second:1:false'));
    expect(apiGetSpy).toHaveBeenCalledTimes(1);

    client.clear();
  });

  it('avoids duplicate fetches when navigating away and back within the stale window', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60 * 1000 } },
    });

    const Harness = ({ showSites }: { showSites: boolean }) => (
      <QueryClientProvider client={client}>
        {showSites ? <SitesConsumer label="dashboard" /> : <Text testID="device-screen">Device screen</Text>}
      </QueryClientProvider>
    );

    const { rerender, getByTestId } = render(<Harness showSites />, { wrapper: ({ children }) => <>{children}</> });

    await waitFor(() => expect(getByTestId('sites-consumer')).toHaveTextContent('dashboard:1:false'));
    expect(apiGetSpy).toHaveBeenCalledTimes(1);

    rerender(<Harness showSites={false} />);
    await waitFor(() => expect(getByTestId('device-screen')).toBeTruthy());

    rerender(<Harness showSites />);
    await waitFor(() => expect(getByTestId('sites-consumer')).toHaveTextContent('dashboard:1:false'));
    expect(apiGetSpy).toHaveBeenCalledTimes(1);

    client.clear();
  });
});
