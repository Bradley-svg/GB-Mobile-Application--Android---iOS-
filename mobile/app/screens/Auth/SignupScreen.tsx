import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import GreenbroLogo from '../../../assets/greenbro/greenbro-logo-horizontal.png';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();

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

const styles = StyleSheet.create({
  logoRow: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  logo: { width: 240, height: 64 },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.brandText },
  muted: { color: colors.brandTextMuted },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  notice: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  noticeText: { color: colors.brandText },
});
