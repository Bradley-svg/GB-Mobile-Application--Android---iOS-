import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, PrimaryButton } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import logo from '../../../assets/icon.png';

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
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
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
            <Text style={[typography.body, { color: colors.primary }]}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logo: { width: 40, height: 40 },
  title: { color: colors.dark },
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
