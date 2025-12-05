import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { AlertDetailScreen } from '../screens/Alerts/AlertDetailScreen';
import { useAlerts, useAcknowledgeAlert, useMuteAlert } from '../api/hooks';
import type { AppStackParamList } from '../navigation/RootNavigator';

jest.mock('../api/hooks', () => ({
  useAlerts: jest.fn(),
  useAcknowledgeAlert: jest.fn(),
  useMuteAlert: jest.fn(),
}));

describe('AlertDetailScreen', () => {
  const alertItem = {
    id: 'alert-1',
    site_id: 'site-1',
    device_id: 'device-1',
    severity: 'critical',
    type: 'sensor',
    message: 'High temp',
    status: 'active',
    first_seen_at: '2025-01-01T00:00:00.000Z',
    last_seen_at: '2025-01-01T01:00:00.000Z',
    acknowledged_by: null,
    acknowledged_at: null,
    muted_until: null,
  };

  const acknowledgeMock = jest.fn();
  const muteMock = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();

    const route: RouteProp<AppStackParamList, 'AlertDetail'> = {
      key: 'AlertDetail',
      name: 'AlertDetail',
      params: { alertId: alertItem.id },
    };
    (navigation.useRoute as jest.Mock).mockReturnValue(route);

    (useAlerts as jest.Mock).mockReturnValue({
      data: [alertItem],
      isLoading: false,
      isError: false,
    });

    (useAcknowledgeAlert as jest.Mock).mockReturnValue({
      mutateAsync: acknowledgeMock,
      isPending: false,
    });

    (useMuteAlert as jest.Mock).mockReturnValue({
      mutateAsync: muteMock,
      isPending: false,
    });
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  afterEach(() => {
    (navigation.useRoute as jest.Mock).mockReset();
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: {} });
  });

  it('calls acknowledge and mute mutations with correct payloads', async () => {
    render(<AlertDetailScreen />);

    fireEvent.press(screen.getByText('Acknowledge'));
    expect(acknowledgeMock).toHaveBeenCalledWith(alertItem.id);

    fireEvent.press(screen.getByText('Mute 60 minutes'));
    expect(muteMock).toHaveBeenCalledWith({ alertId: alertItem.id, minutes: 60 });
  });

  it('shows pending labels when actions are in flight', () => {
    (useAcknowledgeAlert as jest.Mock).mockReturnValue({
      mutateAsync: acknowledgeMock,
      isPending: true,
    });
    (useMuteAlert as jest.Mock).mockReturnValue({
      mutateAsync: muteMock,
      isPending: true,
    });

    render(<AlertDetailScreen />);

    expect(screen.getByText('Acknowledging...')).toBeTruthy();
    expect(screen.getByText('Muting...')).toBeTruthy();
  });
});
