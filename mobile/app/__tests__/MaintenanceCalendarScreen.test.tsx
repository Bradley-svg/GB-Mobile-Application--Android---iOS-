import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { MaintenanceCalendarScreen } from '../screens/Maintenance/MaintenanceCalendarScreen';
import { useMaintenanceSummary } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata, isCacheOlderThan } from '../utils/storage';

jest.mock('../api/hooks', () => ({
  useMaintenanceSummary: jest.fn(),
}));
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn(),
}));

const summary = {
  openCount: 2,
  overdueCount: 1,
  dueSoonCount: 1,
  byDate: [
    {
      date: '2025-12-08',
      open: [
        {
          workOrderId: 'wo-1',
          title: 'Inspect filter',
          siteName: 'Site A',
          deviceName: 'Pump A',
          slaDueAt: '2025-12-08T10:00:00.000Z',
          status: 'open',
        },
      ],
      overdue: [
        {
          workOrderId: 'wo-2',
          title: 'Replace sensor',
          siteName: 'Site B',
          deviceName: 'Sensor',
          slaDueAt: '2025-12-08T08:00:00.000Z',
          status: 'open',
        },
      ],
      done: [],
    },
  ],
};

describe('MaintenanceCalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (isCacheOlderThan as jest.Mock).mockReturnValue(false);
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
  });

  it('shows summary counts and date items when online', () => {
    (useMaintenanceSummary as jest.Mock).mockReturnValue({
      data: summary,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<MaintenanceCalendarScreen />);

    expect(screen.getByTestId('maintenance-open-count')).toHaveTextContent(/2/);
    expect(screen.getByTestId('maintenance-overdue-count')).toHaveTextContent(/1/);
    expect(screen.getByTestId('maintenance-due-soon-count')).toHaveTextContent(/1/);
    expect(screen.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)).toBeTruthy();
    expect(screen.getAllByTestId('maintenance-item').length).toBeGreaterThan(0);
  });

  it('uses cached data when offline', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useMaintenanceSummary as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: summary,
      savedAt: new Date().toISOString(),
    });

    render(<MaintenanceCalendarScreen />);
    await waitFor(() => expect(screen.getByText('Read-only cached maintenance view')).toBeTruthy());
    expect(screen.getAllByTestId('maintenance-item').length).toBeGreaterThan(0);
  });

  it('shows an error state when request fails with no cache', () => {
    (useMaintenanceSummary as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    render(<MaintenanceCalendarScreen />);
    expect(screen.getByTestId('maintenance-error')).toBeTruthy();
  });
});
