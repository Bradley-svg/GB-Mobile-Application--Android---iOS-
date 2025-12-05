import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    NetInfo.fetch().then((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribe();
  }, []);

  return { isOffline };
}

