export type ThemeColors = {
  brandGreen: string;
  brandGreenMuted: string;
  brandGrey: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  white: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  brandSoft: string;
  successSoft: string;
  warningSoft: string;
  errorSoft: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
  gaugeBackground: string;
  gaugeArcSafe: string;
  gaugeArcWarning: string;
  gaugeArcAlert: string;
  gaugeNeedle: string;
  gaugeCenterOk: string;
  gaugeCenterWarning: string;
  gaugeCenterAlert: string;
  gaugeLabelText: string;
  gaugeSublabelText: string;
  chartPrimary: string;
  chartSecondary: string;
  chartAreaPrimary: string;
};

export type ThemeGradients = {
  brandPrimary: { start: string; end: string };
  brandSoft: { start: string; end: string };
};

export const lightColors: ThemeColors = {
  brandGreen: '#39B54A',
  brandGreenMuted: '#2D9C3E',
  brandGrey: '#414042',
  primary: '#39B54A',
  primaryMuted: '#2D9C3E',
  accent: '#2D9C3E',
  background: '#FFFFFF',
  backgroundAlt: '#F5F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F7F9',
  card: '#FFFFFF',
  borderSubtle: '#E1E5EA',
  borderStrong: '#CBD5E1',
  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#555555',
  textInverse: '#FFFFFF',
  white: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  brandSoft: '#E9F7EC',
  successSoft: 'rgba(22, 163, 74, 0.12)',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
  errorSoft: 'rgba(220, 38, 38, 0.1)',
  infoSoft: 'rgba(37, 99, 235, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.08)',
  shadow: 'rgba(0, 0, 0, 0.12)',
  chartPrimary: '#39B54A',
  chartSecondary: '#D97706',
  chartAreaPrimary: 'rgba(22, 163, 74, 0.12)',
  gaugeBackground: '#FFFFFF',
  gaugeArcSafe: '#39B54A',
  gaugeArcWarning: '#D97706',
  gaugeArcAlert: '#DC2626',
  gaugeNeedle: '#414042',
  gaugeCenterOk: '#39B54A',
  gaugeCenterWarning: '#D97706',
  gaugeCenterAlert: '#DC2626',
  gaugeLabelText: '#111111',
  gaugeSublabelText: '#555555',
};

export const darkColors: ThemeColors = {
  brandGreen: '#39B54A',
  brandGreenMuted: '#2D9C3E',
  brandGrey: '#C8CED4',
  primary: '#39B54A',
  primaryMuted: '#2D9C3E',
  accent: '#34D399',
  background: '#0F151C',
  backgroundAlt: '#131C26',
  surface: '#131C26',
  surfaceAlt: '#182330',
  card: '#161F2A',
  borderSubtle: '#243140',
  borderStrong: '#314155',
  textPrimary: '#E6EDF3',
  textSecondary: '#C6D0DC',
  textMuted: '#94A3B8',
  textInverse: '#0F151C',
  white: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
  brandSoft: 'rgba(57, 181, 74, 0.16)',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  warningSoft: 'rgba(245, 158, 11, 0.18)',
  errorSoft: 'rgba(239, 68, 68, 0.18)',
  infoSoft: 'rgba(56, 189, 248, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.5)',
  chartPrimary: '#39B54A',
  chartSecondary: '#F59E0B',
  chartAreaPrimary: 'rgba(34, 197, 94, 0.18)',
  gaugeBackground: '#0F151C',
  gaugeArcSafe: '#39B54A',
  gaugeArcWarning: '#F59E0B',
  gaugeArcAlert: '#EF4444',
  gaugeNeedle: '#E6EDF3',
  gaugeCenterOk: '#39B54A',
  gaugeCenterWarning: '#F59E0B',
  gaugeCenterAlert: '#EF4444',
  gaugeLabelText: '#E6EDF3',
  gaugeSublabelText: '#C6D0DC',
};

export const lightGradients: ThemeGradients = {
  brandPrimary: {
    start: '#39B54A',
    end: '#2D9C3E',
  },
  brandSoft: {
    start: '#E9F7EC',
    end: '#FFFFFF',
  },
};

export const darkGradients: ThemeGradients = {
  brandPrimary: {
    start: '#2F8F3A',
    end: '#1F6E2B',
  },
  brandSoft: {
    start: 'rgba(57, 181, 74, 0.24)',
    end: 'rgba(24, 35, 48, 0.9)',
  },
};

// Legacy exports to avoid churn; these map to the light theme palette.
export const colors = lightColors;
export const gradients = lightGradients;
