import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, SemiCircularGauge, deriveGaugeState } from '../../components';
import type { GaugeState } from '../../components/gauges/SemiCircularGauge';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';

type GaugeDefinition = {
  key: string;
  value: number;
  hasData: boolean;
  label: string;
  sublabel?: string;
  state?: GaugeState;
  testID?: string;
};

type DeviceGaugesSectionProps = {
  compressorCurrent: number | null;
  compressorUpdatedAt?: string | null;
  deltaT: number | null;
  deltaUpdatedAt?: string | null;
  isOffline: boolean;
};

const NORMALIZE = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return 0;
  const clamped = Math.min(Math.max(value, min), max);
  return (clamped - min) / Math.max(max - min, 1);
};

const formatTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return `Last updated: ${date.toLocaleString()}`;
};

const stateLabel = (metric: 'compressor' | 'delta', state: GaugeState) => {
  if (metric === 'compressor') {
    if (state === 'alert') return 'High compressor load';
    if (state === 'warning') return 'Check compressor load';
    return 'Compressor current OK';
  }

  if (state === 'alert') return 'Delta outside range';
  if (state === 'warning') return 'Monitor flow delta';
  return 'Flow delta healthy';
};

export const DeviceGaugesSection: React.FC<DeviceGaugesSectionProps> = ({
  compressorCurrent,
  compressorUpdatedAt,
  deltaT,
  deltaUpdatedAt,
  isOffline,
}) => {
  const { theme } = useAppTheme();
  const { spacing, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const compressorNormalized = useMemo(() => {
    if (compressorCurrent == null) return 0;
    return NORMALIZE(compressorCurrent, 0, 50);
  }, [compressorCurrent]);

  const deltaNormalized = useMemo(() => {
    if (deltaT == null) return 0;
    return NORMALIZE(deltaT, 0, 20);
  }, [deltaT]);

  const compressorState = compressorCurrent == null ? 'warning' : deriveGaugeState(compressorNormalized);
  const deltaState = deltaT == null ? 'warning' : deriveGaugeState(deltaNormalized);

  const gauges: GaugeDefinition[] = [
    {
      key: 'compressor',
      value: compressorNormalized,
      hasData: compressorCurrent != null,
      label: compressorCurrent == null ? 'Awaiting compressor data' : stateLabel('compressor', compressorState),
      sublabel: compressorCurrent == null ? (isOffline ? 'Offline - cannot load current data' : 'No compressor readings yet') : formatTimestamp(compressorUpdatedAt),
      state: compressorState,
      testID: 'semi-circular-gauge-compressor',
    },
    {
      key: 'delta',
      value: deltaNormalized,
      hasData: deltaT != null,
      label: deltaT == null ? 'Awaiting temperature delta' : stateLabel('delta', deltaState),
      sublabel:
        deltaT == null
          ? isOffline
            ? 'Offline - telemetry paused'
            : 'No ΔT telemetry yet'
          : formatTimestamp(deltaUpdatedAt),
      state: deltaState,
      testID: 'semi-circular-gauge-delta',
    },
  ];

  return (
    <Card style={styles.card} testID="device-gauges-card">
      <Text style={[typography.subtitle, styles.title]}>Parameters</Text>
      <View style={{ marginTop: spacing.md }}>
        {gauges.map((gauge, idx) => (
          <View key={gauge.key} style={idx === 0 ? undefined : { marginTop: spacing.lg }}>
            <SemiCircularGauge
              value={gauge.value}
              state={gauge.state}
              label={gauge.label}
              sublabel={gauge.sublabel}
              testID={gauge.testID}
            />
          </View>
        ))}
      </View>
      <Text style={[typography.caption, styles.footnote]}>
        Values reflect recent telemetry. Gauges show relative position within expected ranges.
      </Text>
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      marginBottom: theme.spacing.md,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    footnote: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
      textAlign: 'center',
    },
  });
