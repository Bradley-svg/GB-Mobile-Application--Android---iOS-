import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

type Props = {
  message: string;
  testID?: string;
};

export const EmptyState: React.FC<Props> = ({ message, testID }) => (
  <View style={styles.container} testID={testID}>
    <Text style={[typography.body, styles.text]}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.brandTextMuted,
    textAlign: 'center',
  },
});
