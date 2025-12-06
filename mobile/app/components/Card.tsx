import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { softShadow } from './styles';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  accented?: boolean;
};

export const Card: React.FC<CardProps> = ({ children, style, onPress, testID, accented }) => {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...softShadow,
  },
  accented: {
    borderLeftWidth: 4,
    borderColor: colors.brandGreen,
    paddingLeft: spacing.md + spacing.xs,
  },
});
