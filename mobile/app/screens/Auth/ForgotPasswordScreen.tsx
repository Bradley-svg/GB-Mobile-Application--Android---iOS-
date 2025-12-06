import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
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

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();

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
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  notice: { color: colors.textPrimary, marginBottom: spacing.md },
  linksRow: {
    marginTop: spacing.md,
  },
});
