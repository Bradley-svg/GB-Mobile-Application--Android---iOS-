import { darkColors, darkGradients, lightColors, lightGradients } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';
import type { ThemeTokens } from './types';

export const lightThemeTokens: ThemeTokens = {
  colors: lightColors,
  gradients: lightGradients,
  spacing,
  radius,
  typography,
};

export const darkThemeTokens: ThemeTokens = {
  colors: darkColors,
  gradients: darkGradients,
  spacing,
  radius,
  typography,
};
