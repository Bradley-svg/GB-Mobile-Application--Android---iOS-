import type { AppTheme } from './types';

export const getChartTheme = (theme: AppTheme) => ({
  axisColor: theme.colors.textMuted,
  gridColor: theme.colors.borderSubtle,
  linePrimary: theme.colors.chartPrimary,
  lineSecondary: theme.colors.chartSecondary,
  lineTertiary: theme.colors.chartTertiary,
  lineQuaternary: theme.colors.chartQuaternary,
  areaFillPrimary: theme.colors.chartAreaPrimary,
  areaFillSecondary: theme.colors.chartAreaSecondary,
});
