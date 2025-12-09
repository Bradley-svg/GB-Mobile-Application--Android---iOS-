import { StyleSheet } from 'react-native';
import type { AppTheme } from './types';

// Preferred helper for theme-aware styles; keeps linting consistent with react-native/no-unused-styles.
export const createThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  theme: AppTheme,
  styles: T
): T => StyleSheet.create(styles);
