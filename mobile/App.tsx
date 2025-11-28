import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { RootNavigator } from './app/navigation/RootNavigator';
import { useAuthStore } from './app/store/authStore';

export default function App() {
  const { isHydrated, user, hydrateFromSecureStore } = useAuthStore();

  useEffect(() => {
    hydrateFromSecureStore();
  }, [hydrateFromSecureStore]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const isAuthenticated = !!user;
  return <RootNavigator isAuthenticated={isAuthenticated} />;
}
