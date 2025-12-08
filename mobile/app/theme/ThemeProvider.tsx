import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { darkTheme, lightTheme } from './themes';
import type { ThemeContextValue, ThemeMode, ResolvedTheme } from './types';

export const THEME_PREFERENCE_KEY = 'GREENBRO_THEME_MODE';

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  resolvedScheme: 'light',
  setMode: () => undefined,
  isReady: false,
});

type ProviderProps = {
  children: React.ReactNode;
};

export const AppThemeProvider: React.FC<ProviderProps> = ({ children }) => {
  const systemScheme = useColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      } catch (err) {
        console.warn('Failed to load theme preference', err);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    loadPreference();
    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedScheme: ResolvedTheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const theme = resolvedScheme === 'dark' ? darkTheme : lightTheme;

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextMode);
    } catch (err) {
      console.warn('Failed to persist theme preference', err);
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      resolvedScheme,
      isReady,
    }),
    [theme, mode, setMode, resolvedScheme, isReady]
  );

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
