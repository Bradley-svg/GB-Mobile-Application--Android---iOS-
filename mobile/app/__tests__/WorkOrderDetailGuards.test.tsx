import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { WorkOrderDetailScreen } from '../screens/WorkOrders/WorkOrderDetailScreen';
import {
  useSignedFileUrl,
  useUpdateWorkOrderStatus,
  useUpdateWorkOrderTasks,
  useUploadWorkOrderAttachment,
  useWorkOrder,
  useWorkOrderAttachments,
} from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/hooks', () => ({
  useWorkOrder: jest.fn(),
  useUpdateWorkOrderStatus: jest.fn(),
  useUpdateWorkOrderTasks: jest.fn(),
  useWorkOrderAttachments: jest.fn(),
  useUploadWorkOrderAttachment: jest.fn(),
  useSignedFileUrl: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('WorkOrderDetailScreen guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null });
    (navigation.useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
    });
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: {} });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useUpdateWorkOrderStatus as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useUpdateWorkOrderTasks as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({ data: [], isLoading: false, isFetching: false });
    (useUploadWorkOrderAttachment as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useSignedFileUrl as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('renders an ErrorCard when the work order id is missing', () => {
    (useWorkOrder as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<WorkOrderDetailScreen />);

    expect(screen.getByTestId('workorder-missing')).toBeTruthy();
  });

  it('surfaces a retry state when loading fails', () => {
    const refetch = jest.fn();
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: { workOrderId: 'wo-error' } });
    (useWorkOrder as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<WorkOrderDetailScreen />);

    expect(screen.getByText(/Failed to load work order/i)).toBeTruthy();
    fireEvent.press(screen.getByText(/Retry/i));
    expect(refetch).toHaveBeenCalled();
  });
});
