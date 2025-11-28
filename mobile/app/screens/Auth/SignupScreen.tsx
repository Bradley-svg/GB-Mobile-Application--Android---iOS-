import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { useSignup } from '../../api/hooks';
import { useAuthStore } from '../../store/authStore';
import { Screen, Card, PrimaryButton } from '../../theme/components';
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

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigation>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signupMutation = useSignup();

  const onSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setError(null);
      const { accessToken, refreshToken, user } = await signupMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      await setAuth({ accessToken, refreshToken, user });
      Alert.alert('Signup successful', 'Welcome to Greenbro!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data ?? err.message);
        setError(err.response?.data?.message ?? 'Signup failed. Please try again.');
      } else {
        console.error(err);
        setError('Signup failed. Please try again.');
      }
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[typography.title1, styles.title]}>Create an account</Text>
        <Text style={[typography.body, styles.muted]}>Set up your Greenbro workspace</Text>
      </View>

      <Card style={styles.formCard}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.sm }]}>Sign up</Text>

        <Text style={[typography.caption, styles.muted]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Jane Doe"
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[typography.caption, styles.muted]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="jane@example.com"
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[typography.caption, styles.muted]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="********"
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />

        {error ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.sm }]} testID="signup-error">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={signupMutation.isPending ? 'Signing up...' : 'Sign up'}
          onPress={onSignup}
          disabled={signupMutation.isPending}
        />

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[typography.body, { color: colors.primary }]}>Already have an account? Log in</Text>
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
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  linksRow: {
    marginTop: spacing.md,
  },
});
