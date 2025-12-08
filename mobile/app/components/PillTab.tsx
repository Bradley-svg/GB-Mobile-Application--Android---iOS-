import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { typography } from '../theme/typography';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';

type PillTabProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

export const PillTab: React.FC<PillTabProps> = ({ label, selected, onPress, testID }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.pillTab, selected ? styles.pillSelected : styles.pillUnselected]}
      testID={testID}
    >
      <Text
        style={[
          typography.label,
          selected ? styles.labelSelected : styles.labelUnselected,
          { textTransform: 'uppercase' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    pillTab: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: 20,
      borderWidth: 1,
    },
    pillSelected: {
      backgroundColor: theme.colors.brandGreen,
      borderColor: theme.colors.brandGreen,
    },
    pillUnselected: {
      backgroundColor: theme.colors.backgroundAlt,
      borderColor: theme.colors.borderSubtle,
    },
    labelSelected: {
      color: theme.colors.textInverse,
    },
    labelUnselected: {
      color: theme.colors.textSecondary,
    },
  });
