import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { RootNavigator } from '../navigation/RootNavigator';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/hooks', () => {
  const actual = jest.requireActual('../api/hooks');
  return {
    ...actual,
    useSites: () => ({
      data: [
        {
          id: 'site-1',
          name: 'Test Site',
          city: 'Cape Town',
          status: 'ok',
          last_seen_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
    }),
    useAlerts: () => ({
      data: [],
      isLoading: false,
      isError: false,
    }),
  };
});
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: () => ({ isOffline: false }),
}));
jest.mock('../screens/Dashboard/DashboardScreen', () => ({
  DashboardScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Test Site');
  },
}));
jest.mock('../screens/Alerts/AlertsScreen', () => ({
  AlertsScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'No active alerts.');
  },
}));
jest.mock('../screens/Profile/ProfileScreen', () => ({
  ProfileScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Log out');
  },
}));
jest.mock('../screens/Search/SearchScreen', () => ({
  SearchScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Search Screen');
  },
}));
jest.mock('../screens/Maintenance/MaintenanceCalendarScreen', () => ({
  MaintenanceCalendarScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Maintenance Calendar');
  },
}));

const renderWithClient = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('RootNavigator', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        isHydrated: true,
        sessionExpired: false,
        notificationPreferences: { alertsEnabled: true },
        preferencesHydrated: false,
      });
    });
  });

  afterEach(() => {
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

  it('renders dashboard, alerts, and profile tabs without crashing', async () => {
    const { findByText } = renderWithClient(<RootNavigator isAuthenticated />);

    expect(await findByText('Test Site')).toBeTruthy();
    expect(await findByText('No active alerts.')).toBeTruthy();
    expect(await findByText('Log out')).toBeTruthy();
  });
});
