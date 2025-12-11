export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export type ColorTokens = {
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
  errorBackground: string;
  errorBorder: string;
  warningBackground: string;
  warningBorder: string;
  infoBackground: string;
  infoBorder: string;
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
  chartTertiary: string;
  chartQuaternary: string;
  chartAreaSecondary: string;
  statusOnline: string;
  statusOffline: string;
  statusDegraded: string;
  statusUnknown: string;
};

export type GradientTokens = {
  brandPrimary: { start: string; end: string };
  brandSoft: { start: string; end: string };
};

export type SpacingScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type RadiusScale = {
  sm: number;
  md: number;
  lg: number;
  pill: number;
};

export type TypographyToken = {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
  lineHeight?: number;
};

export type TypographyScale = {
  title1: TypographyToken;
  title2: TypographyToken;
  subtitle: TypographyToken;
  body: TypographyToken;
  caption: TypographyToken;
  label: TypographyToken;
};

export type ThemeTokens = {
  colors: ColorTokens;
  gradients: GradientTokens;
  spacing: SpacingScale;
  radius: RadiusScale;
  typography: TypographyScale;
};
