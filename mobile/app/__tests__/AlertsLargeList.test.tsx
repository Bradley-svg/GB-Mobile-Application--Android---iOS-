import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { AlertsScreen } from '../screens/Alerts/AlertsScreen';
import { useAlerts } from '../api/hooks';
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
    (loadJson as jest.Mock).mockResolvedValue(null);
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
    (loadJson as jest.Mock).mockResolvedValue(cachedAlerts);

    render(<AlertsScreen />);

    await waitFor(() =>
      expect(screen.getByText(/Offline - showing cached alerts/i)).toBeTruthy()
    );

    const rendered = screen.getAllByTestId('alert-card');
    expect(rendered.length).toBeGreaterThan(0);
  });
});
