import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
  console.log('App: render start');
  const { isHydrated, user, accessToken, hydrateFromSecureStore, setUser, clearAuth } =
    useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const isAuthenticated = !!user;

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

  useRegisterPushToken();

  if (!isHydrated || !authChecked) {
    console.log('App: waiting for hydration', {
      isHydrated,
      authChecked,
      hasAccessToken: !!accessToken,
    });
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <RootNavigator isAuthenticated={isAuthenticated} />
      </View>
    </QueryClientProvider>
  );
}
