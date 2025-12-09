import React, { useMemo } from 'react';
/* eslint react-native/no-unused-styles: "warn" */
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { typography } from '../theme/typography';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';

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
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isOutline = variant === 'outline';

  const content = isOutline ? (
    <View style={[styles.primaryButton, styles.outline, disabled ? styles.outlineDisabled : null]}>
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
          ? [theme.colors.backgroundAlt, theme.colors.backgroundAlt]
          : [theme.gradients.brandPrimary.start, theme.gradients.brandPrimary.end]
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

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    touchable: {
      alignSelf: 'stretch',
      borderRadius: theme.radius.md,
    },
    primaryButton: {
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      minHeight: 48,
    },
    outline: {
      borderWidth: 1,
      borderColor: theme.colors.brandGreen,
      backgroundColor: 'transparent',
    },
    outlineText: {
      color: theme.colors.brandGreen,
      textAlign: 'center',
    },
    solidText: {
      color: theme.colors.textInverse,
      textAlign: 'center',
    },
    disabledText: {
      color: theme.colors.textSecondary,
    },
    disabledOpacity: {
      opacity: 0.9,
    },
    disabledButton: {
      backgroundColor: theme.colors.backgroundAlt,
    },
    outlineDisabled: {
      borderColor: theme.colors.textSecondary,
    },
  });
