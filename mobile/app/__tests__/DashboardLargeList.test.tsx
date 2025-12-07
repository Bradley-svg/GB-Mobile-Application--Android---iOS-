import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { useAlerts, useSites } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJson } from '../utils/storage';

jest.mock('../api/hooks');
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  loadJson: jest.fn(),
  saveJson: jest.fn(),
}));

describe('Dashboard large list rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJson as jest.Mock).mockResolvedValue(null);
    (useAlerts as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('renders a large list of sites without mounting every item', () => {
    const sites = Array.from({ length: 800 }).map((_, idx) => ({
      id: `site-${idx}`,
      name: `Site ${idx}`,
      city: 'Demo City',
      status: 'online',
      last_seen_at: '2025-01-01T00:00:00.000Z',
    }));
    (useSites as jest.Mock).mockReturnValue({
      data: sites,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<DashboardScreen />);

    const list = screen.UNSAFE_getByType(FlatList);
    const listProps: FlatList['props'] = list.props;
    expect(listProps.data?.length).toBe(sites.length);
    expect(listProps.initialNumToRender).toBeLessThan(sites.length);
    expect(listProps.maxToRenderPerBatch).toBeGreaterThan(0);
    expect(listProps.windowSize).toBeGreaterThan(0);

    const renderedCards = screen.getAllByTestId('site-card');
    expect(renderedCards.length).toBeGreaterThan(0);
  });

  it('shows cached sites with an offline banner', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useSites as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const cachedSites = [
      { id: 'site-1', name: 'Cached Site', city: 'Offline City', status: 'online', last_seen_at: '2025-01-01T00:00:00.000Z' },
    ];
    (loadJson as jest.Mock).mockResolvedValue(cachedSites);

    render(<DashboardScreen />);

    await waitFor(() => expect(screen.getByTestId('dashboard-offline-banner')).toBeTruthy());
    expect(screen.getByText('Cached Site')).toBeTruthy();
  });
});
