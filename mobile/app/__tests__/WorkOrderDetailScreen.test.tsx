import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { WorkOrderDetailScreen } from '../screens/WorkOrders/WorkOrderDetailScreen';
import {
  useWorkOrder,
  useUpdateWorkOrderStatus,
  useUpdateWorkOrderTasks,
  useWorkOrderAttachments,
  useUploadWorkOrderAttachment,
} from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { useAuthStore } from '../store/authStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));
jest.mock('../api/hooks', () => ({
  useWorkOrder: jest.fn(),
  useUpdateWorkOrderStatus: jest.fn(),
  useUpdateWorkOrderTasks: jest.fn(),
  useWorkOrderAttachments: jest.fn(),
  useUploadWorkOrderAttachment: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('WorkOrderDetailScreen', () => {
  const navigateMock = jest.fn();
  const goBackMock = jest.fn();
  const workOrder = {
    id: 'wo-1',
    organisation_id: 'org-1',
    site_id: 'site-1',
    device_id: 'device-1',
    alert_id: 'alert-1',
    title: 'Fix pump',
    description: 'Initial notes',
    status: 'open',
    priority: 'medium',
    assignee_user_id: null,
    created_by_user_id: 'user-1',
    due_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    site_name: 'Site 1',
    device_name: 'Device 1',
    alert_severity: 'warning',
    tasks: [
      { id: 'task-1', label: 'Inspect', is_completed: false, position: 0 },
      { id: 'task-2', label: 'Record readings', is_completed: false, position: 1 },
    ],
    attachments: [],
  };
  const statusMutate = jest.fn();
  const tasksMutate = jest.fn();
  const uploadMutate = jest.fn();
  const renderWorkOrderScreen = async () => {
    render(<WorkOrderDetailScreen />);
    await act(async () => {});
  };

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          role: 'owner',
        },
      });
    });
    (navigation.useNavigation as jest.Mock).mockReturnValue({
      navigate: navigateMock,
      goBack: goBackMock,
    });
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { workOrderId: 'wo-1' },
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useWorkOrder as jest.Mock).mockReturnValue({
      data: workOrder,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useUpdateWorkOrderStatus as jest.Mock).mockReturnValue({
      mutateAsync: statusMutate,
      isPending: false,
    });
    (useUpdateWorkOrderTasks as jest.Mock).mockReturnValue({
      mutateAsync: tasksMutate,
      isPending: false,
    });
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });
    (useUploadWorkOrderAttachment as jest.Mock).mockReturnValue({
      mutateAsync: uploadMutate,
      isPending: false,
    });
  });

  it('updates status when action pressed', async () => {
    await renderWorkOrderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('start-work-button'));
    });

    expect(statusMutate).toHaveBeenCalledWith({ workOrderId: 'wo-1', status: 'in_progress' });
  });

  it('toggles task completion', async () => {
    await renderWorkOrderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('task-task-1'));
    });

    expect(tasksMutate).toHaveBeenCalledWith({
      workOrderId: 'wo-1',
      tasks: [
        { label: 'Inspect', is_completed: true, position: 0 },
        { label: 'Record readings', is_completed: false, position: 1 },
      ],
    });
  });

  it('disables actions when offline', () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    render(<WorkOrderDetailScreen />);

    expect(screen.getByTestId('start-work-button')).toHaveProp('disabled', true);
    expect(screen.getByTestId('save-notes-button')).toHaveProp('disabled', true);
  });

  it('renders contractor read-only state', async () => {
    act(() => {
      useAuthStore.setState({
        user: {
          id: 'user-contract',
          email: 'contractor@example.com',
          name: 'Contractor',
          role: 'contractor',
        },
      });
    });

    await renderWorkOrderScreen();

    expect(screen.queryAllByText(/Read-only access/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('start-work-button')).toHaveProp('disabled', true);
    expect(screen.getByTestId('save-notes-button')).toHaveProp('disabled', true);
    expect(screen.queryByTestId('add-attachment-button')).toBeNull();
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ user: null });
    });
  });
});
