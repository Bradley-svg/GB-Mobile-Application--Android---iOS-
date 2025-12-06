export const colors = {
  brandGreen: '#39B54A',
  brandGreenDark: '#329F41',
  brandGreenLight: '#3FCA52',
  brandGreenSoft: '#E4F4E8',
  brandGrey: '#414042',
  brandText: '#111111',
  brandTextMuted: '#555555',
  background: '#FFFFFF',
  backgroundSoft: '#F5F7F9',
  borderSubtle: '#E1E5EA',
  error: '#DC2626',
  errorSoft: '#F9E6E6',
  warning: '#D97706',
  warningSoft: '#F9EFE0',
  success: '#16A34A',
  successSoft: '#E7F4EC',
  white: '#FFFFFF',
} as const;

export const gradients = {
  hero: {
    start: colors.brandGreen,
    end: colors.brandGreenLight,
  },
  button: {
    start: colors.brandGreenDark,
    end: colors.brandGreen,
  },
} as const;
