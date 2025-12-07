import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

  it('renders health details when available', () => {
    (useHealthPlus as jest.Mock).mockReturnValue({
      data: {
        ok: true,
        env: 'development',
        version: '1.2.3',
        db: 'ok',
        control: {
          configured: true,
          healthy: true,
          lastCommandAt: null,
          lastErrorAt: null,
          lastError: null,
        },
        heatPumpHistory: {
          configured: true,
          healthy: true,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastError: null,
        },
        alertsWorker: { healthy: true, lastHeartbeatAt: null },
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
        push: { enabled: false, lastSampleAt: null, lastError: null },
        mqtt: {
          configured: true,
          healthy: true,
          lastIngestAt: null,
          lastErrorAt: null,
          lastError: null,
        },
      },
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now(),
      refetch: jest.fn(),
    });

    render(<DiagnosticsScreen />);

    expect(screen.getByText('App version')).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText('http://api.test')).toBeTruthy();
    expect(screen.getByTestId('diagnostics-health-status').props.children).toBe('Healthy');
    expect(screen.getByText('user-1')).toBeTruthy();
    expect(screen.getByTestId('diagnostics-alerts-engine')).toBeTruthy();
    expect(screen.getByText(/3 total/)).toBeTruthy();
    expect(screen.getByText(/2 triggered/)).toBeTruthy();
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
