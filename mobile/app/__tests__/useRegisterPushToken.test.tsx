import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { getPushTokenStorageKey } from '../constants/pushTokens';
import { useRegisterPushToken } from '../hooks/useRegisterPushToken';
import { useAuthStore } from '../store/authStore';

jest.mock('expo-device', () => ({ isDevice: true }));

const TestComponent = () => {
  useRegisterPushToken();
  return null;
};

describe('useRegisterPushToken', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const apiPostSpy = jest.spyOn(api, 'post');
  const deviceModule = Device as unknown as { isDevice: boolean };
  const originalIsDevice = deviceModule.isDevice;
  const originalIsDeviceDescriptor = Object.getOwnPropertyDescriptor(deviceModule, 'isDevice');

  beforeEach(() => {
    jest.clearAllMocks();
    apiPostSpy.mockResolvedValue({ data: { ok: true } });
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: true,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
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

  it('does not re-register when token was already stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(getPushTokenStorageKey('user-1'));
    });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(apiPostSpy).not.toHaveBeenCalled();
  });

  it('registers token once and sets the stored flag when user is present', async () => {
    useAuthStore.setState({
      user: { id: 'user-2', email: 'user@example.com', name: 'User Two', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(getPushTokenStorageKey('user-2'));
    });

    await waitFor(() => {
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith('/auth/me/push-tokens', { token: 'push-token' });
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(getPushTokenStorageKey('user-2'), '1');
  });
});
