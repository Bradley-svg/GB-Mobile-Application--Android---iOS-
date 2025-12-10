import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';
import type { AppTheme } from '../theme/types';
import { typography } from '../theme/typography';

type Props = {
  title: string;
  message?: string;
  onPress?: () => void;
  onDismiss?: () => void;
  testID?: string;
};

export const InAppNotificationBanner: React.FC<Props> = ({
  title,
  message,
  onPress,
  onDismiss,
  testID = 'in-app-notification',
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.container}
      testID={testID}
      accessibilityLabel={testID}
    >
      <View style={styles.textContainer}>
        <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
          {title}
        </Text>
        {message ? (
          <Text style={[typography.caption, styles.message]} numberOfLines={2}>
            {message}
          </Text>
        ) : null}
      </View>
      {onDismiss ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          accessibilityLabel="dismiss-notification"
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      flexDirection: 'row',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      paddingRight: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    message: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    dismissButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
  });
