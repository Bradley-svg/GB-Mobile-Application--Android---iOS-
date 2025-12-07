import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { useAlerts, useSites } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata } from '../utils/storage';

jest.mock('../api/hooks');
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

describe('Dashboard large list rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
    (useAlerts as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('renders a large list of sites without mounting every item', () => {
    const sites = Array.from({ length: 800 }).map((_, idx) => ({
      id: `site-${idx}`,
      name: `Site ${idx}`,
      city: 'Demo City',
      status: 'online',
      last_seen_at: '2025-01-01T00:00:00.000Z',
      health: 'healthy',
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
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({ data: cachedSites, savedAt: new Date().toISOString() });

    render(<DashboardScreen />);

    await waitFor(() => expect(screen.getByTestId('dashboard-offline-banner')).toBeTruthy());
    expect(screen.getByText('Cached Site')).toBeTruthy();
  });

  it('surfaces health counters from site data', () => {
    const sites = [
      { id: 'site-1', name: 'Healthy', city: 'CT', status: 'online', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'healthy' },
      { id: 'site-2', name: 'Warning', city: 'CT', status: 'warn', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'warning' },
      { id: 'site-3', name: 'Critical', city: 'CT', status: 'crit', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'critical' },
      { id: 'site-4', name: 'Offline', city: 'CT', status: 'offline', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'offline' },
    ];
    (useSites as jest.Mock).mockReturnValue({
      data: sites,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<DashboardScreen />);

    expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
  });

  it('renders connectivity pills for site cards', () => {
    const sites = [
      { id: 'site-1', name: 'Healthy', city: 'CT', status: 'online', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'healthy' },
      { id: 'site-2', name: 'Offline', city: 'CT', status: 'offline', last_seen_at: '2025-01-01T00:00:00.000Z', health: 'offline' },
    ];
    (useSites as jest.Mock).mockReturnValue({
      data: sites,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<DashboardScreen />);

    expect(screen.getAllByText(/Online/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Offline/i).length).toBeGreaterThan(0);
  });
});
