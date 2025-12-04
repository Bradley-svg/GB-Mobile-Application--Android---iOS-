import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

type Props = {
  title: string;
  message?: string;
  onRetry?: () => void;
  testID?: string;
};

export const ErrorCard: React.FC<Props> = ({ title, message, onRetry, testID }) => {
  return (
    <View style={styles.card} testID={testID}>
      <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>{title}</Text>
      {message ? (
        <Text style={[typography.body, styles.muted, { marginBottom: spacing.md }]}>{message}</Text>
      ) : null}
      {onRetry ? <PrimaryButton label="Retry" onPress={onRetry} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    width: '100%',
  },
  title: { color: colors.dark },
  muted: { color: colors.textSecondary },
});
