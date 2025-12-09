import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Image } from 'react-native';
import axios from 'axios';
import { useLogin } from '../../api/hooks';
import { Screen, Card, PrimaryButton } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('demo@greenbro.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLogin();
  const setSessionExpired = useAuthStore((s) => s.setSessionExpired);
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      setError(null);
      setSessionExpired(false);
      console.log('LoginScreen: submitting login', { email: trimmedEmail });
      await loginMutation.mutateAsync({
        email: trimmedEmail,
        password: trimmedPassword,
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        const status = err.response?.status;
        if (status === 401) {
          setError('Incorrect email or password.');
        } else if (status && status >= 500) {
          setError('Server unavailable, please try again.');
        } else {
          setError(err.response?.data?.message ?? 'Login failed. Check your credentials.');
        }
      } else {
        console.error(err);
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <Screen testID="LoginScreen">
      <View style={styles.logoRow}>
        <Image source={GreenbroLogo} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.hero}>
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
          testID="login-email"
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[typography.caption, styles.muted]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          testID="login-password"
          placeholder="********"
          placeholderTextColor={colors.textSecondary}
        />

        {error ? (
          <Text style={[typography.caption, { color: colors.error, marginBottom: spacing.sm }]} testID="login-error">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={loginMutation.isPending ? 'Logging in...' : 'Login'}
          onPress={onLogin}
          disabled={loginMutation.isPending}
          testID="login-button"
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

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    logoRow: {
      alignItems: 'center',
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
    },
    logo: {
      width: 260,
      height: 70,
    },
    hero: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
    formCard: {
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.backgroundAlt,
      borderRadius: 16,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      color: theme.colors.textPrimary,
    },
    notice: {
      marginTop: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    noticePrimary: { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
    noticeSecondary: { color: theme.colors.textSecondary },
  });
