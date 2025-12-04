import React, { useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, Image } from 'react-native';
import axios from 'axios';
import { useLogin } from '../../api/hooks';
import { Screen, Card, PrimaryButton } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import logo from '../../../assets/icon.png';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('demo@greenbro.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLogin();

  const onLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      setError(null);
      console.log('LoginScreen: submitting login', { email: trimmedEmail });
      await loginMutation.mutateAsync({
        email: trimmedEmail,
        password: trimmedPassword,
      });
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
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[typography.title1, styles.title]}>Welcome back</Text>
        <Text style={[typography.body, styles.muted]}>Monitor and control your Greenbro fleet</Text>
      </View>

      <Card style={styles.formCard}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.sm }]}>Greenbro Login</Text>

        <Text style={[typography.caption, styles.muted]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[typography.caption, styles.muted]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="********"
          placeholderTextColor={colors.textMuted}
        />

        {error ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.sm }]} testID="login-error">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={loginMutation.isPending ? 'Logging in...' : 'Login'}
          onPress={onLogin}
          disabled={loginMutation.isPending}
        />
        <View style={styles.notice}>
          <Text style={[typography.body, styles.noticePrimary]}>
            New account creation is disabled. Contact support.
          </Text>
          <Text style={[typography.caption, styles.noticeSecondary]}>
            Password reset is not available in this build.
          </Text>
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
  logo: {
    width: 40,
    height: 40,
  },
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
  notice: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  noticePrimary: { color: colors.textPrimary, marginBottom: spacing.xs },
  noticeSecondary: { color: colors.textSecondary },
});
