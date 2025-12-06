import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import type { NetInfoState } from '@react-native-community/netinfo';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { getSafeNetInfo } from '../lib/safeNetInfo';

jest.mock('../lib/safeNetInfo');

const mockGetSafeNetInfo = getSafeNetInfo as jest.Mock;

const TestComponent = () => {
  const { isOffline } = useNetworkBanner();
  return <Text>{isOffline ? 'offline' : 'online'}</Text>;
};

describe('useNetworkBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockGetSafeNetInfo.mockReset();
  });

  it('uses NetInfo when available and updates offline state', async () => {
    const unsubscribe = jest.fn();
    let handler: ((state: NetInfoState) => void) | undefined;

    const addEventListener = jest.fn((cb: (state: NetInfoState) => void) => {
      handler = cb;
      return unsubscribe;
    });
    const fetch = jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    mockGetSafeNetInfo.mockReturnValue({ addEventListener, fetch });

    const { getByText, unmount } = render(<TestComponent />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    act(() => {
      handler?.({ isConnected: false, isInternetReachable: false });
    });

    await waitFor(() => getByText('offline'));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('falls back to online when NetInfo is unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSafeNetInfo.mockImplementation(() => {
      console.warn(
        'NetInfo native module not available - treating app as always-online. Rebuild the dev client with @react-native-community/netinfo installed.'
      );
      return null;
    });

    const { findByText } = render(<TestComponent />);

    expect(await findByText('online')).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith(
      'NetInfo native module not available - treating app as always-online. Rebuild the dev client with @react-native-community/netinfo installed.'
    );
  });
});
