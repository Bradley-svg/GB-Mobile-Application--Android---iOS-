import { StyleSheet } from 'react-native';
import type { AppTheme } from './types';

// Wrapper to make StyleSheet usage consistent across themed components.
export const createThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  theme: AppTheme,
  styles: T
): T => StyleSheet.create(styles);
