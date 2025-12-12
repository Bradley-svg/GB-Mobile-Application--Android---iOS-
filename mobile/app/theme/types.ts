import type {
  ColorTokens as ThemeColors,
  GradientTokens as ThemeGradients,
  RadiusScale,
  ResolvedThemeMode as ResolvedTheme,
  SpacingScale,
  ThemeMode,
  ThemeTokens as AppTheme,
  TypographyScale,
} from '@greenbro/ui-tokens';

export interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  resolvedScheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  isReady: boolean;
}

export type {
  ThemeColors,
  ThemeGradients,
  RadiusScale,
  SpacingScale,
  TypographyScale,
  AppTheme,
  ThemeMode,
  ResolvedTheme,
};
