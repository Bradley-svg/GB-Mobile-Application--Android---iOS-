import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { useResetPassword } from '../../api/hooks';
import { Screen, Card, PrimaryButton } from '../../theme/components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

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
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[typography.title1, styles.title]}>Reset password</Text>
        <Text style={[typography.body, styles.muted]}>We will send a reset link to your email</Text>
      </View>

      <Card style={styles.formCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />

        {error ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.sm }]} testID="reset-error">
            {error}
          </Text>
        ) : null}
        {success ? (
          <Text style={[typography.caption, { color: colors.primary, marginBottom: spacing.sm }]} testID="reset-success">
            {success}
          </Text>
        ) : null}

        <PrimaryButton
          label={resetMutation.isPending ? 'Sending...' : 'Send reset link'}
          onPress={onSubmit}
          disabled={resetMutation.isPending}
        />

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[typography.body, { color: colors.primary }]}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logo: { width: 40, height: 40 },
  title: { color: colors.dark },
  muted: { color: colors.textSecondary },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  linksRow: {
    marginTop: spacing.md,
  },
});
