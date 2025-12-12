import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View, TouchableOpacity, Share } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Card,
  ErrorCard,
  GlobalErrorBanner,
  PrimaryButton,
  StatusPill,
  DemoModePill,
  VendorDisabledBanner,
} from '../../components';
import { useHealthPlus } from '../../api/health/hooks';
import { useDemoStatus } from '../../api/hooks';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';
import type { HealthPlusPayload } from '../../api/types';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { formatVendorDisabledSummary } from '../../components/VendorDisabledBanner';

type SubsystemStatus = { label: string; tone: 'success' | 'warning' | 'error' | 'muted' };

const subsystemStatus = ({
  healthy,
  disabled,
  configured,
  fallbackLabel,
}: {
  healthy?: boolean;
  disabled?: boolean;
  configured?: boolean;
  fallbackLabel?: string;
}): SubsystemStatus => {
  if (disabled) return { label: 'Disabled', tone: 'warning' };
  if (configured === false) return { label: 'Unconfigured', tone: 'warning' };
  if (healthy === false) return { label: 'Issue', tone: 'error' };
  if (healthy === true) return { label: 'Healthy', tone: 'success' };
  return { label: fallbackLabel ?? 'Unknown', tone: 'warning' };
};

const formatAlertsEngine = (alertsEngine?: HealthPlusPayload['alertsEngine']) => {
  if (!alertsEngine) return 'Unknown';
  if (!alertsEngine.lastRunAt) return 'No runs yet';
  const duration = alertsEngine.lastDurationMs ? ` - ${alertsEngine.lastDurationMs}ms` : '';
  return `${new Date(alertsEngine.lastRunAt).toLocaleString()} (${alertsEngine.rulesLoaded ?? 0} rules${duration})`;
};

const formatAlertsCounts = (alertsEngine?: HealthPlusPayload['alertsEngine']) => {
  if (!alertsEngine) return 'Unknown';
  const warning = alertsEngine.activeWarning ?? 0;
  const critical = alertsEngine.activeCritical ?? 0;
  const info = alertsEngine.activeInfo ?? 0;
  const totalLabel =
    alertsEngine.activeAlertsTotal != null ? `${alertsEngine.activeAlertsTotal} total` : 'Unknown total';
  return `${totalLabel} (warn ${warning} / crit ${critical} / info ${info})`;
};

const formatLatency = (ms?: number | null) => {
  if (ms == null) return 'N/A';
  const rounded = Math.round(ms);
  return `${rounded} ms`;
};

const formatTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : 'Unknown');

