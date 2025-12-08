import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import type { AppTheme } from '../theme/types';
import { createSoftShadow } from './styles';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  accented?: boolean;
};

export const Card: React.FC<CardProps> = ({ children, style, onPress, testID, accented }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, accented ? styles.accented : null, style]}
        onPress={onPress}
        activeOpacity={0.9}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, accented ? styles.accented : null, style]} testID={testID}>
      {children}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      ...createSoftShadow(theme),
    },
    accented: {
      borderLeftWidth: 4,
      borderColor: theme.colors.brandGreen,
      paddingLeft: theme.spacing.md + theme.spacing.xs,
    },
  });
