import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
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
  useWorkOrdersList,
  useHealthPlus,
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
  useWorkOrdersList: jest.fn(),
  useHealthPlus: jest.fn(),
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

    (useHealthPlus as jest.Mock).mockReturnValue({
      data: {
        ok: true,
        env: 'test',
        version: 'test',
        mqtt: {
          configured: false,
          healthy: true,
          lastIngestAt: null,
          lastErrorAt: null,
          lastError: null,
        },
        control: {
          configured: false,
          healthy: true,
          lastCommandAt: null,
          lastErrorAt: null,
          lastError: null,
        },
        heatPumpHistory: {
          configured: true,
          disabled: false,
          healthy: true,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastError: null,
          lastCheckAt: null,
        },
        alertsWorker: {
          healthy: true,
          lastHeartbeatAt: null,
        },
        push: {
          enabled: false,
          lastSampleAt: null,
          lastError: null,
        },
        antivirus: {
          configured: false,
          enabled: false,
          target: null,
          lastRunAt: null,
          lastResult: null,
          lastError: null,
          latencyMs: null,
        },
        alertsEngine: {
          lastRunAt: null,
          lastDurationMs: null,
          rulesLoaded: null,
          activeAlertsTotal: null,
          activeWarning: null,
          activeCritical: null,
          activeInfo: null,
          evaluated: null,
          triggered: null,
        },
      },
      isLoading: false,
      isError: false,
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

    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes the device ID and live/raw params to the history hook', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    await renderDeviceDetail();

    const [params] = (useHeatPumpHistory as jest.Mock).mock.calls[0] as [
      HeatPumpHistoryRequest,
      { enabled: boolean }
    ];
    expect(params.deviceId).toBe(baseDevice.id);
    expect(params.mode).toBe('live');
    expect(params.aggregation).toBe('raw');
    expect(params.fields[0].field).toBe('metric_compCurrentA');
    expect(params.to).toBe('2025-01-01T12:00:00.000Z');
    expect(params.from).toBe('2025-01-01T06:00:00.000Z');

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
    fireEvent.press(screen.getByTestId('pill-compressor'));
    fireEvent.press(screen.getByTestId('pill-compressor'));
    fireEvent.press(screen.getByTestId('pill-compressor'));

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
    fireEvent.press(screen.getByTestId('pill-compressor'));

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
    fireEvent.press(screen.getByTestId('pill-compressor'));

    expect(screen.getByText('Could not load heat pump history.')).toBeTruthy();
    expect(screen.getByTestId('compressor-history-error')).toBeTruthy();
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
    fireEvent.press(screen.getByTestId('pill-compressor'));

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
    fireEvent.press(screen.getByTestId('pill-compressor'));

    expect(screen.getByText(/History temporarily unavailable/i)).toBeTruthy();
  });

  it('shows vendor caption when heat pump history is configured', async () => {
    await renderDeviceDetail();
    fireEvent.press(screen.getByTestId('pill-compressor'));

    expect(screen.getByText(/Live vendor history via \/heat-pump-history/i)).toBeTruthy();
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
    fireEvent.press(screen.getByTestId('pill-compressor'));

    expect(useHeatPumpHistory).toHaveBeenCalled();
    const [, options] = (useHeatPumpHistory as jest.Mock).mock.calls[0] as [
      unknown,
      { enabled: boolean }
    ];
    expect(options.enabled).toBe(false);
    expect(screen.getByText(/History unavailable for this device/i)).toBeTruthy();
  });

  it('allows selecting 1h, 6h, 24h, and 7d ranges for telemetry and history', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    await renderDeviceDetail();
    fireEvent.press(screen.getByTestId('pill-telemetry'));

    expect((useDeviceTelemetry as jest.Mock).mock.calls[0][1]).toBe('24h');

    const telemetryTabs = screen.getByTestId('telemetry-range-tabs');
    fireEvent.press(within(telemetryTabs).getByTestId('pill-1h'));
    fireEvent.press(within(telemetryTabs).getByTestId('pill-7d'));

    const ranges = (useDeviceTelemetry as jest.Mock).mock.calls.map(([, r]: [string, string]) => r);
    expect(ranges).toContain('1h');
    expect(ranges).toContain('24h');
    expect(ranges).toContain('7d');

    fireEvent.press(screen.getByTestId('pill-compressor'));
    const historyTabs = screen.getByTestId('compressor-current-card');
    fireEvent.press(within(historyTabs).getByTestId('pill-1h'));

    const historyParams = (useHeatPumpHistory as jest.Mock).mock.calls.map(
      ([params]: [HeatPumpHistoryRequest]) => params
    );
    expect(historyParams[0].from).toBe('2025-01-01T06:00:00.000Z');
    const latestHistoryCall = historyParams[historyParams.length - 1];
    expect(latestHistoryCall.from).toBe('2025-01-01T11:00:00.000Z');
    expect(latestHistoryCall.to).toBe('2025-01-01T12:00:00.000Z');

    jest.useRealTimers();
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

  it('shows an empty timeline state', async () => {
    await renderDeviceDetail();
    fireEvent.press(screen.getByTestId('pill-timeline'));

    expect(screen.getByTestId('device-timeline')).toBeTruthy();
    expect(screen.getByText(/No recent events/)).toBeTruthy();
  });

  it('renders alert and work order events on the timeline', async () => {
    (useDeviceAlerts as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'alert-1',
          site_id: 'site-1',
          device_id: baseDevice.id,
          severity: 'critical',
          type: 'high_temp',
          message: 'High temp',
          status: 'active',
          first_seen_at: '2025-01-02T00:00:00.000Z',
          last_seen_at: '2025-01-02T01:00:00.000Z',
          acknowledged_by: null,
          acknowledged_at: null,
          muted_until: null,
          rule_id: null,
        },
      ],
      isLoading: false,
      isError: false,
    });
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'wo-1',
          organisation_id: 'org-1',
          site_id: 'site-1',
          device_id: baseDevice.id,
          alert_id: null,
          title: 'Repair motor',
          description: null,
          status: 'done',
          priority: 'low',
          assignee_user_id: null,
          created_by_user_id: 'user-1',
          due_at: null,
          slaDueAt: null,
          sla_due_at: null,
          resolvedAt: '2025-01-02T02:00:00.000Z',
          resolved_at: '2025-01-02T02:00:00.000Z',
          reminderAt: null,
          reminder_at: null,
          category: null,
          created_at: '2025-01-02T00:00:00.000Z',
          updated_at: '2025-01-02T01:00:00.000Z',
          slaBreached: false,
          sla_breached: false,
          alert_severity: null,
        },
      ],
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();
    fireEvent.press(screen.getByTestId('pill-timeline'));

    expect(screen.getByTestId('device-timeline')).toBeTruthy();
    expect(screen.getAllByText(/High temp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Repair motor/).length).toBeGreaterThan(0);
  });

  it('shows offline placeholder when no cached history exists', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useDeviceCommands as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    });

    await renderDeviceDetail();
    fireEvent.press(screen.getByTestId('pill-compressor'));

    expect(screen.getAllByText(/History unavailable while offline/i).length).toBeGreaterThan(0);
  });
});
