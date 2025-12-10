import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { DiagnosticsScreen } from '../screens/Profile/DiagnosticsScreen';
import { useHealthPlus } from '../api/health/hooks';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/health/hooks', () => ({
  useHealthPlus: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3', extra: { apiUrl: 'http://api.test' } } },
}));

jest.mock('expo-device', () => ({
  __esModule: true,
  osBuildId: 'device-abc',
  modelId: 'model-xyz',
}));

describe('DiagnosticsScreen', () => {
  beforeEach(() => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { id: 'user-1', email: 'u@example.com', name: 'User One', organisation_id: null },
    }));
  });

  it('renders health details and subsystem statuses', () => {
    (useHealthPlus as jest.Mock).mockReturnValue({
      data: {
        ok: true,
        env: 'development',
        version: '1.2.3',
        db: 'ok',
        dbLatencyMs: 32,
        storage: { root: '/tmp/storage', writable: true, latencyMs: 10 },
        antivirus: {
          configured: true,
          enabled: true,
          target: 'command',
          lastRunAt: '2025-01-01T00:00:00.000Z',
          lastResult: 'clean',
          lastError: null,
          latencyMs: 5,
        },
        control: {
          configured: true,
          healthy: false,
          lastCommandAt: null,
          lastErrorAt: null,
          lastError: 'timeout',
          disabled: false,
        },
        heatPumpHistory: {
          configured: true,
          healthy: true,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastError: null,
          lastCheckAt: null,
          disabled: false,
        },
        alertsWorker: { healthy: true, lastHeartbeatAt: '2025-01-01T01:00:00.000Z' },
        alertsEngine: {
          lastRunAt: '2025-01-01T00:00:00.000Z',
          lastDurationMs: 120,
          rulesLoaded: 2,
          activeAlertsTotal: 3,
          activeWarning: 2,
          activeCritical: 1,
          activeInfo: 0,
          evaluated: 5,
          triggered: 2,
        },
        push: { enabled: true, disabled: false, lastSampleAt: null, lastError: 'push error' },
        mqtt: {
          configured: true,
          healthy: true,
          lastIngestAt: null,
          lastErrorAt: null,
          lastError: null,
          disabled: false,
        },
      },
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now(),
      refetch: jest.fn(),
    });

    render(<DiagnosticsScreen />);

    expect(screen.getByTestId('diagnostics-version').props.children).toBe('1.2.3');
    expect(screen.getByTestId('diagnostics-api-url').props.children).toBe('http://api.test');
    expect(screen.getByTestId('diagnostics-health-status')).toBeTruthy();
    expect(screen.getByText('user-1')).toBeTruthy();
    expect(screen.getByTestId('diagnostics-alerts-engine')).toBeTruthy();
    expect(screen.getByText(/3 total/)).toBeTruthy();

    const dbRow = screen.getByTestId('diagnostics-db');
    expect(within(dbRow).getByText(/Database/)).toBeTruthy();
    expect(screen.getByTestId('diagnostics-push')).toBeTruthy();
    expect(screen.getByTestId('diagnostics-storage')).toBeTruthy();
    expect(screen.getByTestId('diagnostics-antivirus')).toBeTruthy();
  });

  it('shows an error card when diagnostics fail', () => {
    const refetch = jest.fn();
    (useHealthPlus as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<DiagnosticsScreen />);

    fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
