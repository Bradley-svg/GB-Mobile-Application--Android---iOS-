import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'solid',
  disabled,
  style,
  testID,
}) => {
  const isOutline = variant === 'outline';
  const content = isOutline ? (
    <View
      style={[
        styles.primaryButton,
        styles.outline,
        disabled ? styles.outlineDisabled : null,
      ]}
    >
      <Text
        style={[
          typography.subtitle,
          styles.outlineText,
          disabled ? styles.disabledText : null,
        ]}
      >
        {label}
      </Text>
    </View>
  ) : (
    <LinearGradient
      colors={
        disabled
          ? [colors.backgroundSoft, colors.backgroundSoft]
          : [gradients.button.start, gradients.button.end]
      }
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.primaryButton, disabled ? styles.disabledButton : null]}
    >
      <Text
        style={[
          typography.subtitle,
          styles.solidText,
          disabled ? styles.disabledText : null,
        ]}
      >
        {label}
      </Text>
    </LinearGradient>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      testID={testID}
      style={[styles.touchable, style, disabled ? styles.disabledOpacity : null]}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    alignSelf: 'stretch',
    borderRadius: 16,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 48,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.brandGreen,
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: colors.brandGreen,
    textAlign: 'center',
  },
  solidText: {
    color: colors.white,
    textAlign: 'center',
  },
  disabledText: {
    color: colors.brandTextMuted,
  },
  disabledOpacity: {
    opacity: 0.9,
  },
  disabledButton: {
    backgroundColor: colors.backgroundSoft,
  },
  outlineDisabled: {
    borderColor: colors.brandTextMuted,
  },
});
