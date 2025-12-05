import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceTelemetry,
  useModeCommand,
  useSetpointCommand,
  useSite,
  useHeatPumpHistory,
} from '../api/hooks';
import * as navigation from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJson } from '../utils/storage';

jest.mock('../api/hooks', () => ({
  useDevice: jest.fn(),
  useDeviceAlerts: jest.fn(),
  useDeviceTelemetry: jest.fn(),
  useModeCommand: jest.fn(),
  useSetpointCommand: jest.fn(),
  useSite: jest.fn(),
  useHeatPumpHistory: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

jest.mock('../utils/storage', () => ({
  loadJson: jest.fn(),
  saveJson: jest.fn(),
}));

describe('DeviceDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJson as jest.Mock).mockResolvedValue(null);

    const route: RouteProp<AppStackParamList, 'DeviceDetail'> = {
      key: 'DeviceDetail',
      name: 'DeviceDetail',
      params: { deviceId: 'device-1' },
    };

    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);

    (useDevice as jest.Mock).mockReturnValue({
      data: {
        id: 'device-1',
        site_id: 'site-1',
        name: 'Heat Pump',
        type: 'hp',
        status: 'ok',
        mac: '38:18:2B:60:A9:94',
        last_seen_at: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    });

    (useSite as jest.Mock).mockReturnValue({
      data: { id: 'site-1', name: 'Test Site', city: 'Cape Town' },
      isLoading: false,
      isError: false,
    });

    (useDeviceAlerts as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: {
        range: '24h',
        metrics: {
          supply_temp: [],
          return_temp: [],
          power_kw: [],
          flow_rate: [],
          cop: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    (useSetpointCommand as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useModeCommand as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: { series: [] },
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows placeholders when telemetry metrics are empty', () => {
    render(<DeviceDetailScreen />);

    const placeholders = screen.getAllByText('No data for this metric in the selected range.');
    expect(placeholders).toHaveLength(4);
  });

  it('prevents out-of-range setpoint updates', () => {
    const setpointMock = jest.fn();
    (useSetpointCommand as jest.Mock).mockReturnValue({
      mutateAsync: setpointMock,
      isPending: false,
    });

    render(<DeviceDetailScreen />);

    fireEvent.changeText(screen.getByTestId('setpoint-input'), '10');
    fireEvent.press(screen.getByText('Update setpoint'));

    expect(setpointMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Flow temperature must be between 30-60/)).toBeTruthy();
  });

  it('shows telemetry error with retry action', () => {
    const refetchMock = jest.fn();
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      error: new Error('fail'),
    });

    render(<DeviceDetailScreen />);

    const retryButton = screen.getByText('Retry');
    fireEvent.press(retryButton);
    expect(refetchMock).toHaveBeenCalled();
    expect(screen.getByTestId('telemetry-error')).toBeTruthy();
  });

  it('renders cached data when offline and disables commands', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    const cachedTelemetry = {
      range: '24h',
      metrics: {
        supply_temp: [{ ts: '2025-01-01T00:00:00.000Z', value: 48 }],
        return_temp: [],
        power_kw: [],
        flow_rate: [],
        cop: [],
      },
    };
    (loadJson as jest.Mock).mockResolvedValue({
      device: {
        id: 'device-1',
        site_id: 'site-1',
        name: 'Cached Device',
        type: 'hp',
        status: 'ok',
        mac: '38:18:2B:60:A9:94',
      },
      telemetry: cachedTelemetry,
      lastUpdatedAt: '2025-01-01T00:00:00.000Z',
      cachedAt: '2025-01-01T01:00:00.000Z',
    });
    (useDevice as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: { series: [] },
      isLoading: false,
      isError: false,
    });

    render(<DeviceDetailScreen />);

    expect(await screen.findByText('Offline - showing cached data (read-only).')).toBeTruthy();
    expect(screen.getByText('Cached Device')).toBeTruthy();
    expect(screen.getByText('Commands unavailable while offline.')).toBeTruthy();
    const setpointButton = screen.getByTestId('setpoint-button');
    expect(setpointButton.props.disabled).toBe(true);
  });

  it('shows offline empty state when no cached device exists', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJson as jest.Mock).mockResolvedValue(null);
    (useDevice as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<DeviceDetailScreen />);

    expect(await screen.findByText('Offline and no cached data for this device.')).toBeTruthy();
  });
});
