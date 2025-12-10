import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScanDeviceScreen } from '../screens/Scan/ScanDeviceScreen';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { lookupDeviceByCode } from '../api/client';
import { useSites, useAlerts } from '../api/hooks';
import { useNavigation } from '@react-navigation/native';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { loadJsonWithMetadata } from '../utils/storage';
import { useAuthStore } from '../store/authStore';
import { useQrScanner, type QrScannerAdapter } from '../hooks/useQrScanner';

jest.mock('../api/client', () => ({
  lookupDeviceByCode: jest.fn(),
}));

jest.mock('../api/hooks', () => ({
  useSites: jest.fn(),
  useAlerts: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

jest.mock('../hooks/useQrScanner', () => ({
  useQrScanner: jest.fn(),
}));

jest.mock('../utils/storage', () => ({
  loadJsonWithMetadata: jest.fn(),
  saveJson: jest.fn(),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

const navigationMock = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const createMockScanner = (onScan?: (text: string) => void): QrScannerAdapter => ({
  permission: 'granted',
  requestPermission: jest.fn(),
  ScannerView: ({ onCodeScanned, testID }: { onCodeScanned: (text: string) => void; testID?: string }) => (
    <Text
      testID={testID ?? 'scan-device-scanner'}
      onPress={() => (onScan ? onScan('device:mock') : onCodeScanned('device:mock'))}
    >
      mock scanner
    </Text>
  ),
});

describe('ScanDeviceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigationMock.navigate.mockReset();
    navigationMock.goBack.mockReset();
    act(() => {
      useAuthStore.setState({
        user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'owner' },
      });
    });
    (useNavigation as jest.Mock).mockReturnValue(navigationMock);
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useSites as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useAlerts as jest.Mock).mockReturnValue({ data: [], isLoading: false });
    (loadJsonWithMetadata as jest.Mock).mockResolvedValue(null);
    (useQrScanner as jest.Mock).mockReturnValue(createMockScanner());
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ user: null });
    });
  });

  it('shows scan entrypoint on dashboard for allowed roles', async () => {
    render(<DashboardScreen />);
    expect(screen.getByTestId('scan-device-entry')).toBeTruthy();
  });

  it('hides scan entrypoint for contractors', async () => {
    act(() => {
      useAuthStore.setState({
        user: { id: 'user-2', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });
    render(<DashboardScreen />);
    expect(screen.queryByTestId('scan-device-entry')).toBeNull();
  });

  it('navigates to device detail on successful scan', async () => {
    (lookupDeviceByCode as jest.Mock).mockResolvedValue({
      device: { id: 'device-1', site_id: 'site-1' },
      navigateTo: 'deviceDetail',
    });

    render(<ScanDeviceScreen scannerAdapter={createMockScanner()} />);

    fireEvent.press(screen.getByTestId('scan-device-scanner'));

    await waitFor(() =>
      expect(navigationMock.navigate).toHaveBeenCalledWith('DeviceDetail', { deviceId: 'device-1' })
    );
  });

  it('shows not found error for unknown codes', async () => {
    (lookupDeviceByCode as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { code: 'ERR_DEVICE_CODE_NOT_FOUND' } },
    });

    render(<ScanDeviceScreen scannerAdapter={createMockScanner()} />);

    fireEvent.press(screen.getByTestId('scan-device-scanner'));

    await waitFor(() => expect(screen.getByTestId('scan-device-error')).toBeTruthy());
  });

  it('surfaces role restriction when backend returns 403', async () => {
    (lookupDeviceByCode as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { code: 'ERR_QR_FORBIDDEN' } },
    });

    render(<ScanDeviceScreen scannerAdapter={createMockScanner()} />);

    fireEvent.press(screen.getByTestId('scan-device-scanner'));

    await waitFor(() => expect(screen.getByTestId('scan-device-error')).toBeTruthy());
  });

  it('shows network error banner on unexpected failures', async () => {
    (lookupDeviceByCode as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<ScanDeviceScreen scannerAdapter={createMockScanner()} />);

    fireEvent.press(screen.getByTestId('scan-device-scanner'));

    await waitFor(() => expect(screen.getByTestId('scan-device-network-error')).toBeTruthy());
  });

  it('blocks scanning when rendered for contractors', async () => {
    act(() => {
      useAuthStore.setState({
        user: { id: 'user-2', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });

    render(<ScanDeviceScreen scannerAdapter={createMockScanner()} />);

    expect(lookupDeviceByCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('scan-device-restricted')).toBeTruthy();
  });
});
