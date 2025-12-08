import { darkColors, darkGradients, lightColors, lightGradients } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';
import type { AppTheme } from './types';

export const lightTheme: AppTheme = {
  colors: lightColors,
  gradients: lightGradients,
  spacing,
  radius,
  typography,
};

export const darkTheme: AppTheme = {
  colors: darkColors,
  gradients: darkGradients,
  spacing,
  radius,
  typography,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
