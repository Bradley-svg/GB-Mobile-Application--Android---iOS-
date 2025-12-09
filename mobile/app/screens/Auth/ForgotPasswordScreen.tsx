import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <View style={styles.logoRow}>
        <Image source={GreenbroLogo} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.hero}>
        <Text style={[typography.title1, styles.title]}>Password reset</Text>
        <Text style={[typography.body, styles.muted]}>
          Password reset is not available in this build.
        </Text>
      </View>

      <Card style={styles.formCard}>
        <Text style={[typography.body, styles.notice]}>
          Password reset is not available in this build. Please contact support if you need help
          accessing your account.
        </Text>

        <PrimaryButton label="Back to login" onPress={() => navigation.navigate('Login')} />

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Back to login</Text>
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
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
    formCard: {
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    notice: { color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
    linksRow: {
      marginTop: theme.spacing.md,
    },
  });
