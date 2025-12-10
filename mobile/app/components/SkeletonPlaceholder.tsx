import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { createThemedStyles } from '../theme/createThemedStyles';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

export const SkeletonPlaceholder: React.FC<Props> = ({
  width = '100%',
  height = 12,
  style,
  borderRadius,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, opacity: pulse, borderRadius: borderRadius ?? theme.radius.sm },
        style,
      ]}
    />
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    block: {
      backgroundColor: theme.colors.backgroundAlt,
      borderRadius: theme.radius.sm,
    },
  });
