import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { RootNavigator } from '../navigation/RootNavigator';
import { useAuthStore } from '../store/authStore';

jest.mock('../screens/Dashboard/DashboardScreen', () => ({ DashboardScreen: () => null }));
jest.mock('../screens/Alerts/AlertsScreen', () => ({ AlertsScreen: () => null }));
jest.mock('../screens/Profile/ProfileScreen', () => ({ ProfileScreen: () => null }));

const originalAdapter = api.defaults.adapter;

const unauthorizedError = (config: InternalAxiosRequestConfig) =>
  new AxiosError('Unauthorized', undefined, config, {}, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: {},
  });

describe('session expired handling', () => {
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
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

  it('clears auth and marks sessionExpired when refresh fails with 401', async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        throw unauthorizedError(config);
      }
      throw unauthorizedError(config);
    };

    act(() => {
      useAuthStore.setState({
        accessToken: 'old-access',
        refreshToken: 'refresh-token',
        user: { id: 'user-1', email: 'user@test.com', name: 'Test User', organisation_id: null },
        isHydrated: true,
        sessionExpired: false,
        notificationPreferences: { alertsEnabled: true },
        preferencesHydrated: false,
      });
    });

    await expect(api.get('/sites')).rejects.toBeInstanceOf(Error);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.sessionExpired).toBe(true);
  });

  it('shows and hides the session expired banner around login', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { setSessionExpired, setAuth } = useAuthStore.getState();
    await act(async () => {
      setSessionExpired(true);
    });

    const { getByText, queryByText, rerender } = render(
      <QueryClientProvider client={queryClient}>
        <RootNavigator isAuthenticated={false} sessionExpired={true} />
      </QueryClientProvider>
    );

    expect(getByText(/session has expired/i)).toBeTruthy();

    await act(async () => {
      await setAuth({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: { id: 'user-2', email: 'user2@test.com', name: 'User Two', organisation_id: null },
      });
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <RootNavigator
          isAuthenticated={true}
          sessionExpired={useAuthStore.getState().sessionExpired}
        />
      </QueryClientProvider>
    );

    expect(queryByText(/session has expired/i)).toBeNull();
    queryClient.clear();
  });
});
