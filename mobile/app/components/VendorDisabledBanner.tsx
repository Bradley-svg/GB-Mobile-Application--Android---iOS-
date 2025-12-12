import React, { useMemo } from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import type { VendorFlags } from '../api/types';
import { createThemedStyles } from '../theme/createThemedStyles';
import type { AppTheme } from '../theme/types';
import { useAppTheme } from '../theme/useAppTheme';
import { typography } from '../theme/typography';

export type VendorFeature = 'mqtt' | 'control' | 'push' | 'history';

const DISPLAY_LABELS: Record<VendorFeature, string> = {
  mqtt: 'MQTT',
  control: 'Control',
  push: 'Push',
  history: 'History',
};
const ORDER: VendorFeature[] = ['mqtt', 'control', 'push', 'history'];

export function deriveVendorDisabledFeatures(
  vendorFlags?: VendorFlags | null,
  extraDisabled?: Partial<Record<VendorFeature, boolean>>
): VendorFeature[] {
  const disabled = new Set<VendorFeature>();
  const disabledList = vendorFlags?.disabled ?? [];
  disabledList.forEach((flag) => {
    const normalized = (flag || '').toLowerCase();
    if (normalized.includes('mqtt')) disabled.add('mqtt');
    if (normalized.includes('control')) disabled.add('control');
    if (normalized.includes('push')) disabled.add('push');
    if (normalized.includes('history')) disabled.add('history');
  });

  if (vendorFlags?.mqttDisabled) disabled.add('mqtt');
  if (vendorFlags?.controlDisabled) disabled.add('control');
  if (vendorFlags?.heatPumpHistoryDisabled) disabled.add('history');
  if (vendorFlags?.pushDisabled || vendorFlags?.pushNotificationsDisabled) {
    disabled.add('push');
  }

  Object.entries(extraDisabled ?? {}).forEach(([feature, value]) => {
    if (value) disabled.add(feature as VendorFeature);
  });

  return ORDER.filter((feature) => disabled.has(feature));
}

export function formatVendorDisabledSummary(
  vendorFlags?: VendorFlags | null,
  extraDisabled?: Partial<Record<VendorFeature, boolean>>
): { summary: string; features: VendorFeature[] } | null {
  const features = deriveVendorDisabledFeatures(vendorFlags, extraDisabled);
  if (features.length === 0) return null;

  const labels = features.map((f) => DISPLAY_LABELS[f]);
  const last = labels[labels.length - 1];
  const prefix = labels.slice(0, -1).join(' + ');
  const summary =
    labels.length === 1 ? `${last} disabled` : `${prefix} + ${last} disabled`;

  return { summary, features };
}

type VendorDisabledBannerProps = {
  vendorFlags?: VendorFlags | null;
  isDemoOrg?: boolean;
  forceShow?: boolean;
  extraDisabled?: Partial<Record<VendorFeature, boolean>>;
  style?: StyleProp<ViewStyle>;
};

export const VendorDisabledBanner: React.FC<VendorDisabledBannerProps> = ({
  vendorFlags,
  isDemoOrg = false,
  forceShow = false,
  extraDisabled,
  style,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const summary = formatVendorDisabledSummary(vendorFlags, extraDisabled);

  if (!summary) return null;
  if (!isDemoOrg && !forceShow) return null;
  const prefix = isDemoOrg ? 'Demo environment: ' : 'Environment: ';

  return (
    <View style={[styles.container, style]} testID="vendor-disabled-banner">
      <Text style={[typography.caption, styles.text]}>
        {`${prefix}${summary.summary}.`}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    container: {
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.warningBackground,
      borderColor: theme.colors.warningBorder,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: Math.max(6, Math.floor(theme.spacing.xs)),
      marginBottom: theme.spacing.sm,
    },
    text: {
      color: theme.colors.textPrimary,
    },
  });
