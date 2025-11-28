import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export const ProfileScreen: React.FC = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Profile</Text>
      <Text style={{ marginBottom: 16 }}>{user?.email ?? 'Logged in user'}</Text>
      <Button title="Log out" onPress={clearAuth} />
    </View>
  );
};
