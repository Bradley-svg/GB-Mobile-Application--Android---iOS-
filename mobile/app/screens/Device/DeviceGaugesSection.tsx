/* eslint react-native/no-unused-styles: "warn" */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { DeviceTelemetry } from '../../api/types';
import { EmptyState, GaugeCard, OfflineBanner } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { createThemedStyles } from '../../theme/createThemedStyles';

type DeviceGaugesSectionProps = {
  telemetry?: DeviceTelemetry | null;
  isOffline: boolean;
  lastUpdatedAt?: string | null;
  compressorCurrent?: number | null;
  compressorUpdatedAt?: string | null;
};

type GaugeMetric = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  min: number;
  max: number;
  thresholds?: { warn: number; critical: number };
  direction?: 'ascending' | 'descending';
  testID?: string;
};

const latestMetricValue = (telemetry?: DeviceTelemetry | null, key?: string) => {
  if (!telemetry || !key) return null;
  const points = telemetry.metrics[key] ?? [];
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
};

const formatUpdatedAt = (timestamp?: string | null) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `Updated ${date.toLocaleString()}`;
};

export const DeviceGaugesSection: React.FC<DeviceGaugesSectionProps> = ({
  telemetry,
  isOffline,
  lastUpdatedAt,
  compressorCurrent,
  compressorUpdatedAt,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { typography } = theme;

  const supplyTemp = latestMetricValue(telemetry, 'supply_temp');
  const returnTemp = latestMetricValue(telemetry, 'return_temp');
  const flowRate = latestMetricValue(telemetry, 'flow_rate');
  const power = latestMetricValue(telemetry, 'power_kw');
  const cop = latestMetricValue(telemetry, 'cop');

  const deltaT =
    supplyTemp != null && returnTemp != null ? Number((supplyTemp - returnTemp).toFixed(1)) : null;

  const gauges: GaugeMetric[] = [
    {
      key: 'compressor',
      label: 'Compressor current',
      value: compressorCurrent ?? null,
      unit: 'A',
      min: 0,
      max: 60,
      thresholds: { warn: 30, critical: 45 },
      testID: 'semi-circular-gauge-compressor',
    },
    {
      key: 'supply_temp',
      label: 'Leaving water temp',
      value: supplyTemp,
      unit: '\u00B0C',
      min: 5,
      max: 70,
      thresholds: { warn: 55, critical: 60 },
      testID: 'gauge-supply-temp',
    },
    {
      key: 'return_temp',
      label: 'Return water temp',
      value: returnTemp,
      unit: '\u00B0C',
      min: 5,
      max: 65,
      thresholds: { warn: 48, critical: 58 },
      testID: 'gauge-return-temp',
    },
    {
      key: 'flow_rate',
      label: 'Flow rate',
      value: flowRate,
      unit: 'L/s',
      min: 0,
      max: 30,
      thresholds: { warn: 18, critical: 24 },
      testID: 'gauge-flow-rate',
    },
    {
      key: 'power_kw',
      label: 'Power draw',
      value: power,
      unit: 'kW',
      min: 0,
      max: 30,
      thresholds: { warn: 18, critical: 24 },
      testID: 'gauge-power',
    },
    {
      key: 'delta_t',
      label: 'Temperature delta',
      value: deltaT,
      unit: '\u00B0C',
      min: 0,
      max: 25,
      thresholds: { warn: 15, critical: 20 },
      testID: 'gauge-delta',
    },
    {
      key: 'cop',
      label: 'COP',
      value: cop,
      unit: '',
      min: 0,
      max: 8,
      thresholds: { warn: 2.5, critical: 1.8 },
      direction: 'descending',
      testID: 'gauge-cop',
    },
  ];

  const hasTelemetry = !!telemetry;
  const updatedLabel = formatUpdatedAt(lastUpdatedAt || compressorUpdatedAt);

  return (
    <View style={styles.section} testID="device-gauges-card">
      <View style={styles.headerRow}>
        <View>
          <Text style={[typography.subtitle, styles.title]}>Status gauges</Text>
          <Text style={[typography.caption, styles.subtitle]}>
            Live device telemetry at a glance
          </Text>
        </View>
        {updatedLabel ? (
          <Text style={[typography.caption, styles.updatedAt]} numberOfLines={2}>
            {updatedLabel}
          </Text>
        ) : null}
      </View>

      {isOffline ? (
        <OfflineBanner
          message="Offline - showing cached telemetry where available."
          lastUpdatedLabel={updatedLabel}
          testID="device-gauges-offline"
        />
      ) : null}

      {!hasTelemetry ? (
        <View style={styles.emptyStateWrapper}>
          <EmptyState
            message={
              isOffline
                ? 'Telemetry unavailable while offline. Reconnect to refresh this device.'
                : 'No telemetry available yet for this device.'
            }
            testID="device-gauges-empty"
          />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {gauges.map((gauge) => (
              <View key={gauge.key} style={styles.gridItem}>
                <GaugeCard
                  label={gauge.label}
                  value={gauge.value}
                  unit={gauge.unit}
                  min={gauge.min}
                  max={gauge.max}
                  thresholds={gauge.thresholds}
                  direction={gauge.direction}
                  testID={gauge.testID}
                />
              </View>
            ))}
          </View>
          <Text style={[typography.caption, styles.footer]}>
            Gauges map the latest readings into expected operating ranges.
          </Text>
        </>
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    section: {
      marginBottom: theme.spacing.lg,
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
    subtitle: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    updatedAt: {
      color: theme.colors.textSecondary,
      textAlign: 'right',
      marginLeft: theme.spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    gridItem: {
      width: '48%',
    },
    emptyStateWrapper: {
      marginTop: theme.spacing.sm,
    },
    footer: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
    },
  });
