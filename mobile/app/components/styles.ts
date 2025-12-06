import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export const softShadow = {
  shadowColor: colors.textPrimary,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

export const surfaceStyles = {
  shadow: softShadow,
  base: {
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
};
