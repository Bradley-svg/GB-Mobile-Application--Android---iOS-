import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Image, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLogin } from '../../api/hooks';
import { Screen, Card, PrimaryButton, GlobalErrorBanner } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type LoginRoute = RouteProp<AuthStackParamList, 'Login'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const route = useRoute<LoginRoute>();
  const [email, setEmail] = useState('demo@greenbro.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    route.params?.resetSuccessMessage ?? null
  );
  const loginMutation = useLogin();
  const setSessionExpired = useAuthStore((s) => s.setSessionExpired);
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const parseLockoutMessage = (err: unknown) => {
    if (!axios.isAxiosError(err)) return null;
    const status = err.response?.status;
    if (status !== 429) return null;

    const lockedUntilRaw = (err.response?.data as { lockedUntil?: string } | undefined)?.lockedUntil;
    const retryAfter = err.response?.headers?.['retry-after'];
    const lockedUntil = lockedUntilRaw ? new Date(lockedUntilRaw) : null;
    const retrySeconds = retryAfter ? Number(retryAfter) : null;
    let minutes: number | null = null;

    if (lockedUntil && !Number.isNaN(lockedUntil.getTime())) {
      minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / (60 * 1000)));
    } else if (Number.isFinite(retrySeconds)) {
      minutes = Math.max(1, Math.ceil((retrySeconds as number) / 60));
    }

    const waitCopy = minutes
      ? ` Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before trying again.`
      : ' Please wait before trying again.';
    return `Too many failed attempts.${waitCopy}`;
  };

  useEffect(() => {
    if (route.params?.resetSuccessMessage) {
      setSuccessMessage(route.params.resetSuccessMessage);
    }
  }, [route.params?.resetSuccessMessage]);

  const onLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
      setSessionExpired(false);
      console.log('LoginScreen: submitting login', { email: trimmedEmail });
      const result = await loginMutation.mutateAsync({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (result?.requires2fa && result.challengeToken) {
        navigation.navigate('TwoFactor', { challengeToken: result.challengeToken, email: trimmedEmail });
      } else if (result?.twoFactorSetupRequired) {
        setError('Two-factor authentication is required for your role. Please enable 2FA in your profile.');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        const status = err.response?.status;
        const lockout = parseLockoutMessage(err);
        if (lockout) {
          setError(lockout);
        } else if (status === 401) {
          setError('Invalid email or password.');
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

        {successMessage ? (
          <View style={styles.successBanner} testID="login-success-banner">
            <Text style={[typography.body, { color: colors.success }]}>{successMessage}</Text>
          </View>
        ) : null}
        {error ? (
          <GlobalErrorBanner
            message={error}
            title="Unable to login"
            testID="login-error-banner"
          />
        ) : null}

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

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.linkRow}
          testID="login-forgot-password"
        >
          <Text style={[typography.caption, { color: colors.brandGreen }]}>Forgot password?</Text>
        </TouchableOpacity>

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
            TODO: prompt for 2FA here when enabled.
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
    linkRow: {
      alignItems: 'flex-end',
      marginBottom: theme.spacing.md,
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
    successBanner: {
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.successSoft,
      borderWidth: 1,
      borderColor: theme.colors.success,
      marginBottom: theme.spacing.md,
    },
  });
