import React, { useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/useAppTheme';

export type GaugeState = 'ok' | 'warning' | 'alert';
export type GaugeIconVariant = 'check' | 'warning' | 'alert' | 'info';

const DEFAULT_THRESHOLDS = {
  warning: 0.55,
  alert: 0.8,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const deriveGaugeState = (value: number, thresholds = DEFAULT_THRESHOLDS): GaugeState => {
  const v = clamp01(value);
  if (v >= thresholds.alert) return 'alert';
  if (v >= thresholds.warning) return 'warning';
  return 'ok';
};

const iconForState: Record<GaugeState, GaugeIconVariant> = {
  ok: 'check',
  warning: 'warning',
  alert: 'alert',
};

const iconNameMap: Record<GaugeIconVariant, keyof typeof Ionicons.glyphMap> = {
  check: 'checkmark',
  warning: 'warning',
  alert: 'alert',
  info: 'information',
};

const formatAngle = (start: number, end: number, value: number) =>
  start + (end - start) * clamp01(value);

const describeArc = (cx: number, cy: number, radius: number, start: number, end: number) => {
  const startX = cx + radius * Math.cos(start);
  const startY = cy + radius * Math.sin(start);
  const endX = cx + radius * Math.cos(end);
  const endY = cy + radius * Math.sin(end);
  const largeArcFlag = end - start <= Math.PI ? 0 : 1;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
};

type SemiCircularGaugeProps = {
  /** Normalised value between 0 and 1 (0 = far left, 1 = far right). */
  value: number;
  /** Optional discrete state override; if not provided, derive from value thresholds. */
  state?: GaugeState;
  /** Main label under the gauge, e.g. "No action required". */
  label: string;
  /** Optional sublabel, e.g. "Updated 2025-12-08 14:32". */
  sublabel?: string;
  /** Optional icon name or variant (e.g. from our existing Icon component). */
  iconVariant?: GaugeIconVariant;
  /** Optional size for the gauge width. Height is derived from width. */
  size?: number;
  testID?: string;
};

export const SemiCircularGauge: React.FC<SemiCircularGaugeProps> = ({
  value,
  state,
  label,
  sublabel,
  iconVariant,
  size,
  testID,
}) => {
  const { theme } = useAppTheme();
  const { colors, spacing, typography } = theme;
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const gaugeWidth = size ?? Math.min(measuredWidth ?? 240, 320);
  const svgWidth = gaugeWidth || 240;
  const svgHeight = svgWidth * 0.6;
  const centerX = svgWidth / 2;
  const centerY = svgHeight;
  const strokeWidth = Math.max(8, svgWidth * 0.06);
  const radius = svgWidth / 2 - strokeWidth;
  const startAngle = -Math.PI;
  const endAngle = 0;

  const normalizedValue = clamp01(value);
  const resolvedState = state ?? deriveGaugeState(normalizedValue);
  const resolvedIcon = iconVariant ?? iconForState[resolvedState];

  const segments = useMemo(
    () => [
      { start: 0, end: 0.5, color: colors.gaugeArcSafe },
      { start: 0.5, end: 0.8, color: colors.gaugeArcWarning },
      { start: 0.8, end: 1, color: colors.gaugeArcAlert },
    ],
    [colors.gaugeArcAlert, colors.gaugeArcSafe, colors.gaugeArcWarning]
  );

  const highlightSegmentIndex = segments.findIndex(
    (seg) => normalizedValue >= seg.start && normalizedValue <= seg.end
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  const needleAngle = formatAngle(startAngle, endAngle, normalizedValue);
  const needleLength = radius - strokeWidth / 2;
  const needleX = centerX + needleLength * Math.cos(needleAngle);
  const needleY = centerY + needleLength * Math.sin(needleAngle);

  const centerColors: Record<GaugeState, string> = {
    ok: colors.gaugeCenterOk,
    warning: colors.gaugeCenterWarning,
    alert: colors.gaugeCenterAlert,
  };

  const labelColor: Record<GaugeState, string> = {
    ok: colors.gaugeLabelText,
    warning: colors.gaugeLabelText,
    alert: colors.gaugeLabelText,
  };

  return (
    <View onLayout={onLayout} style={{ width: '100%', alignItems: 'center' }} testID={testID}>
      <Svg width={svgWidth} height={svgHeight}>
        {segments.map((segment, index) => {
          const start = formatAngle(startAngle, endAngle, segment.start);
          const end = formatAngle(startAngle, endAngle, segment.end);
          const path = describeArc(centerX, centerY, radius, start, end);
          const isActive = index === highlightSegmentIndex;
          return (
            <Path
              key={`${segment.start}-${segment.end}`}
              d={path}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              opacity={isActive ? 1 : 0.35}
            />
          );
        })}

        <Line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={colors.gaugeNeedle}
          strokeWidth={Math.max(2, strokeWidth * 0.4)}
          strokeLinecap="round"
        />

        <Circle
          cx={centerX}
          cy={centerY}
          r={strokeWidth * 1.1}
          fill={colors.gaugeBackground}
          opacity={0.9}
        />

        <Circle cx={centerX} cy={centerY} r={strokeWidth} fill={centerColors[resolvedState]} />
      </Svg>

      <View
        style={{
          position: 'absolute',
          top: centerY - strokeWidth * 0.8,
          left: centerX - strokeWidth * 0.8,
          width: strokeWidth * 1.6,
          height: strokeWidth * 1.6,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <Ionicons name={iconNameMap[resolvedIcon]} size={strokeWidth * 0.9} color={colors.white} />
      </View>

      <View style={{ marginTop: spacing.sm, alignItems: 'center', width: '100%' }}>
        <Text
          style={[
            typography.subtitle,
            { color: labelColor[resolvedState], textAlign: 'center', marginBottom: spacing.xs },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            style={[
              typography.caption,
              { color: colors.gaugeSublabelText, textAlign: 'center' },
            ]}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
