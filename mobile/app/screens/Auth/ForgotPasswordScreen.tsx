import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { useResetPassword } from '../../api/hooks';
import { theme } from '../../theme/theme';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const resetMutation = useResetPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    setSuccess(null);
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setError(null);
      const res = await resetMutation.mutateAsync({ email: email.trim() });
      setSuccess(res?.message ?? 'If the email exists, a reset link has been sent.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        setError(err.response?.data?.message ?? 'Reset request failed. Please try again.');
      } else {
        console.error(err);
        setError('Reset request failed. Please try again.');
      }
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 20, marginBottom: 16, fontWeight: '700', color: theme.colors.text }}>
        Reset password
      </Text>

      <Text style={{ marginBottom: 4, color: theme.colors.text }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        style={{
          borderWidth: 1,
          marginBottom: 8,
          padding: 8,
          borderRadius: 8,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      />

      {error ? (
        <Text style={{ color: theme.colors.danger, marginBottom: 12 }} testID="reset-error">
          {error}
        </Text>
      ) : null}
      {success ? (
        <Text style={{ color: theme.colors.primary, marginBottom: 12 }} testID="reset-success">
          {success}
        </Text>
      ) : null}

      <Button
        title={resetMutation.isPending ? 'Sending...' : 'Send reset link'}
        onPress={onSubmit}
        disabled={resetMutation.isPending}
      />

      <View style={{ marginTop: 16 }}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: theme.colors.primary }}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
