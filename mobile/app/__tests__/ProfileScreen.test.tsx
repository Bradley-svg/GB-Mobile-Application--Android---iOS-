import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../api/preferences/hooks';
import { getNotificationPermissionStatus } from '../hooks/useRegisterPushToken';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/preferences/hooks', () => ({
  DEFAULT_NOTIFICATION_PREFERENCES: { alertsEnabled: true },
  useNotificationPreferencesQuery: jest.fn(),
  useUpdateNotificationPreferencesMutation: jest.fn(),
}));

jest.mock('../hooks/useRegisterPushToken', () => ({
  getNotificationPermissionStatus: jest.fn(),
}));

describe('ProfileScreen notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', name: 'User One', organisation_id: null },
      accessToken: 'access',
      refreshToken: 'refresh',
      isHydrated: true,
      sessionExpired: false,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: true,
    });
    (useNotificationPreferencesQuery as jest.Mock).mockReturnValue({
      data: { alertsEnabled: true },
      isFetching: false,
      isLoading: false,
    });
    (useUpdateNotificationPreferencesMutation as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    (getNotificationPermissionStatus as jest.Mock).mockResolvedValue('granted');
  });

  it('disables toggle and shows settings prompt when OS permissions are denied', async () => {
    (getNotificationPermissionStatus as jest.Mock).mockResolvedValue('denied');

    const { getByTestId, getByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getByTestId('notification-permission-warning')).toBeTruthy();
    });
    expect(getByTestId('notification-preference-toggle')).toHaveProp('disabled', true);
    expect(getByText('Open Settings')).toBeTruthy();
  });

  it('toggles off and calls update hook when permissions granted and prefs enabled', async () => {
    const mutate = jest.fn((prefs, options) => {
      useAuthStore.setState({ notificationPreferences: prefs });
      options?.onSuccess?.(prefs);
    });
    (useUpdateNotificationPreferencesMutation as jest.Mock).mockReturnValue({
      mutate,
      isPending: false,
    });

    const { getByTestId } = render(<ProfileScreen />);

    fireEvent(getByTestId('notification-preference-toggle'), 'valueChange', false);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ alertsEnabled: false }, expect.any(Object));
    });
    expect(getByTestId('notification-preference-toggle')).toHaveProp('value', false);
  });

  it('shows inline error and reverts when update fails', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      notificationPreferences: { alertsEnabled: false },
    }));
    (useNotificationPreferencesQuery as jest.Mock).mockReturnValue({
      data: { alertsEnabled: false },
      isFetching: false,
      isLoading: false,
    });
    const mutate = jest.fn((prefs, options) => {
      useAuthStore.setState({ notificationPreferences: prefs });
      options?.onError?.(new Error('boom'));
      useAuthStore.setState({ notificationPreferences: { alertsEnabled: false } });
    });
    (useUpdateNotificationPreferencesMutation as jest.Mock).mockReturnValue({
      mutate,
      isPending: false,
    });

    const { getByTestId, getByText } = render(<ProfileScreen />);

    fireEvent(getByTestId('notification-preference-toggle'), 'valueChange', true);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ alertsEnabled: true }, expect.any(Object));
    });
    expect(getByTestId('notification-preference-toggle')).toHaveProp('value', false);
    expect(getByTestId('notification-preference-error')).toBeTruthy();
    expect(getByText(/Could not update notification preference/i)).toBeTruthy();
  });
});
