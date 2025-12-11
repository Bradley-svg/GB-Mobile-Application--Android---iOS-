import { darkThemeTokens, lightThemeTokens } from '@greenbro/ui-tokens';
import type { AppTheme } from './types';

export const lightTheme: AppTheme = lightThemeTokens;
export const darkTheme: AppTheme = darkThemeTokens;

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
