import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine } from 'victory-native';
import type { HeatPumpMetric, TimeRange } from '../../api/types';
import { Card, EmptyState, ErrorCard, PillTabGroup, SkeletonPlaceholder } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import { createThemedStyles } from '../../theme/createThemedStyles';
import type { AppTheme } from '../../theme/types';
import type { HistoryStatus } from './types';
import { getChartTheme } from '../../theme/chartTheme';

export type HistoryMetricOption = {
  key: HeatPumpMetric;
  label: string;
  unit?: string;
  decimals?: number;
  color: string;
};

type CompressorHistoryCardProps = {
  metric: HeatPumpMetric;
  metricOptions: HistoryMetricOption[];
  status: HistoryStatus;
  isLoading: boolean;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  onMetricChange: (metric: HeatPumpMetric) => void;
  onRetry: () => void;
  points: { x: Date; y: number }[];
  errorMessage: string;
  testID?: string;
  vendorCaption?: string;
};

const formatTick = (range: TimeRange) => (value: Date | number) => {
  const date = typeof value === 'number' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';

  if (range === '7d') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const CompressorHistoryCard: React.FC<CompressorHistoryCardProps> = ({
  metric,
  metricOptions,
  status,
  isLoading,
  range,
  onRangeChange,
  onMetricChange,
  onRetry,
  points,
  errorMessage,
  testID,
  vendorCaption,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { spacing, typography } = theme;
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);
  const selectedMetric =
    metricOptions.find((option) => option.key === metric) ?? metricOptions[0] ?? null;
  const chartColor = selectedMetric?.color ?? chartTheme.linePrimary;
  const areaFill =
    selectedMetric?.key === 'compressor_current' ? chartTheme.areaFillPrimary : chartTheme.areaFillSecondary;

  const xTickCount = range === '7d' ? 5 : 6;
  const tickFormatter = useMemo(() => formatTick(range), [range]);
  const allZero = points.length > 0 && points.every((p) => (p.y ?? 0) === 0);
  const hasPoints = points.length > 0 && points.some((p) => p.y !== null);
  const isNoData = !isLoading && (!hasPoints || allZero || status === 'noData');
  const showError = !isLoading && status !== 'ok' && status !== 'noData';

  const axisStyle = useMemo(
    () => ({
      axis: { stroke: chartTheme.axisColor },
      tickLabels: { fill: chartTheme.axisColor, fontSize: 10 },
    }),
    [chartTheme.axisColor]
  );
  const dependentAxisStyle = useMemo(
    () => ({
      ...axisStyle,
      grid: { stroke: chartTheme.gridColor, strokeDasharray: '4,4' },
    }),
    [axisStyle, chartTheme.gridColor]
  );

  const latestValue = useMemo(() => {
    if (!hasPoints || allZero) return null;
    const last = points[points.length - 1];
    return last?.y ?? null;
  }, [allZero, hasPoints, points]);

  const formattedLatest =
    latestValue != null && selectedMetric
      ? `${latestValue.toFixed(selectedMetric.decimals ?? 1)}${
          selectedMetric.unit ? ` ${selectedMetric.unit}` : ''
        }`
      : '--';

  return (
    <Card style={styles.card} testID={testID ?? 'compressor-history-card'}>
      <View style={styles.headerRow}>
        <Text style={[typography.subtitle, styles.title]}>Heat pump history</Text>
        <Text style={[typography.caption, styles.placeholder]}>
          Switch metrics to compare live vendor data.
        </Text>
      </View>

      <View style={styles.metricTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <PillTabGroup
            value={selectedMetric?.key ?? metric}
            options={metricOptions.map((option) => ({
              value: option.key,
              label: option.label,
            }))}
            onChange={(val) => onMetricChange(val as HeatPumpMetric)}
          />
        </ScrollView>
      </View>

      <View style={[styles.rangeRow]} testID="compressor-history-range">
        <PillTabGroup
          value={range}
          options={[
            { value: '1h', label: '1h' },
            { value: '6h', label: '6h' },
            { value: '24h', label: '24h' },
            { value: '7d', label: '7d' },
          ]}
          onChange={onRangeChange}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingBlock} testID="compressor-history-loading">
          <SkeletonPlaceholder width="50%" height={14} style={{ marginBottom: spacing.sm }} />
          <SkeletonPlaceholder height={180} borderRadius={spacing.md} />
        </View>
      ) : showError ? (
        <ErrorCard
          title="Could not load heat pump history."
          message={errorMessage}
          onRetry={onRetry}
          testID="compressor-history-error"
        />
      ) : isNoData ? (
        <EmptyState
          message="No history for this metric in the selected range."
          variant="compact"
          testID="compressor-history-empty"
        />
      ) : (
        <View testID="heatPumpHistoryChart" style={styles.chartWrapper}>
          <VictoryChart scale={{ x: 'time' }}>
            <VictoryAxis dependentAxis style={dependentAxisStyle} />
            <VictoryAxis tickFormat={(t) => tickFormatter(t)} tickCount={xTickCount} style={axisStyle} />
            <VictoryArea
              data={points}
              style={{ data: { fill: areaFill, stroke: 'transparent' } }}
            />
            <VictoryLine data={points} style={{ data: { stroke: chartColor } }} />
          </VictoryChart>
        </View>
      )}

      <View style={styles.legendRow} testID="history-legend">
        <View style={[styles.legendSwatch, { backgroundColor: chartColor }]} />
        <Text style={[typography.caption, styles.legendText]}>
          {`${selectedMetric?.label ?? 'Metric'}${selectedMetric?.unit ? ` (${selectedMetric.unit})` : ''}: ${formattedLatest}`}
        </Text>
      </View>

      {vendorCaption ? (
        <Text style={[typography.caption, styles.caption]} testID="compressor-history-caption">
          {vendorCaption}
        </Text>
      ) : null}
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    card: {
      marginBottom: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    metricTabs: {
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    placeholder: {
      color: theme.colors.textSecondary,
    },
    loadingBlock: {
      marginTop: theme.spacing.sm,
    },
    chartWrapper: {
      marginTop: theme.spacing.sm,
    },
    caption: {
      marginTop: theme.spacing.xs,
      color: theme.colors.textSecondary,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    legendSwatch: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: theme.spacing.xs,
    },
    legendText: {
      color: theme.colors.textPrimary,
    },
  });
