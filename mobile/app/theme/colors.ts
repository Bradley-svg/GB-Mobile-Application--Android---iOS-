import {
  darkColors,
  darkGradients,
  lightColors,
  lightGradients,
  type ColorTokens as ThemeColors,
  type GradientTokens as ThemeGradients,
} from '@greenbro/ui-tokens';

// Legacy exports to avoid churn; these map to the light theme palette.
export const colors = lightColors;
export const gradients = lightGradients;

export { lightColors, darkColors, lightGradients, darkGradients };
export type { ThemeColors, ThemeGradients };
