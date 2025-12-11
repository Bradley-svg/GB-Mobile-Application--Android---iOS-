import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DiagnosticsScreen } from '../screens/Profile/DiagnosticsScreen';
import { useHealthPlus } from '../api/health/hooks';
import { api } from '../api/client';

jest.mock('../api/health/hooks', () => ({
  useHealthPlus: jest.fn(),
}));

describe('DiagnosticsScreen push test', () => {
  const apiPostSpy = jest.spyOn(api, 'post');
  const baseHealth = {
    ok: true,
    env: 'development',
    version: '0.7.0',
    db: 'ok' as const,
    dbLatencyMs: 10,
    vendorFlags: { disabled: [], prodLike: false, mqttDisabled: false, controlDisabled: false, heatPumpHistoryDisabled: false, pushNotificationsDisabled: false },
    storage: { root: '/tmp', writable: true, latencyMs: 5 },
    antivirus: {
      configured: true,
      enabled: true,
      target: 'command' as const,
      lastRunAt: '2025-01-01T00:00:00.000Z',
      lastResult: 'clean' as const,
      lastError: null,
      latencyMs: 5,
    },
    control: { configured: true, disabled: false, healthy: true, lastCommandAt: null, lastErrorAt: null, lastError: null },
    heatPumpHistory: {
      configured: true,
      disabled: false,
      healthy: true,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      lastCheckAt: null,
    },
    alertsWorker: { healthy: true, lastHeartbeatAt: '2025-01-01T00:00:00.000Z' },
    alertsEngine: {
      lastRunAt: '2025-01-01T00:00:00.000Z',
      lastDurationMs: 100,
      rulesLoaded: 1,
      activeAlertsTotal: 0,
      activeWarning: 0,
      activeCritical: 0,
      activeInfo: 0,
      evaluated: 0,
      triggered: 0,
    },
    push: { enabled: true, disabled: false, lastSampleAt: null, lastError: null },
    mqtt: { configured: true, disabled: false, healthy: true, lastIngestAt: null, lastErrorAt: null, lastError: null },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useHealthPlus as jest.Mock).mockReturnValue({
      data: baseHealth,
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now(),
      refetch: jest.fn(),
    });
    apiPostSpy.mockResolvedValue({ data: { ok: true } });
  });

  it('shows success message when push test succeeds', async () => {
    render(<DiagnosticsScreen />);

    fireEvent.press(screen.getByTestId('diagnostics-push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-push-success')).toBeTruthy();
    });
    expect(apiPostSpy).toHaveBeenCalledWith('/me/push/test');
  });

  it('shows specific message when no push tokens are registered', async () => {
    const error = Object.assign(new Error('no tokens'), {
      isAxiosError: true,
      response: { data: { code: 'NO_PUSH_TOKENS_REGISTERED' } },
    });
    apiPostSpy.mockRejectedValueOnce(error);

    render(<DiagnosticsScreen />);

    fireEvent.press(screen.getByTestId('diagnostics-push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-push-error')).toBeTruthy();
    });
    expect(screen.getByText(/No device registered for push/i)).toBeTruthy();
  });

  it('shows disabled message when push is disabled', async () => {
    const error = Object.assign(new Error('disabled'), {
      isAxiosError: true,
      response: { data: { code: 'PUSH_DISABLED' } },
    });
    apiPostSpy.mockRejectedValueOnce(error);

    render(<DiagnosticsScreen />);

    fireEvent.press(screen.getByTestId('diagnostics-push-button'));

    await waitFor(() => {
      expect(screen.getByText(/Push is disabled/i)).toBeTruthy();
    });
  });

  it('shows a generic error banner on unexpected failure', async () => {
    apiPostSpy.mockRejectedValueOnce(new Error('network down'));

    render(<DiagnosticsScreen />);

    fireEvent.press(screen.getByTestId('diagnostics-push-button'));

    await waitFor(() => {
      expect(screen.getByTestId('diagnostics-push-error')).toBeTruthy();
    });
    expect(screen.getByText(/Failed to send test push notification/i)).toBeTruthy();
  });
});
