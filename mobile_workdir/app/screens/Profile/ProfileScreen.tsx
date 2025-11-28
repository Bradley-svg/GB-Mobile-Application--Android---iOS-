import React from 'react';
import { View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/authStore';
import { PUSH_TOKEN_REGISTERED_KEY } from '../../hooks/useRegisterPushToken';
import { theme } from '../../theme/theme';

export const ProfileScreen: React.FC = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  const onLogout = async () => {
    await AsyncStorage.removeItem(PUSH_TOKEN_REGISTERED_KEY);
    await clearAuth();
  };

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: theme.colors.background }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, color: theme.colors.text }}>
        Profile
      </Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>{user?.name ?? 'User'}</Text>
      <Text style={{ marginBottom: 16, color: theme.colors.mutedText }}>{user?.email ?? ''}</Text>
      <Button title="Log out" onPress={onLogout} />
    </View>
  );
};
