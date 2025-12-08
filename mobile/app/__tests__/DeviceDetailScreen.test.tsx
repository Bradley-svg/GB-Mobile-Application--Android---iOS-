import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata } from '../utils/storage';

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

jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

describe('DeviceDetailScreen', () => {
  const renderDeviceDetail = async () => {
    render(<DeviceDetailScreen />);
    await act(async () => {});
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);

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
        external_id: 'dev-1',
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

    (useDeviceSchedule as jest.Mock).mockReturnValue({
      data: {
        id: 'sched-1',
        device_id: 'device-1',
        name: 'Daily',
        enabled: true,
        start_hour: 6,
        end_hour: 18,
        target_setpoint: 45,
        target_mode: 'HEATING',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
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

  it('shows placeholders when telemetry metrics are empty', async () => {
    await renderDeviceDetail();

    const placeholders = screen.getAllByText('No data for this metric in the selected range.');
    expect(placeholders).toHaveLength(4);
  });

  it('prevents out-of-range setpoint updates', async () => {
    const setpointMock = jest.fn();
    (useSetpointCommand as jest.Mock).mockReturnValue({
      mutateAsync: setpointMock,
      isPending: false,
    });

    await renderDeviceDetail();

    fireEvent.changeText(screen.getByTestId('setpoint-input'), '10');
    fireEvent.press(screen.getByText('Update setpoint'));

    expect(setpointMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Flow temperature must be between 30-60/)).toBeTruthy();
  });

  it('shows telemetry error with retry action', async () => {
    const refetchMock = jest.fn();
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      error: new Error('fail'),
    });

    await renderDeviceDetail();

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
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: {
        device: {
          id: 'device-1',
          site_id: 'site-1',
          name: 'Cached Device',
          type: 'hp',
          status: 'ok',
          external_id: 'dev-1',
          mac: '38:18:2B:60:A9:94',
        },
        telemetry: cachedTelemetry,
        lastUpdatedAt: '2025-01-01T00:00:00.000Z',
        cachedAt: '2025-01-01T01:00:00.000Z',
      },
      savedAt: '2025-01-01T01:00:00.000Z',
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

    await renderDeviceDetail();

    expect(await screen.findByText('Offline - showing cached data (read-only).')).toBeTruthy();
    expect(screen.getByText('Cached Device')).toBeTruthy();
    const offlineCommandMessages = screen.getAllByText(/Commands are unavailable while offline/i);
    expect(offlineCommandMessages.length).toBeGreaterThan(0);
    const setpointButton = screen.getByTestId('setpoint-button');
    expect(setpointButton.props.disabled).toBe(true);
  });

  it('shows offline empty state when no cached device exists', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
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

    await renderDeviceDetail();

    expect(await screen.findByText('Offline and no cached data for this device.')).toBeTruthy();
  });

  it('maps throttling errors to friendly copy', async () => {
    const throttleError = {
      isAxiosError: true,
      response: { status: 429, data: { failure_reason: 'THROTTLED', message: 'too many' } },
    };
    const mutateAsync = jest.fn().mockRejectedValue(throttleError);
    (useSetpointCommand as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    (useDevice as jest.Mock).mockReturnValue({
      data: {
        id: 'device-1',
        site_id: 'site-1',
        name: 'Heat Pump',
        type: 'hp',
        status: 'online',
        external_id: 'dev-1',
        mac: '38:18:2B:60:A9:94',
        last_seen_at: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    fireEvent.press(screen.getByText('Update setpoint'));

    await waitFor(() =>
      expect(screen.getByText(/Too many commands in a short time/i)).toBeTruthy()
    );
  });

  it('surfaces backend validation failures from control commands', async () => {
    const validationError = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { failure_reason: 'ABOVE_MAX', message: 'Setpoint above allowed range.' },
      },
    };
    (useSetpointCommand as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(validationError),
      isPending: false,
    });
    (useDevice as jest.Mock).mockReturnValue({
      data: {
        id: 'device-1',
        site_id: 'site-1',
        name: 'Heat Pump',
        type: 'hp',
        status: 'online',
        external_id: 'dev-1',
        mac: '38:18:2B:60:A9:94',
        last_seen_at: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    });

    await renderDeviceDetail();

    fireEvent.press(screen.getByText('Update setpoint'));

    await waitFor(() =>
      expect(screen.getByText(/Setpoint above allowed range/i)).toBeTruthy()
    );
  });

  it('opens the schedule modal and calls the save mutation', async () => {
    const upsertMock = jest.fn().mockResolvedValue({});
    (useUpsertDeviceSchedule as jest.Mock).mockReturnValue({
      mutateAsync: upsertMock,
      isPending: false,
    });

    await renderDeviceDetail();

    const editButtons = screen.getAllByText(/Edit schedule/i);
    fireEvent.press(editButtons[0]);
    fireEvent.changeText(screen.getByDisplayValue('6'), '7');
    fireEvent.press(screen.getByText(/Save schedule/i));

    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith({
        name: 'Daily',
        enabled: true,
        startHour: 7,
        endHour: 18,
        targetSetpoint: 45,
        targetMode: 'HEATING',
      })
    );
  });

  it('shows export button when online', async () => {
    await renderDeviceDetail();
    expect(screen.getByTestId('export-telemetry-button')).toBeTruthy();
  });

  it('hides export button when offline', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    await renderDeviceDetail();
    expect(screen.queryByTestId('export-telemetry-button')).toBeNull();
  });
});
