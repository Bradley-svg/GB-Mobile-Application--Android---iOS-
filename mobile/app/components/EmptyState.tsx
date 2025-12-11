import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { typography } from '../theme/typography';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';

type Props = {
  message: string;
  testID?: string;
  variant?: 'default' | 'compact';
};

export const EmptyState: React.FC<Props> = ({ message, testID, variant = 'default' }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[styles.container, variant === 'compact' ? styles.containerCompact : null]}
      testID={testID}
    >
      <Text style={[typography.body, styles.text, variant === 'compact' ? styles.textCompact : null]}>
        {message}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.infoBackground,
      borderWidth: 1,
      borderColor: theme.colors.infoBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    containerCompact: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    text: {
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    textCompact: {
      color: theme.colors.textSecondary,
    },
  });