export const DiagnosticsScreen: React.FC = () => {
  const healthQuery = useHealthPlus();
  const { data: demoStatus } = useDemoStatus();
  const userId = useAuthStore((s) => s.user?.id);
  const { theme } = useAppTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [pushTestMessage, setPushTestMessage] = useState<string | null>(null);
  const [pushTestError, setPushTestError] = useState<string | null>(null);
  const isDemoOrg = demoStatus?.isDemoOrg ?? false;

  const version = Constants.expoConfig?.version ?? 'Unknown';
  const apiUrl =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    'http://10.0.2.2:4000';
  const deviceId =
    Device.osBuildId || Device.modelId || Device.modelName || Device.deviceName || 'Unknown';
  const lastSample = useMemo(
    () =>
      healthQuery.dataUpdatedAt && healthQuery.data
        ? new Date(healthQuery.dataUpdatedAt).toLocaleString()
        : 'Not sampled yet',
    [healthQuery.data, healthQuery.dataUpdatedAt]
  );
  const healthStatusLabel = healthQuery.data?.ok ? 'Healthy' : 'Issues detected';
  const vendorFlags = demoStatus?.vendorFlags ?? healthQuery.data?.vendorFlags;
  const vendorDisabled = formatVendorDisabledSummary(vendorFlags, {
    mqtt: healthQuery.data?.mqtt?.disabled,
    control: healthQuery.data?.control?.disabled,
    history: healthQuery.data?.heatPumpHistory?.disabled,
    push: healthQuery.data?.push?.disabled,
  });
  const vendorDisabledLabel =
    vendorDisabled?.summary || (vendorFlags?.disabled ?? []).join(', ') || 'None';
  const pushDisabled = Boolean(
    vendorDisabled?.features.includes('push') ||
      vendorFlags?.pushDisabled ||
      vendorFlags?.pushNotificationsDisabled ||
      healthQuery.data?.push?.disabled
  );
  const pushDisabledLabel = pushDisabled
    ? isDemoOrg
      ? 'Demo environment: Push disabled.'
      : 'Push disabled for this environment.'
    : null;

  const handleCopy = async () => {
    if (!healthQuery.data) return;
    const payload = JSON.stringify(healthQuery.data, null, 2);
    try {
      await Clipboard.setStringAsync(payload);
      setCopyNotice('Diagnostics copied to clipboard');
    } catch (err) {
      console.error('Clipboard failed, falling back to share', err);
      await Share.share({ message: payload });
      setCopyNotice('Diagnostics ready to share');
    }
  };

  const handleSendTestPush = async () => {
    setPushTestError(null);
    setPushTestMessage(null);
    setPushTestLoading(true);
    try {
      await api.post('/me/push/test');
      setPushTestMessage('Test notification sent. Check your device.');
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? ((err.response?.data as { code?: string } | undefined)?.code ?? null)
        : null;
      if (code === 'NO_PUSH_TOKENS_REGISTERED') {
        setPushTestError(
          'No device registered for push; open the app on your phone and ensure notifications are allowed.'
        );
      } else if (code === 'PUSH_DISABLED') {
        setPushTestError(
          isDemoOrg ? 'Demo environment: Push disabled.' : 'Push disabled in this environment.'
        );
      } else if (code === 'PUSH_NOT_CONFIGURED') {
        setPushTestError('Push is not configured for this environment.');
      } else {
        setPushTestError('Failed to send test push notification. Please try again.');
      }
    } finally {
      setPushTestLoading(false);
    }
  };

  const subsystems = useMemo(
    () => [
      {
        key: 'db',
        label: 'Database',
        status: subsystemStatus({ healthy: healthQuery.data?.db === 'ok' }),
        rows: [
          { label: 'Latency', value: formatLatency(healthQuery.data?.dbLatencyMs) },
          { label: 'Status', value: healthQuery.data?.db === 'ok' ? 'OK' : 'Error' },
        ],
      },
      {
        key: 'storage',
        label: 'Storage',
        status: subsystemStatus({
          healthy: healthQuery.data?.storage?.writable,
          fallbackLabel: healthQuery.data?.storage?.writable ? 'Writable' : 'Unavailable',
        }),
        rows: [
          { label: 'Root', value: healthQuery.data?.storage?.root ?? 'Unknown' },
          { label: 'Latency', value: formatLatency(healthQuery.data?.storage?.latencyMs) },
        ],
      },
      {
        key: 'antivirus',
        label: 'Antivirus',
        status: subsystemStatus({
          healthy:
            healthQuery.data?.antivirus?.enabled &&
            (healthQuery.data?.antivirus?.lastResult === 'clean' ||
              !healthQuery.data?.antivirus?.lastResult),
          configured: healthQuery.data?.antivirus?.configured,
        }),
        rows: [
          { label: 'Mode', value: healthQuery.data?.antivirus?.target ?? 'Unknown' },
          { label: 'Latency', value: formatLatency(healthQuery.data?.antivirus?.latencyMs) },
          { label: 'Last run', value: formatTime(healthQuery.data?.antivirus?.lastRunAt) },
        ],
      },
      {
        key: 'control',
        label: 'Control',
        status: subsystemStatus({
          healthy: healthQuery.data?.control?.healthy,
          disabled: vendorFlags?.controlDisabled ?? healthQuery.data?.control?.disabled,
          configured: healthQuery.data?.control?.configured,
        }),
        rows: [
          { label: 'Last command', value: formatTime(healthQuery.data?.control?.lastCommandAt) },
          { label: 'Last error', value: healthQuery.data?.control?.lastError ?? 'None' },
        ],
      },
      {
        key: 'mqtt',
        label: 'MQTT ingest',
        status: subsystemStatus({
          healthy: healthQuery.data?.mqtt?.healthy,
          disabled: vendorFlags?.mqttDisabled ?? healthQuery.data?.mqtt?.disabled,
          configured: healthQuery.data?.mqtt?.configured,
        }),
        rows: [
          { label: 'Last ingest', value: formatTime(healthQuery.data?.mqtt?.lastIngestAt) },
          { label: 'Last error', value: healthQuery.data?.mqtt?.lastError ?? 'None' },
        ],
      },
      {
        key: 'heat',
        label: 'Heat pump history',
        status: subsystemStatus({
          healthy: healthQuery.data?.heatPumpHistory?.healthy,
          disabled: vendorFlags?.heatPumpHistoryDisabled ?? healthQuery.data?.heatPumpHistory?.disabled,
          configured: healthQuery.data?.heatPumpHistory?.configured,
        }),
        rows: [
          { label: 'Last success', value: formatTime(healthQuery.data?.heatPumpHistory?.lastSuccessAt) },
          { label: 'Last check', value: formatTime(healthQuery.data?.heatPumpHistory?.lastCheckAt) },
          { label: 'Last error', value: healthQuery.data?.heatPumpHistory?.lastError ?? 'None' },
        ],
      },
      {
        key: 'push',
        label: 'Push',
        status: subsystemStatus({
          healthy: !healthQuery.data?.push?.lastError,
          disabled:
            vendorFlags?.pushDisabled ??
            vendorFlags?.pushNotificationsDisabled ??
            healthQuery.data?.push?.disabled,
          configured: healthQuery.data?.push?.enabled,
        }),
        rows: [
          { label: 'Last sample', value: formatTime(healthQuery.data?.push?.lastSampleAt) },
          { label: 'Last error', value: healthQuery.data?.push?.lastError ?? 'None' },
        ],
      },
      {
        key: 'alerts-worker',
        label: 'Alerts worker',
        status: subsystemStatus({ healthy: healthQuery.data?.alertsWorker?.healthy }),
        rows: [
          {
            label: 'Last heartbeat',
            value: formatTime(healthQuery.data?.alertsWorker?.lastHeartbeatAt),
          },
        ],
      },
    ],
    [healthQuery.data, vendorFlags]
  );

  if (healthQuery.isLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DiagnosticsScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>
          Loading diagnostics...
        </Text>
      </Screen>
    );
  }

  if (healthQuery.isError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DiagnosticsScreen">
        <ErrorCard
          title="Couldn't load diagnostics"
          message="Check your connection and try again."
          onRetry={() => healthQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="DiagnosticsScreen">
      <View style={styles.header}>
        <Text style={[typography.title1, styles.title]}>About & Diagnostics</Text>
        <TouchableOpacity
          onPress={handleCopy}
          style={styles.copyButton}
          testID="diagnostics-copy-report"
          accessibilityLabel="copy-diagnostics"
        >
          <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
          <Text style={[typography.caption, styles.copyLabel]}>
            {copyNotice ? 'Copied' : 'Copy report'}
          </Text>
        </TouchableOpacity>
      </View>

      {isDemoOrg ? <DemoModePill style={{ marginBottom: spacing.xs }} /> : null}
      <VendorDisabledBanner
        vendorFlags={vendorFlags}
        isDemoOrg={isDemoOrg}
        forceShow={!isDemoOrg && !!vendorDisabled}
        extraDisabled={{
          mqtt: healthQuery.data?.mqtt?.disabled,
          control: healthQuery.data?.control?.disabled,
          history: healthQuery.data?.heatPumpHistory?.disabled,
          push: healthQuery.data?.push?.disabled,
        }}
        style={{ marginBottom: spacing.sm }}
      />

      {copyNotice ? (
        <View style={styles.copyNotice}>
          <Text style={[typography.caption, { color: colors.success }]}>{copyNotice}</Text>
        </View>
      ) : null}

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>App</Text>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>App version</Text>
          <Text style={[typography.body, styles.title]} testID="diagnostics-version">
            {version}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>API base URL</Text>
          <Text style={[typography.body, styles.title]} numberOfLines={1} testID="diagnostics-api-url">
            {apiUrl}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Environment</Text>
          <Text style={[typography.body, styles.title]}>{healthQuery.data?.env ?? 'Unknown'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Vendor flags</Text>
          <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
            {vendorDisabledLabel}
          </Text>
        </View>
      </Card>

      <Card style={styles.block}>
        <View style={styles.row}>
          <Text style={[typography.subtitle, styles.title]}>Health</Text>
          <StatusPill
            label={healthStatusLabel}
            tone={healthQuery.data?.ok ? 'success' : 'warning'}
            testID="diagnostics-health-status"
          />
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Last /health-plus</Text>
          <Text style={[typography.body, styles.title]} testID="diagnostics-health-sample">
            {lastSample}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Alerts engine last run</Text>
          <Text
            style={[typography.caption, styles.muted, styles.rowValue]}
            testID="diagnostics-alerts-engine"
          >
            {formatAlertsEngine(healthQuery.data?.alertsEngine)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Active alerts</Text>
          <Text style={[typography.caption, styles.muted]}>{formatAlertsCounts(healthQuery.data?.alertsEngine)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Rule evaluations</Text>
          <Text style={[typography.caption, styles.muted]}>
            {healthQuery.data?.alertsEngine?.evaluated != null
              ? `${healthQuery.data.alertsEngine.triggered ?? 0} triggered / ${healthQuery.data.alertsEngine.evaluated}`
              : 'Not available'}
          </Text>
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>Subsystems</Text>
        {subsystems.map((subsystem) => (
          <View key={subsystem.key} style={styles.subsystemRow} testID={`diagnostics-${subsystem.key}`}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, styles.title]}>{subsystem.label}</Text>
              {subsystem.rows.map((row) => (
                <Text key={`${subsystem.key}-${row.label}`} style={[typography.caption, styles.muted]}>
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>
            <StatusPill label={subsystem.status.label} tone={subsystem.status.tone} />
          </View>
        ))}
      </Card>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>Push notifications</Text>
        <Text style={[typography.caption, styles.muted, styles.blockDescription]}>
          Verify that your device can receive critical alerts.
        </Text>
        {pushTestError ? (
          <GlobalErrorBanner
            message={pushTestError}
            title="Push test failed"
            testID="diagnostics-push-error"
            retryLabel="Retry"
            onRetry={handleSendTestPush}
          />
        ) : null}
        {pushDisabledLabel ? (
          <View style={styles.demoNotice} testID="diagnostics-push-demo-disabled">
            <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.caption, styles.warningText]}>{pushDisabledLabel}</Text>
          </View>
        ) : null}
        {pushTestMessage ? (
          <View style={styles.successNotice} testID="diagnostics-push-success">
            <Text style={[typography.caption, styles.successText]}>{pushTestMessage}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={
            pushDisabled ? 'Push disabled' : pushTestLoading ? 'Sending...' : 'Send test notification'
          }
          onPress={handleSendTestPush}
          disabled={pushTestLoading || pushDisabled}
          testID="diagnostics-push-button"
          style={styles.pushButton}
        />
      </Card>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>Support</Text>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>User ID</Text>
          <Text style={[typography.body, styles.title]} testID="diagnostics-user">
            {userId ?? 'Unknown'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[typography.caption, styles.muted]}>Device ID</Text>
          <Text style={[typography.body, styles.title]} testID="diagnostics-device">
            {deviceId}
          </Text>
        </View>
      </Card>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  createThemedStyles(theme, {
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
    block: {
      marginBottom: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    blockTitle: {
      marginBottom: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    rowValue: {
      marginLeft: theme.spacing.sm,
      textAlign: 'right',
      flex: 1,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    copyLabel: { color: theme.colors.textPrimary, marginLeft: theme.spacing.xs },
    copyNotice: {
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.successSoft,
      borderWidth: 1,
      borderColor: theme.colors.success,
      marginBottom: theme.spacing.md,
    },
    blockDescription: {
      marginBottom: theme.spacing.md,
    },
    subsystemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    successNotice: {
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.successSoft,
      borderWidth: 1,
      borderColor: theme.colors.success,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    demoNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.warningSoft,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    successText: {
      color: theme.colors.success,
    },
    warningText: {
      color: theme.colors.warning,
    },
    pushButton: {
      marginTop: theme.spacing.sm,
    },
  });
