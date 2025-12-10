import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { DeviceDetailScreen } from '../screens/Device/DeviceDetailScreen';
import { WorkOrderDetailScreen } from '../screens/WorkOrders/WorkOrderDetailScreen';
import { ShareLinksScreen } from '../screens/Sharing/ShareLinksScreen';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceCommands,
  useDeviceSchedule,
  useDeviceTelemetry,
  useHeatPumpHistory,
  useModeCommand,
  useSetpointCommand,
  useSite,
  useUpsertDeviceSchedule,
  useWorkOrder,
  useUpdateWorkOrderStatus,
  useUpdateWorkOrderTasks,
  useWorkOrderAttachments,
  useUploadWorkOrderAttachment,
  useSignedFileUrl,
} from '../api/hooks';
import { useShareLinks, useCreateShareLink, useRevokeShareLink } from '../api/shareLinks/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/hooks', () => ({
  useDevice: jest.fn(),
  useDeviceAlerts: jest.fn(),
  useDeviceTelemetry: jest.fn(),
  useModeCommand: jest.fn(),
  useSetpointCommand: jest.fn(),
  useDeviceSchedule: jest.fn(),
  useUpsertDeviceSchedule: jest.fn(),
  useDeviceCommands: jest.fn(),
  useSite: jest.fn(),
  useHeatPumpHistory: jest.fn(),
  useWorkOrder: jest.fn(),
  useUpdateWorkOrderStatus: jest.fn(),
  useUpdateWorkOrderTasks: jest.fn(),
  useWorkOrderAttachments: jest.fn(),
  useUploadWorkOrderAttachment: jest.fn(),
  useSignedFileUrl: jest.fn(),
}));

