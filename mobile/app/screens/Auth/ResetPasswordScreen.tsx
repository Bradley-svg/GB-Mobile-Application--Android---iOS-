import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton, GlobalErrorBanner } from '../../components';
import { useResetPassword } from '../../api/hooks';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type ResetRoute = RouteProp<AuthStackParamList, 'ResetPassword'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const route = useRoute<ResetRoute>();
  const [token, setToken] = useState(route.params?.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const resetMutation = useResetPassword();
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const backendMessage = (() => {
    if (!resetMutation.error) return null;
    if (axios.isAxiosError(resetMutation.error)) {
      return resetMutation.error.response?.data?.message ?? resetMutation.error.message;
    }
    return 'Password reset failed. Please try again.';
  })();

  const onSubmit = async () => {
    const trimmedToken = token.trim();
    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedToken) {
      setLocalError('Reset token is required.');
      return;
    }
    if (!trimmedPassword || !trimmedConfirm) {
      setLocalError('New password and confirmation are required.');
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      setLocalError(null);
      await resetMutation.mutateAsync({ token: trimmedToken, password: trimmedPassword });
      navigation.navigate('Login', {
        resetSuccessMessage: 'Password reset successful. You can log in with your new password.',
      });
    } catch (err) {
      console.error('Reset password failed', err);
    }
  };

  const resetErrors = () => {
    setLocalError(null);
    if (resetMutation.isError) {
      resetMutation.reset();
    }
  };

  return (
    <Screen testID="ResetPasswordScreen">
      <View style={styles.header}>
        <Text style={[typography.title1, styles.title]}>Reset password</Text>
        <Text style={[typography.body, styles.muted]}>
          Enter your reset token and choose a new password.
        </Text>
      </View>

      <Card style={styles.formCard}>
        {localError ? (
          <GlobalErrorBanner message={localError} title="Check the form" testID="reset-local-error" />
        ) : null}
        {backendMessage ? (
          <GlobalErrorBanner
            message={backendMessage}
            title="Unable to reset password"
            testID="reset-backend-error"
          />
        ) : null}

        <Text style={[typography.caption, styles.muted]}>Reset token</Text>
        <TextInput
          value={token}
          onChangeText={(value) => {
            resetErrors();
            setToken(value);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste the token from your email"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          testID="reset-token-input"
        />

        <Text style={[typography.caption, styles.muted]}>New password</Text>
        <TextInput
          value={newPassword}
          onChangeText={(value) => {
            resetErrors();
            setNewPassword(value);
          }}
          secureTextEntry
          placeholder="********"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          testID="reset-password-input"
        />

        <Text style={[typography.caption, styles.muted]}>Confirm new password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={(value) => {
            resetErrors();
            setConfirmPassword(value);
          }}
          secureTextEntry
          placeholder="Repeat password"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          testID="reset-confirm-input"
        />

        <PrimaryButton
          label={resetMutation.isPending ? 'Resetting...' : 'Reset password'}
          onPress={onSubmit}
          disabled={resetMutation.isPending}
          testID="reset-submit-button"
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.md }}
          testID="reset-back-to-login"
        >
          <Text style={[typography.body, { color: colors.textSecondary }]}>Back to login</Text>
        </TouchableOpacity>
      </Card>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    header: {
      marginTop: theme.spacing.xl,
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
  });
