import React, { useMemo, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import axios from 'axios';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLoginTwoFactor } from '../../api/auth/hooks';
import { Screen, Card, PrimaryButton, GlobalErrorBanner } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type TwoFactorRoute = RouteProp<AuthStackParamList, 'TwoFactor'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const TwoFactorScreen: React.FC = () => {
  const route = useRoute<TwoFactorRoute>();
  const navigation = useNavigation<AuthNavigation>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const loginTwoFactor = useLoginTwoFactor();

  const onSubmit = async () => {
    setError(null);
    try {
      await loginTwoFactor.mutateAsync({
        challengeToken: route.params.challengeToken,
        code: code.trim(),
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError('Invalid or expired code. Please try again.');
        } else {
          setError(err.response?.data?.message ?? 'Could not verify code. Please try again.');
        }
      } else {
        setError('Could not verify code. Please try again.');
      }
    }
  };

  return (
    <Screen testID="TwoFactorScreen">
      <Card style={styles.card}>
        <Text style={[typography.title1, styles.title]}>Two-factor authentication</Text>
        <Text style={[typography.body, styles.muted, { marginBottom: spacing.md }]}>
          Enter the 6-digit code from your authenticator app to continue.
        </Text>
        {error ? <GlobalErrorBanner message={error} title="Invalid code" /> : null}
        <Text style={[typography.caption, styles.muted]}>Code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
          placeholder="123456"
          placeholderTextColor={colors.textSecondary}
          testID="twofactor-code"
        />
        <PrimaryButton
          label={loginTwoFactor.isPending ? 'Verifying...' : 'Verify and continue'}
          onPress={onSubmit}
          disabled={loginTwoFactor.isPending || code.length < 6}
          testID="twofactor-submit"
        />
        <Text style={[typography.caption, styles.muted, { marginTop: spacing.md }]}>
          Signed in as {route.params.email}. Need to go back?
        </Text>
        <PrimaryButton
          label="Back to login"
          onPress={() => navigation.navigate('Login')}
          variant="outline"
          style={{ marginTop: spacing.sm }}
          testID="twofactor-back"
        />
      </Card>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    card: {
      padding: theme.spacing.lg,
      marginTop: theme.spacing.xl,
    },
    title: { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
    muted: { color: theme.colors.textSecondary },
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
