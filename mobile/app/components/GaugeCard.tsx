import React, { useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useAppTheme } from '../theme/useAppTheme';
import type { AppTheme } from '../theme/types';
import { createThemedStyles } from '../theme/createThemedStyles';

type GaugeStatus = 'ok' | 'warn' | 'critical' | 'nodata';

export type GaugeCardProps = {
  label: string;
  value: number | null | undefined;
  unit?: string;
  min: number;
  max: number;
  thresholds?: { warn: number; critical: number };
  /**
   * Some metrics are healthier at higher values (default) while others degrade as they drop.
   * Use 'descending' when lower values should be flagged as warnings/critical.
   */
  direction?: 'ascending' | 'descending';
  testID?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const describeArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
};

export const GaugeCard: React.FC<GaugeCardProps> = ({
  label,
  value,
  unit,
  min,
  max,
  thresholds,
  direction = 'ascending',
  testID,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, typography } = theme;
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const range = Math.max(max - min, 1);
  const warnThreshold = thresholds?.warn ?? min + range * 0.6;
  const criticalThreshold = thresholds?.critical ?? min + range * 0.85;

  const normalizedWarn = clamp((warnThreshold - min) / range, 0, 1);
  const normalizedCritical = clamp((criticalThreshold - min) / range, 0, 1);
  const lowBoundary = Math.min(normalizedWarn, normalizedCritical);
  const highBoundary = Math.max(normalizedWarn, normalizedCritical);

  const startAngle = -Math.PI;
  const endAngle = 0;

  const gaugeWidth = measuredWidth ? Math.min(measuredWidth, 320) : 240;
  const gaugeHeight = gaugeWidth * 0.6;
  const centerX = gaugeWidth / 2;
  const centerY = gaugeHeight;
  const strokeWidth = Math.max(8, gaugeWidth * 0.065);
  const radius = gaugeWidth / 2 - strokeWidth;

  const onLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  const hasValue = value !== null && value !== undefined && !Number.isNaN(value);
  const clampedValue = hasValue ? clamp(value as number, min, max) : min;
  const normalizedValue = clamp((clampedValue - min) / range, 0, 1);

  const status: GaugeStatus = useMemo(() => {
    if (!hasValue) return 'nodata';
    if (direction === 'descending') {
      if (clampedValue <= criticalThreshold) return 'critical';
      if (clampedValue <= warnThreshold) return 'warn';
      return 'ok';
    }
    if (clampedValue >= criticalThreshold) return 'critical';
    if (clampedValue >= warnThreshold) return 'warn';
    return 'ok';
  }, [clampedValue, criticalThreshold, direction, hasValue, warnThreshold]);

  const segments = useMemo(
    () =>
      direction === 'ascending'
        ? [
            { start: 0, end: lowBoundary, color: colors.success },
            { start: lowBoundary, end: highBoundary, color: colors.warning },
            { start: highBoundary, end: 1, color: colors.error },
          ]
        : [
            { start: 0, end: lowBoundary, color: colors.error },
            { start: lowBoundary, end: highBoundary, color: colors.warning },
            { start: highBoundary, end: 1, color: colors.success },
          ],
    [colors.error, colors.success, colors.warning, direction, highBoundary, lowBoundary]
  );

  const highlightSegmentIndex = hasValue
    ? segments.findIndex((seg) => normalizedValue >= seg.start && normalizedValue <= seg.end)
    : -1;

  const statusLabel: Record<GaugeStatus, string> = {
    ok: 'Normal',
    warn: 'Attention',
    critical: 'Critical',
    nodata: 'No data',
  };

  const statusIcon: Record<GaugeStatus, keyof typeof Ionicons.glyphMap> = {
    ok: 'checkmark',
    warn: 'alert',
    critical: 'warning',
    nodata: 'help',
  };

  const centerColor: Record<GaugeStatus, string> = {
    ok: colors.success,
    warn: colors.warning,
    critical: colors.error,
    nodata: colors.borderSubtle,
  };

  const needleAngle = startAngle + (endAngle - startAngle) * normalizedValue;
  const needleLength = radius - strokeWidth / 2;
  const needleX = centerX + needleLength * Math.cos(needleAngle);
  const needleY = centerY + needleLength * Math.sin(needleAngle);

  const formattedValue =
    hasValue && Number.isFinite(clampedValue)
      ? `${clampedValue.toFixed(1)}${unit ? ` ${unit}` : ''}`
      : '--';

  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[typography.caption, styles.subtitle]} numberOfLines={1}>
          {statusLabel[status]}
        </Text>
      </View>

      <View style={styles.gaugeContainer} onLayout={onLayout}>
        <Svg width={gaugeWidth} height={gaugeHeight}>
          {segments.map((segment, index) => {
            const start = startAngle + (endAngle - startAngle) * segment.start;
            const end = startAngle + (endAngle - startAngle) * segment.end;
            const path = describeArc(centerX, centerY, radius, start, end);
            const isActive = index === highlightSegmentIndex;

            return (
              <Path
                key={`${segment.start}-${segment.end}`}
                d={path}
                stroke={hasValue ? segment.color : colors.borderSubtle}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                opacity={isActive || !hasValue ? 0.9 : 0.35}
              />
            );
          })}

          {hasValue ? (
            <Line
              x1={centerX}
              y1={centerY}
              x2={needleX}
              y2={needleY}
              stroke={colors.textPrimary}
              strokeWidth={Math.max(2, strokeWidth * 0.35)}
              strokeLinecap="round"
            />
          ) : null}

          <Circle cx={centerX} cy={centerY} r={strokeWidth * 1.15} fill={colors.card} />
          <Circle
            cx={centerX}
            cy={centerY}
            r={strokeWidth * 0.95}
            fill={centerColor[status]}
            opacity={status === 'nodata' ? 0.6 : 1}
          />
        </Svg>

        <View
          pointerEvents="none"
          style={[
            styles.centerOverlay,
            {
              top: centerY - strokeWidth * 0.95,
              left: centerX - strokeWidth * 0.95,
              width: strokeWidth * 1.9,
              height: strokeWidth * 1.9,
            },
          ]}
        >
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: status === 'nodata' ? colors.backgroundAlt : colors.card,
                borderColor: colors.card,
              },
            ]}
          >
            <Ionicons
              name={statusIcon[status]}
              size={strokeWidth * 0.7}
              color={status === 'nodata' ? colors.textMuted : colors.textPrimary}
            />
          </View>
          <Text style={[typography.label, styles.statusLabel]}>{statusLabel[status]}</Text>
          <Text style={[typography.title2, styles.valueText]}>{formattedValue}</Text>
        </View>
      </View>
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    card: {
      flex: 1,
      marginBottom: theme.spacing.md,
    },
    header: {
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
    },
    gaugeContainer: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginBottom: theme.spacing.xs,
    },
    statusLabel: {
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    valueText: {
      color: theme.colors.textPrimary,
    },
  });
