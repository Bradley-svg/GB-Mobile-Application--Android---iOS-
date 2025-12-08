import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useAppTheme } from './useAppTheme';

export const useSyncNavigationBar = () => {
  const { theme, resolvedScheme, isReady } = useAppTheme();

  useEffect(() => {
    if (!isReady || Platform.OS !== 'android') return;

    NavigationBar.setBackgroundColorAsync(theme.colors.background);
    NavigationBar.setButtonStyleAsync(resolvedScheme === 'dark' ? 'light' : 'dark');
  }, [isReady, resolvedScheme, theme.colors.background]);
};
