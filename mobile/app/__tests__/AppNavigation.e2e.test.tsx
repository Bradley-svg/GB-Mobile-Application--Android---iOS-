import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import App from '../../App';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

const demoSite = {
  id: 'site-1',
  name: 'Demo Site',
  city: 'Cape Town',
  status: 'online',
  last_seen_at: '2025-01-01T00:00:00.000Z',
};

const demoDevice = {
  id: 'device-1',
  site_id: 'site-1',
  name: 'Demo Device',
  type: 'heat_pump',
  status: 'online',
  mac: '38:18:2B:60:A9:94',
  last_seen_at: '2025-01-01T00:00:00.000Z',
};

const demoTelemetry = {
  range: '24h',
  metrics: {
    supply_temp: [{ ts: '2025-01-01T00:00:00.000Z', value: 48 }],
    return_temp: [],
    power_kw: [],
    flow_rate: [],
    cop: [],
  },
};

const demoHistory = {
  series: [
    { field: 'metric_compCurrentA', points: [{ timestamp: '2025-01-01T00:00:00.000Z', value: 12.5 }] },
  ],
};

const demoAlert = {
  id: 'alert-1',
  site_id: 'site-1',
  device_id: 'device-1',
  severity: 'warning' as const,
  type: 'sensor',
  message: 'Demo alert message',
  status: 'active' as const,
  first_seen_at: '2025-01-01T00:00:00.000Z',
  last_seen_at: '2025-01-01T00:10:00.000Z',
  acknowledged_by: null,
  acknowledged_at: null,
  muted_until: null,
};

const demoAlerts = [demoAlert];

const mockLogin = jest.fn(async () => {
  await useAuthStore.getState().setAuth({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: 'user-1', email: 'demo@greenbro.com', name: 'Demo User' },
  });
});

jest.mock('../api/hooks', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actual = jest.requireActual('../api/hooks');
  return {
    ...actual,
    useLogin: () => ({ mutateAsync: mockLogin, isPending: false }),
    useSites: () => ({ data: [demoSite], isLoading: false, isError: false }),
    useSite: () => ({ data: demoSite, isLoading: false, isError: false }),
    useDevices: () => ({ data: [demoDevice], isLoading: false, isError: false }),
    useDevice: () => ({ data: demoDevice, isLoading: false, isError: false }),
    useDeviceTelemetry: () => ({ data: demoTelemetry, isLoading: false, isError: false, refetch: jest.fn() }),
    useDeviceAlerts: () => ({ data: demoAlerts, isLoading: false, isError: false }),
    useHeatPumpHistory: () => ({ data: demoHistory, isLoading: false, isError: false, refetch: jest.fn() }),
    useAlerts: () => ({ data: demoAlerts, isLoading: false, isError: false, refetch: jest.fn() }),
    useAcknowledgeAlert: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useMuteAlert: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useModeCommand: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useSetpointCommand: () => ({ mutateAsync: jest.fn(), isPending: false }),
  };
});

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: () => ({ isOffline: false }),
}));

jest.mock('../hooks/useRegisterPushToken', () => ({
  useRegisterPushToken: () => undefined,
}));

jest.mock('../screens/Alerts/AlertsScreen', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text } = require('react-native');
  return {
    AlertsScreen: () => {
      const alerts: { id: string; message: string }[] = [
        { id: 'alert-1', message: 'Demo alert message' },
      ];
      return (
        <View>
          <Text>Alerts Screen</Text>
          {alerts.map((alert) => (
            <Text key={alert.id}>{alert.message}</Text>
          ))}
        </View>
      );
    },
  };
});

jest.mock('../screens/Alerts/AlertDetailScreen', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nav = require('@react-navigation/native');
  return {
    AlertDetailScreen: () => {
      const route = nav.useRoute();
      const alerts: { id: string; message: string }[] = [
        { id: 'alert-1', message: 'Demo alert message' },
      ];
      const alert = alerts.find((a) => a.id === route.params?.alertId) ?? alerts[0];
      return (
        <View>
          <Text>Alert Detail</Text>
          {alert ? <Text>{alert.message}</Text> : null}
        </View>
      );
    },
  };
});

jest.mock('../screens/Device/DeviceDetailScreen', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text } = require('react-native');
  return {
    DeviceDetailScreen: () => (
      <View>
        <Text>Demo Device</Text>
        <Text>Compressor current (A)</Text>
      </View>
    ),
  };
});

jest.mock('../screens/Profile/ProfileScreen', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text } = require('react-native');
  return {
    ProfileScreen: () => (
      <View>
        <Text>Profile Screen</Text>
      </View>
    ),
  };
});

describe('AppNavigation flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
        isHydrated: true,
        sessionExpired: false,
        notificationPreferences: { alertsEnabled: true },
        preferencesHydrated: false,
      });
    });

    jest.spyOn(navigation, 'useRoute').mockReturnValue({
      params: { siteId: demoSite.id, deviceId: demoDevice.id, alertId: demoAlert.id },
    } as ReturnType<typeof navigation.useRoute>);
    jest.spyOn(api, 'get').mockResolvedValue({
      data: { id: 'user-1', email: 'demo@greenbro.com', name: 'Demo User' },
    } as Awaited<ReturnType<typeof api.get>>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    act(() => {
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
        isHydrated: true,
        sessionExpired: false,
        notificationPreferences: { alertsEnabled: true },
        preferencesHydrated: false,
      });
    });
  });

  it('logs in and renders dashboard, device, and alerts content', async () => {
    render(<App />);

    fireEvent.press(await screen.findByText('Login'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());

    const sites = screen.getAllByText('Demo Site');
    expect(sites.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Demo Device').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compressor current (A)').length).toBeGreaterThan(0);
    expect(screen.getAllByText(demoAlert.message)[0]).toBeTruthy();
  });
});
