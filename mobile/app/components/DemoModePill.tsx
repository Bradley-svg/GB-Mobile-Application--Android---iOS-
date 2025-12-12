import React, { useMemo } from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { createThemedStyles } from '../theme/createThemedStyles';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { typography } from '../theme/typography';

type DemoModePillProps = {
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const DemoModePill: React.FC<DemoModePillProps> = ({
  label = 'Demo mode',
  style,
  testID = 'demo-mode-pill',
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[typography.caption, styles.text]}>{label}</Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: Math.max(4, Math.floor(theme.spacing.xs)),
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.infoBackground,
      borderWidth: 1,
      borderColor: theme.colors.infoBorder,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      color: theme.colors.textPrimary,
    },
  });
