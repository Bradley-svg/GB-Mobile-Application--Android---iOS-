import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export const LoginScreen: React.FC = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('demo@greenbro.com');
  const [password, setPassword] = useState('password');
  const [submitting, setSubmitting] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = res.data;
      await setAuth({ accessToken, refreshToken, user });
    } catch (e: any) {
      console.error(e.response?.data || e);
      Alert.alert('Login failed', 'Check your credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, marginBottom: 16 }}>Greenbro Login</Text>
      <Text>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }}
      />
      <Text>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
      />
      <Button title={submitting ? 'Logging in...' : 'Login'} onPress={onLogin} disabled={submitting} />
    </View>
  );
};
