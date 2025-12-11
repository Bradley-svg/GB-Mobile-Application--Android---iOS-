import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryLegend } from 'victory-native';
import type { TimeRange } from '../../api/types';
import { Card, ErrorCard, PillTabGroup } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import { createThemedStyles } from '../../theme/createThemedStyles';
import type { AppTheme } from '../../theme/types';
import type { HistoryStatus } from './types';
import { getChartTheme } from '../../theme/chartTheme';

type CompressorHistoryCardProps = {
  status: HistoryStatus;
  isLoading: boolean;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
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
  status,
  isLoading,
  range,
  onRangeChange,
  onRetry,
  points,
  errorMessage,
  testID,
  vendorCaption,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing, typography } = theme;
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);

  const xTickCount = range === '7d' ? 5 : 6;
  const tickFormatter = useMemo(() => formatTick(range), [range]);
  const isEmpty = points.length === 0 || points.every((p) => p.y === 0);
  const isNoData = status === 'noData' || isEmpty;
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

  return (
    <Card style={styles.card} testID={testID ?? 'compressor-history-card'}>
      <View style={styles.headerRow}>
        <Text style={[typography.subtitle, styles.title]}>Compressor current (A)</Text>
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
        <View style={styles.loadingRow} testID="compressor-history-loading">
          <ActivityIndicator color={colors.brandGreen} />
          <Text style={[typography.caption, styles.placeholder, { marginLeft: spacing.sm }]}>
            Loading history...
          </Text>
        </View>
      ) : showError ? (
        <ErrorCard
          title="Could not load heat pump history."
          message={errorMessage}
          onRetry={onRetry}
          testID="compressor-history-error"
        />
      ) : isNoData ? (
        <Text style={[typography.caption, styles.placeholder]} testID="compressor-history-empty">
          No history for this period.
        </Text>
      ) : (
        <View testID="heatPumpHistoryChart" style={styles.chartWrapper}>
          <VictoryChart scale={{ x: 'time' }}>
            <VictoryAxis dependentAxis style={dependentAxisStyle} />
            <VictoryAxis tickFormat={(t) => tickFormatter(t)} tickCount={xTickCount} style={axisStyle} />
            <VictoryLegend
              x={40}
              y={0}
              orientation="horizontal"
              gutter={20}
              data={[{ name: 'Current', symbol: { fill: chartTheme.linePrimary } }]}
              style={{ labels: { fill: chartTheme.axisColor } }}
            />
            <VictoryArea
              data={points}
              style={{ data: { fill: chartTheme.areaFillPrimary, stroke: 'transparent' } }}
            />
            <VictoryLine data={points} style={{ data: { stroke: chartTheme.linePrimary } }} />
          </VictoryChart>
        </View>
      )}
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
    title: {
      color: theme.colors.textPrimary,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    placeholder: {
      color: theme.colors.textSecondary,
    },
    chartWrapper: {
      marginTop: theme.spacing.sm,
    },
    caption: {
      marginTop: theme.spacing.xs,
      color: theme.colors.textSecondary,
    },
  });