jest.mock('../api/shareLinks/hooks', () => ({
  useShareLinks: jest.fn(),
  useCreateShareLink: jest.fn(),
  useRevokeShareLink: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

const baseDevice = {
  id: 'device-1',
  site_id: 'site-1',
  name: 'Heat Pump',
  type: 'hp',
  status: 'online',
  external_id: 'dev-1',
  mac: 'AA:BB:CC:DD:EE:FF',
  last_seen_at: '2025-01-01T00:00:00.000Z',
};

const baseWorkOrder = {
  id: 'wo-1',
  organisation_id: 'org-1',
  site_id: 'site-1',
  device_id: 'device-1',
  title: 'Inspect pump',
  description: 'Check compressor readings',
  status: 'open' as const,
  priority: 'medium' as const,
  assignee_user_id: null,
  created_by_user_id: 'user-1',
  due_at: null,
  sla_due_at: null,
  resolved_at: null,
  sla_breached: false,
  reminder_at: null,
  category: 'maintenance',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  site_name: 'Demo Site',
  device_name: 'Heat Pump',
  alert_severity: null,
  alert_id: null,
  tasks: [{ id: 'task-1', label: 'Check flow', is_completed: false }],
  attachments: [],
};

const shareLinks = [
  {
    id: 'link-1',
    token: 'token-123',
    scope: 'site' as const,
    scopeId: 'site-1',
    permissions: 'read_only',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdBy: { name: 'Admin User', email: 'admin@example.com' },
  },
];

const renderDeviceScreen = async () => {
  render(<DeviceDetailScreen />);
  await act(async () => {});
};

const renderWorkOrderScreen = async () => {
  render(<WorkOrderDetailScreen />);
  await act(async () => {});
};

const renderShareLinksScreen = async () => {
  render(<ShareLinksScreen />);
  await act(async () => {});
};

describe('navigation role guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => useAuthStore.setState({ user: null }));
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (navigation.useNavigation as jest.Mock).mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() });
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: {} });

    (useDevice as jest.Mock).mockReturnValue({
      data: baseDevice,
      isLoading: false,
      isError: false,
    });
    (useSite as jest.Mock).mockReturnValue({
      data: { id: 'site-1', name: 'Demo Site', city: 'Cape Town' },
      isLoading: false,
      isError: false,
    });
    (useDeviceTelemetry as jest.Mock).mockReturnValue({
      data: {
        range: '24h',
        metrics: {
          supply_temp: [],
          return_temp: [],
          power_kw: [],
          flow_rate: [],
          cop: [],
        },
      },
      isLoading: false,
      isError: false,
    });
    (useDeviceAlerts as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    (useDeviceCommands as jest.Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    (useSetpointCommand as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useModeCommand as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useDeviceSchedule as jest.Mock).mockReturnValue({
      data: {
        id: 'sched-1',
        device_id: baseDevice.id,
        name: 'Daily',
        enabled: true,
        start_hour: 6,
        end_hour: 18,
        target_setpoint: 45,
        target_mode: 'HEATING',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    });
    (useUpsertDeviceSchedule as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useHeatPumpHistory as jest.Mock).mockReturnValue({ data: { series: [] }, isLoading: false, isError: false });

    (useWorkOrder as jest.Mock).mockReturnValue({
      data: baseWorkOrder,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useUpdateWorkOrderStatus as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useUpdateWorkOrderTasks as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useWorkOrderAttachments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });
    (useUploadWorkOrderAttachment as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useSignedFileUrl as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    (useShareLinks as jest.Mock).mockReturnValue({
      data: shareLinks,
      isLoading: false,
      isError: false,
    });
    (useCreateShareLink as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    (useRevokeShareLink as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  afterEach(() => {
    act(() => useAuthStore.setState({ user: null }));
  });

  it('disables device control actions for contractors but not admins', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: { deviceId: baseDevice.id } });

    act(() => {
      useAuthStore.setState({
        user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });
    });
    await renderDeviceScreen();
    expect(screen.getByTestId('setpoint-button')).toHaveProp('disabled', false);

    jest.clearAllMocks();
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: { deviceId: baseDevice.id } });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useDevice as jest.Mock).mockReturnValue({
      data: baseDevice,
      isLoading: false,
      isError: false,
    });

    act(() => {
      useAuthStore.setState({
        user: { id: 'contractor-1', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });
    await renderDeviceScreen();
    expect(screen.getByTestId('setpoint-button')).toHaveProp('disabled', true);
    expect(screen.getAllByText(/Read-only access/i).length).toBeGreaterThan(0);
  });

  it('enforces read-only work order status changes for contractors', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: { workOrderId: baseWorkOrder.id } });
    act(() => {
      useAuthStore.setState({
        user: { id: 'contractor-1', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });

    await renderWorkOrderScreen();
    expect(screen.getByTestId('start-work-button')).toHaveProp('disabled', true);
    expect(screen.getByTestId('workorder-role-hint')).toBeTruthy();
  });

  it('leaves work order status controls enabled for admins', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({ params: { workOrderId: baseWorkOrder.id } });
    act(() => {
      useAuthStore.setState({
        user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });
    });

    await renderWorkOrderScreen();
    expect(screen.getByTestId('start-work-button')).toHaveProp('disabled', false);
  });

  it('blocks contractors from creating or revoking share links', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { scope: 'site', id: 'site-1', name: 'Demo Site' },
    });
    act(() => {
      useAuthStore.setState({
        user: { id: 'contractor-1', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });

    await renderShareLinksScreen();

    const createButtons = screen.getAllByTestId('create-share-link');
    createButtons.forEach((button) => expect(button.props.disabled).toBe(true));
    expect(screen.getByTestId('revoke-share-link').props.disabled).toBe(true);
    expect(screen.getByTestId('share-links-role-hint')).toBeTruthy();
  });

  it('keeps share link management enabled for admins', async () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { scope: 'site', id: 'site-1', name: 'Demo Site' },
    });
    act(() => {
      useAuthStore.setState({
        user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });
    });

    await renderShareLinksScreen();

    const createButtons = screen.getAllByTestId('create-share-link');
    createButtons.forEach((button) => expect(button.props.disabled).toBe(false));
    expect(screen.getByTestId('revoke-share-link').props.disabled).toBe(false);
    expect(screen.queryByTestId('share-links-role-hint')).toBeNull();
  });
});
