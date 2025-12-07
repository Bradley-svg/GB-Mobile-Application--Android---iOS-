import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { AlertsScreen } from '../screens/Alerts/AlertsScreen';
import { useAlerts } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata, isCacheOlderThan } from '../utils/storage';

jest.mock('../api/hooks');
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

const buildAlerts = (count: number) =>
  Array.from({ length: count }).map((_, idx) => ({
    id: `alert-${idx}`,
    site_id: `site-${idx % 3}`,
    device_id: `device-${idx}`,
    severity: idx % 2 === 0 ? 'warning' : 'critical',
    type: 'sensor',
    message: `Alert message ${idx}`,
    status: 'active',
    first_seen_at: '2025-01-01T00:00:00.000Z',
    last_seen_at: '2025-01-01T00:10:00.000Z',
    acknowledged_by: null,
    acknowledged_at: null,
    muted_until: null,
  }));

describe('Alerts large list rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
  });

  it('virtualizes a long list of alerts', () => {
    const alerts = buildAlerts(600);
    (useAlerts as jest.Mock).mockReturnValue({
      data: alerts,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AlertsScreen />);

    const list = screen.UNSAFE_getByType(FlatList);
    const props: FlatList['props'] = list.props;
    expect(props.data?.length).toBe(alerts.length);
    expect(props.initialNumToRender).toBeLessThan(alerts.length);
    expect(props.windowSize).toBeGreaterThan(0);

    const rendered = screen.getAllByTestId('alert-card');
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('shows cached alerts when offline with a large list', async () => {
    const cachedAlerts = buildAlerts(320);
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useAlerts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({ data: cachedAlerts, savedAt: new Date().toISOString() });

    render(<AlertsScreen />);

    await waitFor(() =>
      expect(screen.getByText(/Offline - showing cached alerts/i)).toBeTruthy()
    );

    const rendered = screen.getAllByTestId('alert-card');
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('filters cached alerts client-side when offline', async () => {
    const cachedAlerts = [
      {
        id: 'alert-1',
        site_id: 'site-1',
        device_id: 'device-1',
        severity: 'warning',
        type: 'sensor',
        message: 'Warning alert',
        status: 'active',
        first_seen_at: '2025-01-01T00:00:00.000Z',
        last_seen_at: '2025-01-01T00:10:00.000Z',
        acknowledged_by: null,
        acknowledged_at: null,
        muted_until: null,
      },
      {
        id: 'alert-2',
        site_id: 'site-1',
        device_id: 'device-2',
        severity: 'critical',
        type: 'sensor',
        message: 'Critical alert',
        status: 'active',
        first_seen_at: '2025-01-01T00:05:00.000Z',
        last_seen_at: '2025-01-01T00:15:00.000Z',
        acknowledged_by: null,
        acknowledged_at: null,
        muted_until: null,
      },
    ];
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useAlerts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({ data: cachedAlerts, savedAt: new Date().toISOString() });

    render(<AlertsScreen />);

    await waitFor(() => expect(screen.getAllByTestId('alert-card').length).toBe(2));

    fireEvent.press(screen.getByTestId('pill-critical'));

    await waitFor(() => expect(screen.queryByText('Warning alert')).toBeNull());
    expect(screen.getAllByTestId('alert-card').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Critical alert')).toBeTruthy();
  });

  it('shows stale banner when cached alerts are old', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useAlerts as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: buildAlerts(1),
      savedAt: '2025-01-01T00:00:00.000Z',
    });
    (isCacheOlderThan as jest.Mock).mockReturnValue(true);

    render(<AlertsScreen />);

    expect(await screen.findByText(/Data older than 24 hours/i)).toBeTruthy();
  });
});
