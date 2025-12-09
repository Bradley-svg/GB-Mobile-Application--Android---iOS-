import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { SiteOverviewScreen } from '../screens/Site/SiteOverviewScreen';
import { useDevices, useSite } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson } from '../utils/storage';

jest.mock('../api/hooks', () => ({
  useDevices: jest.fn(),
  useSite: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.requireActual('../utils/storage').isCacheOlderThan,
}));

describe('SiteOverviewScreen guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigation.useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
    });
    (navigation.useRoute as jest.Mock).mockReturnValue({
      key: 'SiteOverview',
      name: 'SiteOverview',
      params: {},
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (saveJson as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders an ErrorCard when site params are missing', () => {
    (useSite as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<SiteOverviewScreen />);

    expect(screen.getByTestId('site-missing')).toBeTruthy();
  });

  it('shows the error surface when site fetch fails', () => {
    const refetchSite = jest.fn();
    const refetchDevices = jest.fn();
    (navigation.useRoute as jest.Mock).mockReturnValue({
      key: 'SiteOverview',
      name: 'SiteOverview',
      params: { siteId: 'site-1' },
    });
    (useSite as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchSite,
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchDevices,
    });

    render(<SiteOverviewScreen />);

    expect(screen.getByTestId('site-error')).toBeTruthy();
    fireEvent.press(screen.getByText(/Retry/i));
    expect(refetchSite).toHaveBeenCalled();
    expect(refetchDevices).toHaveBeenCalled();
  });

  it('falls back safely when offline with no cached data', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      key: 'SiteOverview',
      name: 'SiteOverview',
      params: { siteId: 'site-2' },
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useSite as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);

    render(<SiteOverviewScreen />);

    await waitFor(() => expect(screen.getByText(/Site data unavailable offline/i)).toBeTruthy());
  });

  it('shows empty state when site has no devices', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      key: 'SiteOverview',
      name: 'SiteOverview',
      params: { siteId: 'site-3' },
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useSite as jest.Mock).mockReturnValue({
      data: { id: 'site-3', name: 'Demo Site', city: null, status: 'online', health: 'healthy' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<SiteOverviewScreen />);

    await waitFor(() => expect(screen.getByTestId('site-empty')).toBeTruthy());
    expect(screen.getByText(/Demo Site/i)).toBeTruthy();
  });
});
