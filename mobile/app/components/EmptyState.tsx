import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { typography } from '../theme/typography';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';

type Props = {
  message: string;
  testID?: string;
};

export const EmptyState: React.FC<Props> = ({ message, testID }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[typography.body, styles.text]}>{message}</Text>
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
    text: {
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
  });
