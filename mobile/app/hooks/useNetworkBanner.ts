import { useEffect, useState } from 'react';
import type { NetInfoState } from '@react-native-community/netinfo';
import { getSafeNetInfo } from '../lib/safeNetInfo';

type NetworkState = {
  isOffline: boolean;
  lastChangeAt: string | null;
  source: 'init' | 'netinfo' | 'fallback';
};

export function useNetworkBanner() {
  const [state, setState] = useState<NetworkState>({
    isOffline: false,
    lastChangeAt: null,
    source: 'init',
  });

  useEffect(() => {
    const netInfo = getSafeNetInfo();
    if (!netInfo) {
      // No native support: mark as online and skip subscriptions.
      setState({ isOffline: false, lastChangeAt: null, source: 'fallback' });
      return;
    }

    const unsubscribe = netInfo.addEventListener((eventState: NetInfoState) => {
      const isOffline =
        eventState.isConnected === false || eventState.isInternetReachable === false;
      setState({
        isOffline,
        lastChangeAt: new Date().toISOString(),
        source: 'netinfo',
      });
    });

    netInfo
      .fetch()
      .then((initialState: NetInfoState) => {
        const isOffline =
          initialState.isConnected === false || initialState.isInternetReachable === false;
        setState({
          isOffline,
          lastChangeAt: new Date().toISOString(),
          source: 'netinfo',
        });
      })
      .catch(() => {
        setState({ isOffline: false, lastChangeAt: null, source: 'fallback' });
      });

    return () => unsubscribe();
  }, []);

  return { isOffline: state.isOffline };
}

