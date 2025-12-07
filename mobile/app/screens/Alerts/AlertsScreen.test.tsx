import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AlertsScreen } from './AlertsScreen';
import { useAlerts } from '../../api/hooks';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJson, loadJsonWithMetadata } from '../../utils/storage';

jest.mock('../../api/hooks');
jest.mock('../../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../../utils/storage', () => ({
  loadJson: jest.fn(),
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

describe('AlertsScreen states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJson as jest.Mock).mockResolvedValue(null);
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
  });

  it('shows error card with retry', () => {
    const refetchMock = jest.fn();
    (useAlerts as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });

    render(<AlertsScreen />);

    fireEvent.press(screen.getByText('Retry'));
    expect(refetchMock).toHaveBeenCalled();
    expect(screen.getByTestId('alerts-error')).toBeTruthy();
  });

  it('shows empty state when no alerts', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AlertsScreen />);

    expect(screen.getByTestId('alerts-empty')).toBeTruthy();
  });

  it('shows cached alerts when offline with stored data', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'alert-1',
          site_id: 'site-1',
          device_id: 'device-1',
          severity: 'warning',
          type: 'sensor',
          message: 'Cached alert',
          status: 'active',
          first_seen_at: '2025-01-01T00:00:00.000Z',
          last_seen_at: '2025-01-01T01:00:00.000Z',
          acknowledged_by: null,
          acknowledged_at: null,
          muted_until: null,
        },
      ],
      savedAt: '2025-01-01T00:00:00.000Z',
    });
    (useAlerts as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AlertsScreen />);

    expect(await screen.findByText('Offline - showing cached alerts (read-only).')).toBeTruthy();
    expect(screen.getByText('Cached alert')).toBeTruthy();
  });

  it('shows offline message when there is no cached alert data', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
    (useAlerts as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AlertsScreen />);

    const offlineMessages = await screen.findAllByText('Offline and no cached alerts.');
    expect(offlineMessages.length).toBeGreaterThan(0);
  });
});
