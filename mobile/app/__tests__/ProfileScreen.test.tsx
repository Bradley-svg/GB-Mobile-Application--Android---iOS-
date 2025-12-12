import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../api/preferences/hooks';
import { getNotificationPermissionStatus } from '../hooks/usePushRegistration';
import { useDemoStatus } from '../api/hooks';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/preferences/hooks', () => ({
  DEFAULT_NOTIFICATION_PREFERENCES: { alertsEnabled: true },
  useNotificationPreferencesQuery: jest.fn(),
  useUpdateNotificationPreferencesMutation: jest.fn(),
}));

jest.mock('../api/hooks', () => ({
  useDemoStatus: jest.fn(() => ({ data: { isDemoOrg: false } })),
}));

jest.mock('../hooks/usePushRegistration', () => ({
  getNotificationPermissionStatus: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

describe('ProfileScreen notifications', () => {
  const navigateMock = jest.fn();
  const renderProfile = async () => {
    const utils = render(<ProfileScreen />);
    await act(async () => {});
    return utils;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: navigateMock });
    navigateMock.mockReset();
    (useDemoStatus as jest.Mock).mockReturnValue({ data: { isDemoOrg: false } });
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        organisation_id: null,
        role: 'admin',
      },
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

    const { getByTestId, getByText } = await renderProfile();

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

    const { getByTestId } = await renderProfile();

    await act(async () => {
      fireEvent(getByTestId('notification-preference-toggle'), 'valueChange', false);
    });

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

    const { getByTestId, getByText } = await renderProfile();

    await act(async () => {
      fireEvent(getByTestId('notification-preference-toggle'), 'valueChange', true);
    });

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ alertsEnabled: true }, expect.any(Object));
    });
    expect(getByTestId('notification-preference-toggle')).toHaveProp('value', false);
    expect(getByTestId('notification-preference-error')).toBeTruthy();
    expect(getByText(/Could not update notification preference/i)).toBeTruthy();
  });

  it('navigates to diagnostics from the about row', async () => {
    const { getByTestId } = await renderProfile();

    fireEvent.press(getByTestId('diagnostics-row'));

    expect(navigateMock).toHaveBeenCalledWith('Diagnostics');
  });

  it('navigates to work orders from the profile list', async () => {
    const { getByTestId } = await renderProfile();

    fireEvent.press(getByTestId('workorders-row'));

    expect(navigateMock).toHaveBeenCalledWith('WorkOrders');
  });

  it('navigates to maintenance from the profile list', async () => {
    const { getByTestId } = await renderProfile();

    fireEvent.press(getByTestId('maintenance-row'));

    expect(navigateMock).toHaveBeenCalledWith('MaintenanceCalendar');
  });

  it('shows two-factor row for admins/owners and navigates to setup', async () => {
    const { getByTestId, getByText } = await renderProfile();

    expect(getByTestId('twofactor-row')).toBeTruthy();
    expect(getByText(/Two-factor authentication/)).toBeTruthy();

    fireEvent.press(getByTestId('twofactor-row'));

    expect(navigateMock).toHaveBeenCalledWith('TwoFactorSetup');
  });

  it('hides two-factor row for contractors', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { ...(state.user as NonNullable<typeof state.user>), role: 'contractor' },
    }));

    const { queryByTestId } = await renderProfile();

    expect(queryByTestId('twofactor-row')).toBeNull();
  });
});
