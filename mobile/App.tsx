import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './app/navigation/RootNavigator';
import { useAuthStore } from './app/store/authStore';
import { api } from './app/api/client';
import { useRegisterPushToken } from './app/hooks/useRegisterPushToken';
import { colors } from './app/theme/colors';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const isTestEnv = process.env.JEST_WORKER_ID !== undefined;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      ...(isTestEnv ? { gcTime: 0 } : {}),
    },
  },
});

export default function App() {
  const { isHydrated, user, accessToken, hydrateFromSecureStore, setUser, clearAuth } =
    useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    hydrateFromSecureStore();
  }, [hydrateFromSecureStore]);

  useEffect(() => {
    const loadUser = async () => {
      if (!isHydrated) return;
      if (!accessToken) {
        setAuthChecked(true);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (e) {
        console.error('Failed to load current user', e);
        await clearAuth();
      } finally {
        setAuthChecked(true);
      }
    };

    loadUser();
  }, [accessToken, clearAuth, isHydrated, setUser]);

  useRegisterPushToken();

  if (!isHydrated || !authChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const isAuthenticated = !!user;
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <RootNavigator isAuthenticated={isAuthenticated} />
      </View>
    </QueryClientProvider>
  );
}
