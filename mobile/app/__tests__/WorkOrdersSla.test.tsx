import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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
  isCacheOlderThan: jest.fn(),
}));

const now = new Date();
const baseOrder = {
  organisation_id: 'org-1',
  site_id: 'site-1',
  device_id: null,
  alert_id: null,
  description: null,
  priority: 'medium',
  assignee_user_id: null,
  created_by_user_id: 'user-1',
  updated_at: now.toISOString(),
  site_name: 'Site A',
  device_name: null,
  alert_severity: null,
};

const orders = [
  {
    ...baseOrder,
    id: 'overdue',
    title: 'Overdue order',
    status: 'open',
    created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    slaBreached: true,
  },
  {
    ...baseOrder,
    id: 'soon',
    title: 'Due soon order',
    status: 'open',
    created_at: now.toISOString(),
    slaDueAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    slaBreached: false,
  },
  {
    ...baseOrder,
    id: 'later',
    title: 'Later order',
    status: 'open',
    created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    slaBreached: false,
  },
  {
    ...baseOrder,
    id: 'done-fast',
    title: 'Done in SLA',
    status: 'done',
    created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    slaBreached: false,
  },
  {
    ...baseOrder,
    id: 'done-late',
    title: 'Done after SLA',
    status: 'done',
    created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    slaDueAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    slaBreached: true,
  },
];

describe('WorkOrdersScreen SLA display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (isCacheOlderThan as jest.Mock).mockReturnValue(false);
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
    (useWorkOrdersList as jest.Mock).mockReturnValue({
      data: orders,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it('shows SLA pill labels for each state', () => {
    render(<WorkOrdersScreen />);

    expect(screen.getByTestId('sla-pill-overdue')).toHaveTextContent('Overdue');
    expect(screen.getByTestId('sla-pill-soon')).toHaveTextContent('Due soon');
    expect(screen.getByTestId('sla-pill-later')).toHaveTextContent('On track');

    fireEvent.press(screen.getByText('DONE'));
    expect(screen.getByTestId('sla-pill-done-fast')).toHaveTextContent('Done (SLA)');
    expect(screen.getByTestId('sla-pill-done-late')).toHaveTextContent('Done (breached)');
  });

  it('sorts open and done lists by SLA rules', () => {
    render(<WorkOrdersScreen />);

    const openCards = screen.getAllByTestId('work-order-card');
    expect(openCards[0]).toHaveTextContent(/Overdue order/);
    expect(openCards[1]).toHaveTextContent(/Due soon order/);
    expect(openCards[2]).toHaveTextContent(/Later order/);

    fireEvent.press(screen.getByText('DONE'));
    const doneCards = screen.getAllByTestId('work-order-card');
    expect(doneCards[0]).toHaveTextContent(/Done after SLA/);
    expect(doneCards[1]).toHaveTextContent(/Done in SLA/);
  });
});
