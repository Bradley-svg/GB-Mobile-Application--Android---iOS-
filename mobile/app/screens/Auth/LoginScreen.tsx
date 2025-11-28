import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { useLogin } from '../../api/hooks';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../theme/theme';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('demo@greenbro.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLogin();

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      setError(null);
      const { accessToken, refreshToken, user } = await loginMutation.mutateAsync({
        email,
        password,
      });
      await setAuth({ accessToken, refreshToken, user });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        setError(err.response?.data?.message ?? 'Login failed. Check your credentials.');
      } else {
        console.error(err);
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 20, marginBottom: 16, fontWeight: '700', color: theme.colors.text }}>
        Greenbro Login
      </Text>
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          marginBottom: 8,
          padding: 8,
          borderRadius: 8,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      />
      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          marginBottom: 16,
          padding: 8,
          borderRadius: 8,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      />
      {error ? (
        <Text style={{ color: theme.colors.danger, marginBottom: 12 }} testID="login-error">
          {error}
        </Text>
      ) : null}
      <Button
        title={loginMutation.isPending ? 'Logging in...' : 'Login'}
        onPress={onLogin}
        disabled={loginMutation.isPending}
      />

      <View style={{ marginTop: 16, gap: 8 }}>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={{ color: theme.colors.primary }}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={{ color: theme.colors.primary }}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
