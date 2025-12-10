import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';
import { typography } from '../theme/typography';

type Props = {
  message: string;
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
  testID?: string;
};

export const GlobalErrorBanner: React.FC<Props> = ({
  message,
  title = 'Something went wrong',
  retryLabel = 'Retry',
  onRetry,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors } = theme;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.row}>
        <View style={styles.iconBadge}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.subtitle, styles.title]}>{title}</Text>
          <Text style={[typography.caption, styles.message]}>{message}</Text>
        </View>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton} testID={`${testID}-retry`}>
            <Text style={[typography.caption, styles.retryText]}>{retryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.errorBackground,
      borderColor: theme.colors.errorBorder,
      borderWidth: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.errorBorder,
    },
    title: {
      color: theme.colors.error,
    },
    message: {
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.xs,
    },
    retryButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginLeft: theme.spacing.sm,
    },
    retryText: {
      color: theme.colors.textPrimary,
    },
  });
