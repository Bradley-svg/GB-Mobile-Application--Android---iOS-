import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { useSignup } from '../../api/hooks';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../theme/theme';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signupMutation = useSignup();

  const onSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setError(null);
      const { accessToken, refreshToken, user } = await signupMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      await setAuth({ accessToken, refreshToken, user });
      Alert.alert('Signup successful', 'Welcome to Greenbro!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        setError(err.response?.data?.message ?? 'Signup failed. Please try again.');
      } else {
        console.error(err);
        setError('Signup failed. Please try again.');
      }
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 20, marginBottom: 16, fontWeight: '700', color: theme.colors.text }}>
        Create an account
      </Text>

      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        style={{
          borderWidth: 1,
          marginBottom: 8,
          padding: 8,
          borderRadius: 8,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      />

      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="jane@example.com"
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
        placeholder="********"
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
        <Text style={{ color: theme.colors.danger, marginBottom: 12 }} testID="signup-error">
          {error}
        </Text>
      ) : null}

      <Button
        title={signupMutation.isPending ? 'Signing up...' : 'Sign up'}
        onPress={onSignup}
        disabled={signupMutation.isPending}
      />

      <View style={{ marginTop: 16 }}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: theme.colors.primary }}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
