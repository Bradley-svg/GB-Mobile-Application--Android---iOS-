import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

jest.mock('../api/hooks', () => ({
  useDevice: jest.fn(),
  useDeviceAlerts: jest.fn(),
  useDeviceTelemetry: jest.fn(),
  useModeCommand: jest.fn(),
  useSetpointCommand: jest.fn(),
  useSite: jest.fn(),
  useHeatPumpHistory: jest.fn(),
}));

const baseDevice = {
  id: '33333333-3333-3333-3333-333333333333',
  site_id: 'site-1',
  name: 'Demo Heat Pump',
  type: 'heat_pump',
  status: 'online',
  external_id: 'demo-device-1',
  mac: '38:18:2B:60:A9:94',
};

describe('DeviceDetailScreen heat pump history', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const route: RouteProp<AppStackParamList, 'DeviceDetail'> = {
      key: 'DeviceDetail',
      name: 'DeviceDetail',
      params: { deviceId: baseDevice.id },
    };

    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);

    (useDevice as jest.Mock).mockReturnValue({
      data: baseDevice,
      isLoading: false,
      isError: false,
    });

    (useSite as jest.Mock).mockReturnValue({
      data: { id: 'site-1', name: 'Demo Site', city: 'Cape Town' },
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders compressor current chart when history data exists', () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: {
        series: [
          {
            field: 'metric_compCurrentA',
            points: [{ timestamp: '2025-12-03T08:12:46.503Z', value: 12.3 }],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<DeviceDetailScreen />);

    expect(screen.getByText('Compressor current (A)')).toBeTruthy();
    expect(screen.queryByText('No history data for this period.')).toBeNull();
    expect(screen.getByTestId('heatPumpHistoryChart')).toBeTruthy();
  });

  it('shows placeholder when no history points are available', () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: { series: [] },
      isLoading: false,
      isError: false,
    });

    render(<DeviceDetailScreen />);

    expect(screen.getByText('Compressor current (A)')).toBeTruthy();
    expect(screen.getByText('No history data for this period.')).toBeTruthy();
  });

  it('shows an inline error when the history request fails', () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<DeviceDetailScreen />);

    expect(screen.getByText('Could not load heat pump history.')).toBeTruthy();
  });

  it('disables history when mac is missing', () => {
    (useDevice as jest.Mock).mockReturnValue({
      data: { ...baseDevice, mac: null },
      isLoading: false,
      isError: false,
    });

    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<DeviceDetailScreen />);

    expect(useHeatPumpHistory).toHaveBeenCalled();
    const [, options] = (useHeatPumpHistory as jest.Mock).mock.calls[0] as [
      unknown,
      { enabled: boolean }
    ];
    expect(options.enabled).toBe(false);
    expect(screen.getByText('No history data for this period.')).toBeTruthy();
  });
});
