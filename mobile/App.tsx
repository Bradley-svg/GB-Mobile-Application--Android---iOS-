import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './app/navigation/RootNavigator';
import { useAuthStore } from './app/store/authStore';
import { api } from './app/api/client';
import { usePushRegistration } from './app/hooks/usePushRegistration';
import { useNetworkBanner } from './app/hooks/useNetworkBanner';
import { queryClient } from './app/queryClient';
import { AppThemeProvider } from './app/theme/ThemeProvider';
import { useAppTheme } from './app/theme/useAppTheme';
import { useSyncNavigationBar } from './app/theme/useSyncNavigationBar';
import { ThemedStatusBar } from './app/theme/ThemedStatusBar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AppContent: React.FC = () => {
  console.log('App: render start');
  const { theme } = useAppTheme();
  useSyncNavigationBar();
  const { isHydrated, user, accessToken, hydrateFromSecureStore, setUser, clearAuth, sessionExpired } =
    useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const isAuthenticated = !!user;
  const { isOffline } = useNetworkBanner();

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

  usePushRegistration();

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
        <RootNavigator isAuthenticated={isAuthenticated} sessionExpired={sessionExpired} />
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
