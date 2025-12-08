import type { TextStyle } from 'react-native';
import type { ThemeColors, ThemeGradients } from './colors';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export type SpacingScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type RadiusScale = {
  sm: number;
  md: number;
  lg: number;
  pill: number;
};

export type TypographyScale = {
  title1: TextStyle;
  title2: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  caption: TextStyle;
  label: TextStyle;
};

export interface AppTheme {
  colors: ThemeColors;
  gradients: ThemeGradients;
  spacing: SpacingScale;
  radius: RadiusScale;
  typography: TypographyScale;
}

export interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  resolvedScheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  isReady: boolean;
}
