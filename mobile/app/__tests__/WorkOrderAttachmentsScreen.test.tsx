import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

describe('WorkOrderDetailScreen attachments', () => {
  const workOrder = {
    id: 'wo-1',
    organisation_id: 'org-1',
    site_id: 'site-1',
    device_id: 'device-1',
    alert_id: null,
    title: 'Fix pump',
    description: '',
    status: 'open',
    priority: 'medium',
    assignee_user_id: null,
    created_by_user_id: 'user-1',
    due_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tasks: [],
    attachments: [],
  };

  beforeEach(() => {
    (navigation.useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
    });
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { workOrderId: 'wo-1' },
    });
    (useWorkOrder as jest.Mock).mockReturnValue({
      data: workOrder,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useUpdateWorkOrderStatus as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    (useUpdateWorkOrderTasks as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    (useUploadWorkOrderAttachment as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
  });

  it('renders empty state when no attachments', () => {
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    render(<WorkOrderDetailScreen />);

    expect(screen.getByText(/No attachments yet/i)).toBeTruthy();
    expect(screen.getByTestId('add-attachment-button')).toBeEnabled();
  });

  it('renders attachment rows', () => {
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({
      data: [
        { id: 'a1', originalName: 'photo.jpg', mimeType: 'image/jpeg', url: '/files/a1' },
        { id: 'a2', originalName: 'manual.pdf', mimeType: 'application/pdf', url: '/files/a2' },
      ],
      isLoading: false,
      isFetching: false,
    });

    render(<WorkOrderDetailScreen />);

    expect(screen.getByText('photo.jpg')).toBeTruthy();
    expect(screen.getByText('manual.pdf')).toBeTruthy();
  });

  it('disables upload when offline', () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    render(<WorkOrderDetailScreen />);

    expect(screen.queryByTestId('add-attachment-button')).toBeNull();
    expect(screen.getByText(/Attachments can only be added when online/i)).toBeTruthy();
  });
});
