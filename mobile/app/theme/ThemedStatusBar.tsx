import React from 'react';
import { StatusBar } from 'react-native';
import { useAppTheme } from './useAppTheme';

export const ThemedStatusBar: React.FC = () => {
  const { theme, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';

  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor={theme.colors.background}
      animated
    />
  );
};
