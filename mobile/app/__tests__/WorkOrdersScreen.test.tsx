import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { WorkOrdersScreen } from '../screens/WorkOrders/WorkOrdersScreen';
import { useWorkOrdersList } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata, isCacheOlderThan } from '../utils/storage';

jest.mock('../api/hooks', () => ({
  useWorkOrdersList: jest.fn(),
}));
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

const orders = [
  {
    id: 'wo-1',
    organisation_id: 'org-1',
    site_id: 'site-1',
    device_id: null,
    alert_id: null,
    title: 'Open order',
    description: null,
    status: 'open',
    priority: 'medium',
    assignee_user_id: null,
    created_by_user_id: 'user-1',
    due_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    site_name: 'Site A',
    device_name: null,
    alert_severity: null,
  },
  {
    id: 'wo-2',
    organisation_id: 'org-1',
    site_id: 'site-1',
    device_id: null,
    alert_id: null,
    title: 'Done order',
    description: null,
    status: 'done',
    priority: 'medium',
    assignee_user_id: null,
    created_by_user_id: 'user-1',
    due_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    site_name: 'Site A',
    device_name: null,
    alert_severity: null,
  },
];

describe('WorkOrdersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (isCacheOlderThan as jest.Mock).mockReturnValue(false);
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: orders,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
  });

  it('filters work orders by status chip', () => {
    render(<WorkOrdersScreen />);

    expect(screen.getAllByTestId('work-order-card').length).toBe(2);

    fireEvent.press(screen.getByText('DONE'));

    expect(screen.getAllByTestId('work-order-card').length).toBe(1);
    expect(screen.getByText('Done order')).toBeTruthy();
  });

  it('shows cached data banner when offline', async () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue({
      data: orders,
      savedAt: new Date().toISOString(),
    });

    render(<WorkOrdersScreen />);

    await waitFor(() =>
      expect(screen.getByText(/Offline - showing cached work orders/)).toBeTruthy()
    );
    expect(screen.getAllByTestId('work-order-card').length).toBeGreaterThan(0);
  });

  it('shows a skeleton while loading initial work orders', () => {
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: jest.fn(),
    });

    render(<WorkOrdersScreen />);

    expect(screen.getByTestId('workorders-skeleton')).toBeTruthy();
  });

  it('shows empty state when no work orders are returned', () => {
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<WorkOrdersScreen />);

    expect(screen.getByTestId('workorders-empty')).toBeTruthy();
  });
});
