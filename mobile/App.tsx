import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './app/navigation/RootNavigator';
import { navigationRef } from './app/navigation/navigationRef';
import { useAuthStore } from './app/store/authStore';
import { api } from './app/api/client';
import { usePushRegistration } from './app/hooks/usePushRegistration';
import { useNetworkBanner } from './app/hooks/useNetworkBanner';
import { queryClient } from './app/queryClient';
import { AppThemeProvider } from './app/theme/ThemeProvider';
import { useAppTheme } from './app/theme/useAppTheme';
import { useSyncNavigationBar } from './app/theme/useSyncNavigationBar';
import { ThemedStatusBar } from './app/theme/ThemedStatusBar';
import { InAppNotificationBanner } from './app/components/InAppNotificationBanner';
import {
  handleNotificationReceived,
  handleNotificationResponse,
  type AlertNotificationInstruction,
  type NotificationInstruction,
} from './app/notifications/notificationHandler';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type InAppNotificationState = {
  title: string;
  message?: string;
  instruction: NotificationInstruction;
};

const AppContent: React.FC = () => {
  console.log('App: render start');
  const { theme } = useAppTheme();
  useSyncNavigationBar();
  const { isHydrated, user, accessToken, hydrateFromSecureStore, setUser, clearAuth, sessionExpired } =
    useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<AlertNotificationInstruction | null>(null);
  const [inAppNotification, setInAppNotification] = useState<InAppNotificationState | null>(null);
  const isAuthenticated = !!user;
  const { isOffline } = useNetworkBanner();

  const navigateToAlert = useCallback(
    (instruction: AlertNotificationInstruction) => {
      if (!navigationReady || !isAuthenticated) {
        setPendingNavigation(instruction);
        return;
      }

      if (instruction.alertId) {
        navigationRef.navigate('App', { screen: 'AlertDetail', params: { alertId: instruction.alertId } });
      } else if (instruction.deviceId) {
        navigationRef.navigate('App', { screen: 'DeviceDetail', params: { deviceId: instruction.deviceId } });
      } else {
        navigationRef.navigate('App', { screen: 'Tabs', params: { screen: 'Alerts' } });
      }
      setPendingNavigation(null);
      setInAppNotification(null);
    },
    [isAuthenticated, navigationReady]
  );

  const handleNavigationReady = useCallback(() => {
    setNavigationReady(true);
  }, []);

  const handleBannerPress = useCallback(() => {
    if (!inAppNotification) return;
    if (inAppNotification.instruction.kind === 'alert') {
      navigateToAlert(inAppNotification.instruction);
    }
    setInAppNotification(null);
  }, [inAppNotification, navigateToAlert]);

  const handleBannerDismiss = useCallback(() => {
    setInAppNotification(null);
  }, []);

  useEffect(() => {
    console.log('App: hydrateFromSecureStore invoked');
    hydrateFromSecureStore();
  }, [hydrateFromSecureStore]);

  useEffect(() => {
    const loadUser = async () => {
      console.log('App: loadUser check', {
        isHydrated,
        hasAccessToken: !!accessToken,
      });
      if (!isHydrated) return;
      if (!accessToken) {
        console.log('App: no access token, skipping /auth/me fetch');
        setAuthChecked(true);
        return;
      }

      try {
        console.log('App: fetching /auth/me with access token');
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          await clearAuth();
        } else {
          console.error('Failed to load current user', e);
        }
      } finally {
        setAuthChecked(true);
      }
    };

    loadUser();
  }, [accessToken, clearAuth, isHydrated, setUser]);

  useEffect(() => {
    console.log('App: auth state updated', {
      isHydrated,
      authChecked,
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      isAuthenticated,
    });
  }, [accessToken, authChecked, isAuthenticated, isHydrated, user]);

  useEffect(() => {
    if (!pendingNavigation) return;
    if (!navigationReady || !isAuthenticated) return;
    navigateToAlert(pendingNavigation);
  }, [isAuthenticated, navigateToAlert, navigationReady, pendingNavigation]);

  usePushRegistration();

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const instruction = handleNotificationReceived(notification);
      if (instruction.kind === 'alert') {
        setInAppNotification({
          title: instruction.title ?? 'New alert',
          message: instruction.body ?? instruction.summary ?? 'Tap to view alert',
          instruction,
        });
      } else if (instruction.kind === 'test') {
        setInAppNotification({
          title: instruction.title ?? 'Test notification',
          message: instruction.body ?? 'Test notification received',
          instruction,
        });
      }
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const instruction = handleNotificationResponse(response);
      if (instruction.kind === 'unknown') return;
      if (instruction.kind === 'alert') {
        navigateToAlert(instruction);
      } else if (instruction.kind === 'test') {
        setInAppNotification({
          title: instruction.title ?? 'Test notification',
          message: instruction.body ?? 'Test notification received',
          instruction,
        });
      }
    });

    const hydrateInitialResponse = async () => {
      const initialResponse = await Notifications.getLastNotificationResponseAsync?.();
      if (!initialResponse) return;
      const instruction = handleNotificationResponse(initialResponse as Notifications.NotificationResponse);
      if (instruction.kind === 'alert') {
        navigateToAlert(instruction);
      } else if (instruction.kind === 'test') {
        setInAppNotification({
          title: instruction.title ?? 'Test notification',
          message: instruction.body ?? 'Test notification received',
          instruction,
        });
      }
    };

    hydrateInitialResponse();

    return () => {
      if (receivedSub?.remove) {
        receivedSub.remove();
      } else if (receivedSub) {
        Notifications.removeNotificationSubscription?.(receivedSub as Notifications.Subscription);
      }
      if (responseSub?.remove) {
        responseSub.remove();
      } else if (responseSub) {
        Notifications.removeNotificationSubscription?.(responseSub as Notifications.Subscription);
      }
    };
  }, [navigateToAlert]);

  if (!isHydrated || !authChecked) {
    console.log('App: waiting for hydration', {
      isHydrated,
      authChecked,
      hasAccessToken: !!accessToken,
    });
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ThemedStatusBar />
        <Text style={{ color: theme.colors.textPrimary }}>Loading...</Text>
      </View>
    );
  }

  console.log('App: rendering RootNavigator', {
    isAuthenticated,
    isHydrated,
    authChecked,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isOffline ? (
          <View
            style={{
              backgroundColor: theme.colors.backgroundAlt,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderColor: theme.colors.borderSubtle,
            }}
          >
            <Text style={{ color: theme.colors.textSecondary }}>
              {"You're offline. Showing last known data where available."}
            </Text>
          </View>
        ) : null}
        {inAppNotification ? (
          <InAppNotificationBanner
            title={inAppNotification.title}
            message={inAppNotification.message}
            onPress={handleBannerPress}
            onDismiss={handleBannerDismiss}
            testID="in-app-notification"
          />
        ) : null}
        <RootNavigator
          isAuthenticated={isAuthenticated}
          sessionExpired={sessionExpired}
          navigationRef={navigationRef}
          onReady={handleNavigationReady}
        />
      </View>
    </QueryClientProvider>
  );
};

export default function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}
