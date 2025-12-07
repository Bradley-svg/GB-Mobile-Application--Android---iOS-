import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../screens/Search/SearchScreen';
import { useFleetSearch } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata } from '../utils/storage';

jest.mock('../api/hooks', () => ({
  useFleetSearch: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useFleetSearch as jest.Mock).mockReturnValue({
      data: { sites: [], devices: [], meta: { siteCount: 0, deviceCount: 0 } },
      isLoading: false,
      isError: false,
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
  });

  it('shows prompt when no results yet', () => {
    render(<SearchScreen />);

    expect(screen.getByTestId('search-empty')).toBeTruthy();
    expect(screen.getByText(/Start typing to search/i)).toBeTruthy();
  });

  it('renders site and device results', () => {
    (useFleetSearch as jest.Mock).mockReturnValue({
      data: {
        sites: [{ id: 'site-1', name: 'Demo Site', city: 'CT', health: 'healthy' }],
        devices: [{ id: 'dev-1', deviceId: 'dev-1', name: 'Pump', site_name: 'Demo Site', health: 'warning' }],
        meta: { siteCount: 1, deviceCount: 1 },
      },
      isLoading: false,
      isError: false,
    });

    render(<SearchScreen />);

    expect(screen.getByTestId('search-results')).toBeTruthy();
    expect(screen.getByText('Demo Site')).toBeTruthy();
    expect(screen.getByText('Pump')).toBeTruthy();
  });

  it('shows no-results state when search completes with empty payload', () => {
    (useFleetSearch as jest.Mock).mockReturnValue({
      data: { sites: [], devices: [], meta: { siteCount: 0, deviceCount: 0 } },
      isLoading: false,
      isError: false,
    });

    render(<SearchScreen />);

    expect(screen.getByText(/No results found/i)).toBeTruthy();
  });

  it('supports offline cached search', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: {
        sites: [{ id: 'site-2', name: 'Cached Site', city: 'Joburg', health: 'offline' }],
        devices: [],
      },
      savedAt: '2025-01-01T00:00:00.000Z',
    });

    render(<SearchScreen />);

    await waitFor(() => expect(screen.getByText('Cached Site')).toBeTruthy());
    expect(screen.getByText(/Offline search/)).toBeTruthy();
  });

  it('shows offline empty state when no cache exists', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);

    render(<SearchScreen />);

    expect(await screen.findByTestId('search-offline-empty')).toBeTruthy();
  });
});
