import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type PillTabProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

export const PillTab: React.FC<PillTabProps> = ({ label, selected, onPress, testID }) => (
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

const styles = StyleSheet.create({
  pillTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  pillUnselected: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.borderSubtle,
  },
  labelSelected: {
    color: colors.background,
  },
  labelUnselected: {
    color: colors.textSecondary,
  },
});
