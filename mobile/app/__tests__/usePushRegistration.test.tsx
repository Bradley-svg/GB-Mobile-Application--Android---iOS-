import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import {
  LAST_REGISTERED_PUSH_TOKEN_KEY,
  LAST_REGISTERED_USER_ID_KEY,
} from '../constants/pushTokens';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '../queryClient';
import { NOTIFICATION_PREFERENCES_QUERY_KEY } from '../api/preferences/hooks';

jest.mock('expo-device', () => ({ isDevice: true }));

const TestComponent = () => {
  usePushRegistration();
  return null;
};

describe('usePushRegistration', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const apiPostSpy = jest.spyOn(api, 'post');
  const deviceModule = Device as unknown as { isDevice: boolean };
  const originalIsDevice = deviceModule.isDevice;
  const originalIsDeviceDescriptor = Object.getOwnPropertyDescriptor(deviceModule, 'isDevice');

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    apiPostSpy.mockResolvedValue({ data: { ok: true } });
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: true,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
      sessionExpired: false,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.multiSet as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'push-token' });
    Object.defineProperty(deviceModule, 'isDevice', { value: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(deviceModule, 'isDevice', {
      value: originalIsDevice,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    apiPostSpy.mockRestore();
    if (originalIsDeviceDescriptor) {
      Object.defineProperty(deviceModule, 'isDevice', originalIsDeviceDescriptor);
    } else {
      Object.defineProperty(deviceModule, 'isDevice', {
        value: originalIsDevice,
        writable: true,
        configurable: true,
      });
    }
  });

  it('skips registration when there is no user', async () => {
    render(<TestComponent />);

    await waitFor(() => {
      expect(apiPostSpy).not.toHaveBeenCalled();
    });
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('does not re-register when token and user match cached values', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_REGISTERED_PUSH_TOKEN_KEY) return 'push-token';
      if (key === LAST_REGISTERED_USER_ID_KEY) return 'user-1';
      return null;
    });
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
      sessionExpired: false,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
    });
    expect(apiPostSpy).not.toHaveBeenCalled();
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  });

  it('registers token when token or user changed', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_REGISTERED_PUSH_TOKEN_KEY) return 'old-token';
      if (key === LAST_REGISTERED_USER_ID_KEY) return 'someone-else';
      return null;
    });
    useAuthStore.setState({
      user: { id: 'user-2', email: 'user@example.com', name: 'User Two', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
      sessionExpired: false,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/me/push/register',
        expect.objectContaining({ expoPushToken: 'push-token' })
      );
    });
    expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
      [LAST_REGISTERED_PUSH_TOKEN_KEY, 'push-token'],
      [LAST_REGISTERED_USER_ID_KEY, 'user-2'],
    ]);
  });

  it('skips backend registration when permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    useAuthStore.setState({
      user: { id: 'user-3', email: 'user3@example.com', name: 'User Three', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
      sessionExpired: false,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(apiPostSpy).not.toHaveBeenCalled();
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  });

  it('skips backend registration when preferences disable alerts', async () => {
    queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, { alertsEnabled: false });
    useAuthStore.setState({
      user: { id: 'user-4', email: 'pref@example.com', name: 'Pref User', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      notificationPreferences: { alertsEnabled: false },
      preferencesHydrated: true,
      sessionExpired: false,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(apiPostSpy).not.toHaveBeenCalled();
    });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('registers push token when backend preferences allow alerts', async () => {
    queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, { alertsEnabled: true });
    useAuthStore.setState({
      user: { id: 'user-5', email: 'pref-on@example.com', name: 'Pref On', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: true,
      sessionExpired: false,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/me/push/register',
        expect.objectContaining({ expoPushToken: 'push-token' })
      );
    });
  });
});
