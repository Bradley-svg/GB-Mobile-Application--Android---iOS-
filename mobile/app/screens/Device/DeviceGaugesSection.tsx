/* eslint react-native/no-unused-styles: "warn" */
import React, { useCallback, useMemo, useState } from 'react';
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

type GaugeGroup = {
  key: string;
  title: string;
  gauges: GaugeMetric[];
};

const latestMetricValue = (telemetry?: DeviceTelemetry | null, key?: string) => {
  if (!telemetry || !key) return null;
  const points = telemetry.metrics[key] ?? [];
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
};

const pickLatestMetricValue = (telemetry: DeviceTelemetry | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = latestMetricValue(telemetry, key);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const formatUpdatedAt = (timestamp?: string | null) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `Updated ${date.toLocaleString()}`;
};

const DeviceGaugesSectionComponent: React.FC<DeviceGaugesSectionProps> = ({
  telemetry,
  isOffline,
  lastUpdatedAt,
  compressorCurrent,
  compressorUpdatedAt,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { typography } = theme;
  const [gridColumns, setGridColumns] = useState(2);

  const tankTemp = pickLatestMetricValue(telemetry, ['tank_temp', 'tank_temp_c', 'supply_temp']);
  const dhwTemp = pickLatestMetricValue(telemetry, ['dhw_temp', 'dhw_temp_c', 'return_temp']);
  const ambientTemp = pickLatestMetricValue(telemetry, ['ambient_temp', 'outdoor_temp', 'ambient']);
  const flowRate = pickLatestMetricValue(telemetry, ['flow_rate']);
  const power = pickLatestMetricValue(telemetry, ['power_kw']);
  const cop = pickLatestMetricValue(telemetry, ['cop']);

  const deltaT =
    tankTemp != null && dhwTemp != null ? Number((tankTemp - dhwTemp).toFixed(1)) : null;

  const gaugeGroups: GaugeGroup[] = useMemo(
    () => [
      {
        key: 'temperatures',
        title: 'Temperatures',
        gauges: [
          {
            key: 'tank_temp',
            label: 'Tank temperature',
            value: tankTemp,
            unit: '\u00B0C',
            min: 5,
            max: 70,
            thresholds: { warn: 55, critical: 60 },
            testID: 'gauge-supply-temp',
          },
          {
            key: 'dhw_temp',
            label: 'DHW temperature',
            value: dhwTemp,
            unit: '\u00B0C',
            min: 5,
            max: 65,
            thresholds: { warn: 48, critical: 58 },
            testID: 'gauge-return-temp',
          },
          {
            key: 'ambient_temp',
            label: 'Ambient temperature',
            value: ambientTemp,
            unit: '\u00B0C',
            min: -10,
            max: 45,
            thresholds: { warn: 32, critical: 38 },
            testID: 'gauge-ambient-temp',
          },
        ],
      },
      {
        key: 'compressor',
        title: 'Compressor',
        gauges: [
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
        ],
      },
      {
        key: 'power',
        title: 'Power & efficiency',
        gauges: [
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
        ],
      },
      {
        key: 'flow',
        title: 'Flow & delta',
        gauges: [
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
            key: 'delta_t',
            label: 'Temperature delta',
            value: deltaT,
            unit: '\u00B0C',
            min: 0,
            max: 25,
            thresholds: { warn: 15, critical: 20 },
            testID: 'gauge-delta',
          },
        ],
      },
    ],
    [ambientTemp, compressorCurrent, cop, dhwTemp, flowRate, power, tankTemp, deltaT]
  );

  const hasTelemetry = !!telemetry;
  const updatedLabel = formatUpdatedAt(lastUpdatedAt || compressorUpdatedAt);
  const gridItemStyle = gridColumns === 3 ? styles.gridItemThird : styles.gridItemHalf;

  const onLayoutGrid = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const width = event.nativeEvent.layout.width;
      if (!width) return;
      setGridColumns(width > 900 ? 3 : 2);
    },
    [setGridColumns]
  );

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
          <View onLayout={onLayoutGrid}>
            {gaugeGroups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={[typography.subtitle, styles.groupTitle]}>{group.title}</Text>
                <View style={styles.grid}>
                  {group.gauges.map((gauge) => (
                    <View key={gauge.key} style={gridItemStyle}>
                      <GaugeCard
                        label={gauge.label}
                        value={gauge.value}
                        unit={gauge.unit}
                        min={gauge.min}
                        max={gauge.max}
                        thresholds={gauge.thresholds}
                        direction={gauge.direction}
                        testID={gauge.testID}
                        emptyMessage="No recent data"
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Text style={[typography.caption, styles.footer]}>
            Gauges map the latest readings into expected operating ranges across temperature,
            electrical, and flow metrics.
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
    gridItemHalf: {
      width: '48%',
    },
    gridItemThird: {
      width: '32%',
    },
    group: {
      marginBottom: theme.spacing.md,
    },
    groupTitle: {
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    emptyStateWrapper: {
      marginTop: theme.spacing.sm,
    },
    footer: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
    },
  });

export const DeviceGaugesSection = React.memo(DeviceGaugesSectionComponent);
