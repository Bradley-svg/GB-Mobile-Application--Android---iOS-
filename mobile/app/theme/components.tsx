import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

type PillTabProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

type IconButtonProps = {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
}) => {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.screen, style]}>
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, style]}>
      <View style={[styles.screenContent, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
};

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component style={[styles.card, style]} onPress={onPress} activeOpacity={0.9}>
      {children}
    </Component>
  );
};

export const PillTab: React.FC<PillTabProps> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.9}
    style={[
      styles.pillTab,
      selected
        ? { backgroundColor: colors.dark, borderColor: colors.dark }
        : { backgroundColor: 'transparent', borderColor: colors.borderSoft },
    ]}
  >
    <Text
      style={[
        typography.label,
        { color: selected ? colors.white : colors.textSecondary, textTransform: 'uppercase' },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export const IconButton: React.FC<IconButtonProps> = ({ icon, onPress, size = 40, style }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.9}
    style={[
      styles.iconButton,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      style,
    ]}
  >
    {icon}
  </TouchableOpacity>
);

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = 'solid',
  disabled,
  style,
}) => {
  const isOutline = variant === 'outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        styles.primaryButton,
        isOutline
          ? { backgroundColor: 'transparent', borderColor: colors.primary, borderWidth: 1 }
          : { backgroundColor: colors.primary },
        disabled ? { opacity: 0.6 } : null,
        style,
      ]}
    >
      <Text
        style={[
          typography.subtitle,
          { color: isOutline ? colors.primary : colors.white, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const surfaceStyles = {
  shadow: softShadow,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...softShadow,
  },
  pillTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconButton: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...softShadow,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 48,
  },
});
