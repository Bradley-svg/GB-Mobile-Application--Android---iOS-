import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { typography } from '../theme/typography';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';

type Props = {
  title: string;
  message?: string;
  onRetry?: () => void;
  testID?: string;
};

export const ErrorCard: React.FC<Props> = ({ title, message, onRetry, testID }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <Text style={[typography.title2, styles.title, { marginBottom: theme.spacing.xs }]}>{title}</Text>
      {message ? (
        <Text style={[typography.body, styles.muted, { marginBottom: theme.spacing.md }]}>{message}</Text>
      ) : null}
      {onRetry ? <PrimaryButton label="Retry" onPress={onRetry} /> : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderColor: theme.colors.borderSubtle,
      borderWidth: 1,
      width: '100%',
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
  });
