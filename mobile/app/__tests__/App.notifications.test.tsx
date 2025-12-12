import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { navigationRef } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import {
  handleNotificationReceived,
  handleNotificationResponse,
} from '../notifications/notificationHandler';
import * as Notifications from 'expo-notifications';

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: () => ({ isOffline: false }),
}));

jest.mock('../api/hooks', () => ({
  useSites: () => ({ data: [], isLoading: false, isFetching: false, isError: false, refetch: jest.fn() }),
  useAlerts: () => ({ data: [] }),
  useDemoStatus: () => ({ data: { isDemoOrg: false } }),
}));

jest.mock('../navigation/RootNavigator', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  return {
    RootNavigator: ({ onReady }: { onReady?: () => void }) => {
      ReactActual.useEffect(() => {
        onReady?.();
      }, [onReady]);
      return ReactActual.createElement('View', null);
    },
  };
});

jest.mock('../notifications/notificationHandler', () => ({
  handleNotificationReceived: jest.fn(),
  handleNotificationResponse: jest.fn(),
}));

type MockedNotificationsModule = {
  __listeners: { received: Array<(notification: Notifications.Notification) => void> };
};

const getNavigationSpy = () => {
  const navigate = navigationRef.current?.navigate ?? jest.fn();
  return navigate as unknown as jest.Mock;
};

describe('App notification handling', () => {
  beforeEach(() => {
    useAuthStore.setState((state) => ({
      ...state,
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'user-1', email: 'a@example.com', name: 'User One' },
      isHydrated: true,
      sessionExpired: false,
      preferencesHydrated: true,
      notificationPreferences: state.notificationPreferences,
      hydrateFromSecureStore: async () => {
        useAuthStore.setState((s) => ({ ...s, isHydrated: true }));
      },
    }));
    jest.spyOn(api, 'get').mockResolvedValue({ data: { id: 'user-1', email: 'a@example.com', name: 'User One' } });
    getNavigationSpy().mockClear();
    (handleNotificationReceived as jest.Mock).mockReset();
    (handleNotificationResponse as jest.Mock).mockReset();
  });

  it('shows a banner for foreground alerts and navigates on press', async () => {
    (handleNotificationReceived as jest.Mock).mockReturnValue({
      kind: 'alert',
      alertId: 'alert-123',
      title: 'New alert',
      body: 'Alert body',
    });
    const { __listeners } = Notifications as unknown as MockedNotificationsModule;

    render(<App />);

    await act(async () => {});

    expect(__listeners.received.length).toBeGreaterThan(0);

    await act(async () => {
      __listeners.received[0]?.({
        request: { content: { data: {}, title: 'New alert', body: 'Alert body' } },
      } as Notifications.Notification);
    });

    expect(await screen.findByTestId('in-app-notification')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('in-app-notification'));
    });

    expect(getNavigationSpy()).toHaveBeenCalledWith('App', {
      screen: 'AlertDetail',
      params: { alertId: 'alert-123' },
    });
  });
});
