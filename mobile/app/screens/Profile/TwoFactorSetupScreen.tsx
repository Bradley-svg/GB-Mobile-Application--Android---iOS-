import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useTwoFactorConfirm,
  useTwoFactorDisable,
  useTwoFactorSetup,
} from '../../api/auth/hooks';
import { Screen, Card, PrimaryButton, GlobalErrorBanner } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import type { AppStackParamList } from '../../navigation/RootNavigator';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const TwoFactorSetupScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing } = theme;
  const setupMutation = useTwoFactorSetup();
  const confirmMutation = useTwoFactorConfirm();
  const disableMutation = useTwoFactorDisable();
  const { user, setUser } = useAuthStore((s) => ({ user: s.user, setUser: s.setUser }));

  useEffect(() => {
    setupMutation.mutate(undefined, {
      onSuccess: (data) => {
        setSecret(data.secret);
        setOtpauthUrl(data.otpauthUrl);
      },
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? 'Could not start 2FA setup.');
        } else {
          setError('Could not start 2FA setup.');
        }
      },
    });
  }, []);

  const onConfirm = async () => {
    setError(null);
    try {
      await confirmMutation.mutateAsync({ code: code.trim() });
      if (user) {
        setUser({ ...user, two_factor_enabled: true });
      }
      navigation.goBack();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError('Invalid code. Please try again.');
        } else {
          setError(err.response?.data?.message ?? 'Could not verify code.');
        }
      } else {
        setError('Could not verify code.');
      }
    }
  };

  const onDisable = async () => {
    setError(null);
    try {
      await disableMutation.mutateAsync();
      if (user) {
        setUser({ ...user, two_factor_enabled: false });
      }
      setSecret(null);
      setOtpauthUrl(null);
      setCode('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Could not disable 2FA.');
      } else {
        setError('Could not disable 2FA.');
      }
    }
  };

  return (
    <Screen testID="TwoFactorSetupScreen">
      <Card style={styles.card}>
        <Text style={[typography.title1, styles.title]}>Two-factor authentication</Text>
        <Text style={[typography.body, styles.muted, { marginBottom: spacing.md }]}>
          Add this key to your authenticator app and enter the 6-digit code to confirm.
        </Text>
        {error ? <GlobalErrorBanner message={error} title="Two-factor error" /> : null}
        {secret ? (
          <View style={styles.secretBox} testID="twofactor-secret-box">
            <Text style={[typography.caption, styles.muted]}>Secret key</Text>
            <Text selectable style={[typography.subtitle, { color: colors.textPrimary, letterSpacing: 1 }]}>
              {secret}
            </Text>
            {otpauthUrl ? (
              <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
                otpauth: {otpauthUrl}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[typography.caption, styles.muted]} testID="twofactor-loading">
            Generating your 2FA secret...
          </Text>
        )}

        <Text style={[typography.caption, styles.muted, { marginTop: spacing.lg }]}>Verification code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
          placeholder="123456"
          placeholderTextColor={colors.textSecondary}
          testID="twofactor-setup-code"
        />

        <PrimaryButton
          label={confirmMutation.isPending ? 'Verifying...' : 'Confirm 2FA'}
          onPress={onConfirm}
          disabled={confirmMutation.isPending || !secret || code.length < 6}
          testID="twofactor-setup-submit"
        />

        {user?.two_factor_enabled ? (
          <TouchableOpacity onPress={onDisable} disabled={disableMutation.isPending} style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.error }]} testID="twofactor-disable">
              Disable 2FA (requires authenticator removal)
            </Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    card: {
      padding: theme.spacing.lg,
      marginTop: theme.spacing.lg,
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
    secretBox: {
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
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
      letterSpacing: 2,
      textAlign: 'center',
      fontWeight: '600',
    },
  });
