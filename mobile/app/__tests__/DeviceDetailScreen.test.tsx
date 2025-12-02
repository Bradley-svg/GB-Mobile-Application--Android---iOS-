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
}));

describe('DeviceDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
});
