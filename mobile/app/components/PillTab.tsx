import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type PillTabProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export const PillTab: React.FC<PillTabProps> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.9}
    style={[
      styles.pillTab,
      selected
        ? { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen }
        : { backgroundColor: 'transparent', borderColor: colors.borderSubtle },
    ]}
  >
    <Text
      style={[
        typography.label,
        { color: selected ? colors.white : colors.brandTextMuted, textTransform: 'uppercase' },
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
});
