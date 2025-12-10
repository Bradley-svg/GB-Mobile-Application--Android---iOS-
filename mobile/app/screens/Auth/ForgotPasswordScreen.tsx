import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton, GlobalErrorBanner } from '../../components';
import { useRequestPasswordReset } from '../../api/hooks';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const requestReset = useRequestPasswordReset();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const backendMessage = (() => {
    if (!requestReset.error) return null;
    if (axios.isAxiosError(requestReset.error)) {
      return requestReset.error.response?.data?.message ?? requestReset.error.message;
    }
    return 'Password reset request failed.';
  })();

  const onSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Email is required.');
      return;
    }

    try {
      setLocalError(null);
      setConfirmation(null);
      await requestReset.mutateAsync({ email: trimmedEmail });
      setConfirmation('If this email exists, a reset link has been sent.');
    } catch (err) {
      console.error('Request password reset failed', err);
    }
  };

  return (
    <Screen testID="ForgotPasswordScreen">
      <View style={styles.logoRow}>
        <Image source={GreenbroLogo} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.hero}>
        <Text style={[typography.title1, styles.title]}>Forgot password?</Text>
        <Text style={[typography.body, styles.muted]}>
          Enter your email to request a password reset link.
        </Text>
      </View>

      <Card style={styles.formCard}>
        {localError ? (
          <GlobalErrorBanner message={localError} title="Check the form" testID="forgot-local-error" />
        ) : null}
        {backendMessage ? (
          <GlobalErrorBanner
            message={backendMessage}
            title="Request failed"
            testID="forgot-backend-error"
          />
        ) : null}
        {confirmation ? (
          <View style={styles.confirmation} testID="forgot-success">
            <Text style={[typography.body, { color: colors.success }]}>{confirmation}</Text>
          </View>
        ) : null}

        <Text style={[typography.caption, styles.muted]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={(value) => {
            setLocalError(null);
            if (requestReset.isError) {
              requestReset.reset();
            }
            setEmail(value);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          testID="forgot-email-input"
        />

        <PrimaryButton
          label={requestReset.isPending ? 'Sending...' : 'Send reset link'}
          onPress={onSubmit}
          disabled={requestReset.isPending}
          testID="forgot-submit-button"
        />

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Back to login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => navigation.navigate('ResetPassword')}
            testID="forgot-have-token"
          >
            <Text style={[typography.body, { color: colors.brandGreen }]}>
              Already have a token? Enter it here
            </Text>
          </TouchableOpacity>
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
    logo: { width: 240, height: 64 },
    hero: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
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
    linksRow: {
      marginTop: theme.spacing.md,
    },
    confirmation: {
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.successSoft,
      borderWidth: 1,
      borderColor: theme.colors.success,
      marginBottom: theme.spacing.md,
    },
  });
