import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Tone = 'success' | 'warning' | 'error' | 'muted';

type StatusPillProps = {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const toneStyles: Record<Tone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  error: { backgroundColor: colors.errorSoft, color: colors.error },
  muted: { backgroundColor: colors.backgroundAlt, color: colors.textSecondary },
};

export const StatusPill: React.FC<StatusPillProps> = ({ label, tone = 'muted', style, testID }) => {
  const palette = toneStyles[tone] || toneStyles.muted;
  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }, style]} testID={testID}>
      <Text style={[typography.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
};

export const connectivityDisplay = (status?: string | null): { label: string; tone: Tone } => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('online')) return { label: 'Online', tone: 'success' };
  if (normalized.includes('offline') || normalized.includes('down')) {
    return { label: 'Offline', tone: 'error' };
  }
  if (normalized.includes('degrad') || normalized.includes('flap')) {
    return { label: 'Degraded', tone: 'warning' };
  }
  if (!status || normalized.includes('unknown')) {
    return { label: 'Unknown', tone: 'warning' };
  }
  return { label: status, tone: 'muted' };
};

export const healthDisplay = (health?: string | null): { label: string; tone: Tone } => {
  const normalized = (health || '').toLowerCase();
  if (normalized === 'healthy' || normalized.includes('online')) return { label: 'Healthy', tone: 'success' };
  if (normalized === 'critical' || normalized.includes('crit')) return { label: 'Critical', tone: 'error' };
  if (normalized === 'warning' || normalized.includes('warn')) return { label: 'Warning', tone: 'warning' };
  if (normalized === 'offline' || normalized.includes('off')) return { label: 'Offline', tone: 'error' };
  if (!health) return { label: 'Unknown', tone: 'warning' };
  return { label: health, tone: 'muted' };
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});
