import type { AppTheme } from '../theme/types';

export const createSoftShadow = (theme: AppTheme) => ({
  shadowColor: theme.colors.shadow,
  shadowOpacity: theme.colors.shadow === 'rgba(0, 0, 0, 0.5)' ? 0.4 : 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
});

export const createSurfaceStyles = (theme: AppTheme) => ({
  shadow: createSoftShadow(theme),
  base: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
});
