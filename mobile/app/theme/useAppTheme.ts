import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './types';

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
