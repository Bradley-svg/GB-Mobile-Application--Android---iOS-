import React, { useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import { createThemedStyles } from '../../theme/createThemedStyles';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const { theme } = useAppTheme();
  const { spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <View style={styles.logoRow}>
        <Image source={GreenbroLogo} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.hero}>
        <Text style={[typography.title1, styles.title]}>Access restricted</Text>
        <Text style={[typography.body, styles.muted]}>
          New account creation is disabled for this pilot.
        </Text>
      </View>

      <Card style={styles.formCard}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.sm }]}>Sign up</Text>
        <View style={styles.notice}>
          <Text style={[typography.body, styles.noticeText]}>
            New account creation is disabled. Contact support to be invited.
          </Text>
        </View>

        <PrimaryButton label="Back to login" onPress={() => navigation.navigate('Login')} />
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
    notice: {
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundAlt,
      borderColor: theme.colors.borderSubtle,
      borderWidth: 1,
      marginBottom: theme.spacing.md,
    },
    noticeText: { color: theme.colors.textPrimary },
  });
