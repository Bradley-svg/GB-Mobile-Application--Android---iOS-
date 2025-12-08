import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceTelemetry,
  useModeCommand,
  useSetpointCommand,
  useDeviceSchedule,
  useUpsertDeviceSchedule,
  useDeviceCommands,
  useSite,
  useHeatPumpHistory,
} from '../api/hooks';
import * as navigation from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';
import type { HeatPumpHistoryRequest } from '../api/types';
import { useNetworkBanner } from '../hooks/useNetworkBanner';

jest.mock('../api/hooks', () => ({
  useDevice: jest.fn(),
  useDeviceAlerts: jest.fn(),
  useDeviceTelemetry: jest.fn(),
  useModeCommand: jest.fn(),
  useSetpointCommand: jest.fn(),
  useDeviceSchedule: jest.fn(),
  useUpsertDeviceSchedule: jest.fn(),
  useDeviceCommands: jest.fn(),
  useSite: jest.fn(),
  useHeatPumpHistory: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
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
  const renderDeviceDetail = async () => {
    render(<DeviceDetailScreen />);
    await act(async () => {});
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });

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

    (useDeviceSchedule as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    (useUpsertDeviceSchedule as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useDeviceCommands as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
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

  it('passes the device MAC and live/raw params to the history hook', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    await renderDeviceDetail();

    const [params] = (useHeatPumpHistory as jest.Mock).mock.calls[0] as [
      HeatPumpHistoryRequest,
      { enabled: boolean }
    ];
    expect(params.mac).toBe(baseDevice.mac);
    expect(params.mode).toBe('live');
    expect(params.aggregation).toBe('raw');
    expect(params.fields[0].field).toBe('metric_compCurrentA');
    expect(params.to).toBe('2025-01-01T12:00:00.000Z');
    expect(params.from).toBe('2024-12-31T12:00:00.000Z');

    jest.useRealTimers();
  });

  it('renders compressor current chart when history data exists', async () => {
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

    await renderDeviceDetail();

    expect(screen.getByText('Compressor current (A)')).toBeTruthy();
    expect(screen.queryByText('No history for this period.')).toBeNull();
    expect(screen.getByTestId('heatPumpHistoryChart')).toBeTruthy();
  });

  it('shows placeholder when no history points are available', async () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: { series: [] },
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    expect(screen.getByText('Compressor current (A)')).toBeTruthy();
    expect(screen.getByText('No history for this period.')).toBeTruthy();
  });

  it('shows an inline error when the history request fails', async () => {
    const refetchMock = jest.fn();
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      error: { status: 500, message: 'boom' },
    });

    await renderDeviceDetail();

    expect(screen.getByText('Could not load heat pump history.')).toBeTruthy();
    expect(screen.getByText(/failed to load history/i)).toBeTruthy();
    const retry = screen.getByText('Retry');
    fireEvent.press(retry);
    expect(refetchMock).toHaveBeenCalled();
  });

  it('shows a temporary unavailable message when backend returns 503', async () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 503, message: 'circuit open' },
    });

    await renderDeviceDetail();

    expect(screen.getByText(/History unavailable, please try again later/i)).toBeTruthy();
  });

  it('shows an upstream failure message for 502 errors', async () => {
    (useHeatPumpHistory as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 502, message: 'upstream failed' },
    });

    await renderDeviceDetail();

    expect(screen.getByText(/History temporarily unavailable/i)).toBeTruthy();
  });

  it('disables history when mac is missing', async () => {
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

    await renderDeviceDetail();

    expect(useHeatPumpHistory).toHaveBeenCalled();
    const [, options] = (useHeatPumpHistory as jest.Mock).mock.calls[0] as [
      unknown,
      { enabled: boolean }
    ];
    expect(options.enabled).toBe(false);
    expect(screen.getByText(/History unavailable for this device/i)).toBeTruthy();
  });

  it('allows selecting 1h, 24h, and 7d ranges for telemetry and history', async () => {
    await renderDeviceDetail();

    expect((useDeviceTelemetry as jest.Mock).mock.calls[0][1]).toBe('24h');

    fireEvent.press(screen.getByText(/1h/i));
    fireEvent.press(screen.getByText(/7d/i));

    const ranges = (useDeviceTelemetry as jest.Mock).mock.calls.map(([, r]: [string, string]) => r);
    expect(ranges).toContain('1h');
    expect(ranges).toContain('24h');
    expect(ranges).toContain('7d');
  });

  it('shows a stale warning when telemetry is older than fifteen minutes', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-01T12:00:00Z').getTime());
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: {
        range: '24h',
        metrics: {
          supply_temp: [{ ts: '2025-01-01T11:00:00Z', value: 40 }],
          return_temp: [],
          power_kw: [],
          flow_rate: [],
          cop: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    expect(screen.getByText(/older than 15 minutes/i)).toBeTruthy();
  });

  it('does not show the stale warning when telemetry is recent', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-01T12:00:00Z').getTime());
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: {
        range: '24h',
        metrics: {
          supply_temp: [{ ts: '2025-01-01T11:55:00Z', value: 42 }],
          return_temp: [],
          power_kw: [],
          flow_rate: [],
          cop: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    expect(screen.queryByText(/older than 15 minutes/i)).toBeNull();
  });

  it('shows an unknown last updated message when telemetry timestamps are missing but history exists', async () => {
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

    await renderDeviceDetail();

    expect(screen.getByText(/Last updated time unavailable/i)).toBeTruthy();
  });

  it('renders control history rows with failure reasons', async () => {
    (useDeviceCommands as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'cmd-1',
          device_id: baseDevice.id,
          status: 'success',
          command_type: 'setpoint',
          requested_value: { metric: 'flow_temp', value: 48 },
          payload: { metric: 'flow_temp', value: 48 },
          requested_at: '2025-01-01T00:00:00.000Z',
          completed_at: '2025-01-01T00:01:00.000Z',
          failure_reason: null,
          failure_message: null,
          actor: { id: 'user-1', email: 'demo@example.com', name: 'Demo' },
        },
        {
          id: 'cmd-2',
          device_id: baseDevice.id,
          status: 'failed',
          command_type: 'mode',
          requested_value: { mode: 'OFF' },
          payload: { mode: 'OFF' },
          requested_at: '2025-01-02T00:00:00.000Z',
          completed_at: '2025-01-02T00:01:00.000Z',
          failure_reason: 'THROTTLED',
          failure_message: 'throttled',
          actor: { id: 'user-1', email: 'demo@example.com', name: 'Demo' },
        },
      ],
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    expect(screen.getByText(/Setpoint 48/)).toBeTruthy();
    expect(screen.getByText(/THROTTLED/)).toBeTruthy();
    expect(screen.getByText(/throttled/)).toBeTruthy();
  });

  it('shows offline placeholder when no cached history exists', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useDeviceCommands as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    });

    await renderDeviceDetail();

    expect(screen.getAllByText(/History unavailable while offline/i).length).toBeGreaterThan(0);
  });
});
