import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { AlertDetailScreen } from '../screens/Alerts/AlertDetailScreen';
import { useAlerts, useAcknowledgeAlert, useAlertRulesForDevice, useMuteAlert } from '../api/hooks';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useNetworkBanner } from '../hooks/useNetworkBanner';

jest.mock('../api/hooks', () => ({
  useAlerts: jest.fn(),
  useAcknowledgeAlert: jest.fn(),
  useAlertRulesForDevice: jest.fn(),
  useMuteAlert: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
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
    rule_id: 'rule-1',
    first_seen_at: '2025-01-01T00:00:00.000Z',
    last_seen_at: '2025-01-01T01:00:00.000Z',
    acknowledged_by: null,
    acknowledged_at: null,
    muted_until: null,
  };
  const alertRule = {
    id: 'rule-1',
    org_id: 'org-1',
    site_id: 'site-1',
    device_id: 'device-1',
    metric: 'supply_temp',
    rule_type: 'threshold_above',
    threshold: 50,
    roc_window_sec: null,
    offline_grace_sec: null,
    enabled: true,
    severity: 'critical',
    snooze_default_sec: 900,
    name: 'High temp rule',
    description: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  const acknowledgeMock = jest.fn();
  const muteMock = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();

    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });

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
      refetch: jest.fn(),
    });

    (useAcknowledgeAlert as jest.Mock).mockReturnValue({
      mutateAsync: acknowledgeMock,
      isPending: false,
    });

    (useAlertRulesForDevice as jest.Mock).mockReturnValue({
      data: [alertRule],
      isLoading: false,
      isError: false,
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

    fireEvent.press(screen.getByText('1h'));
    fireEvent.press(screen.getByTestId('mute-button'));
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

  it('disables acknowledge and mute when offline', () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });

    render(<AlertDetailScreen />);

    const ackButton = screen.getByTestId('acknowledge-button');
    const muteButton = screen.getByTestId('mute-button');
    expect(ackButton.props.disabled).toBe(true);
    expect(muteButton.props.disabled).toBe(true);
    expect(screen.getByText(/requires network connection/i)).toBeTruthy();
  });

  it('sends correct snooze payloads for each chip', () => {
    render(<AlertDetailScreen />);

    const muteButton = screen.getByTestId('mute-button');

    fireEvent.press(screen.getByText('15m'));
    fireEvent.press(muteButton);
    expect(muteMock).toHaveBeenLastCalledWith({ alertId: alertItem.id, minutes: 15 });

    muteMock.mockClear();
    fireEvent.press(screen.getByText('4h'));
    fireEvent.press(muteButton);
    expect(muteMock).toHaveBeenLastCalledWith({ alertId: alertItem.id, minutes: 240 });

    muteMock.mockClear();
    fireEvent.press(screen.getByText(/until resolved/i));
    fireEvent.press(muteButton);
    expect(muteMock).toHaveBeenLastCalledWith({ alertId: alertItem.id, minutes: 1440 });
  });

  it('shows rule summary and default snooze copy', () => {
    const tree = render(<AlertDetailScreen />);

    expect(screen.getByText(alertRule.name)).toBeTruthy();
    expect(screen.getByText(/Until resolved \(max 24h\)/i)).toBeTruthy();
    expect(screen.getByText('Mute 15m')).toBeTruthy();

    expect(tree.toJSON()).toMatchSnapshot();
  });
});
