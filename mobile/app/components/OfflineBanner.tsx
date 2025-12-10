import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';
import { typography } from '../theme/typography';

type Props = {
  message: string;
  lastUpdatedLabel?: string | null;
  tone?: 'info' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export const OfflineBanner: React.FC<Props> = ({
  message,
  lastUpdatedLabel,
  tone = 'info',
  actionLabel,
  onAction,
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  const { colors, spacing } = theme;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.row}>
        <Ionicons
          name={tone === 'warning' ? 'alert-circle-outline' : 'cloud-offline-outline'}
          size={16}
          color={tone === 'warning' ? colors.warning : colors.info}
          style={{ marginRight: spacing.xs }}
        />
        <Text style={[typography.caption, styles.text]}>{message}</Text>
      </View>
      {lastUpdatedLabel ? (
        <Text style={[typography.caption, styles.subtle]}>Last updated {lastUpdatedLabel}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} style={styles.actionButton} testID={`${testID}-action`}>
          <Text style={[typography.caption, styles.actionText]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: AppTheme, tone: 'info' | 'warning') =>
  createThemedStyles(theme, {
    container: {
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: tone === 'warning' ? theme.colors.warningBackground : theme.colors.infoBackground,
      borderWidth: 1,
      borderColor: tone === 'warning' ? theme.colors.warningBorder : theme.colors.infoBorder,
      marginBottom: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      color: theme.colors.textPrimary,
      flex: 1,
    },
    subtle: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    actionButton: {
      marginTop: theme.spacing.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    actionText: {
      color: theme.colors.textPrimary,
    },
  });
