import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Screen, Card, ErrorCard } from '../../components';
import { useHealthPlus } from '../../api/health/hooks';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import type { HealthPlusPayload } from '../../api/types';

const formatSubsystemStatus = (
  signal?: Pick<HealthPlusPayload['control'], 'configured' | 'healthy' | 'lastError'> | null
) => {
  if (!signal) return 'Unknown';
  if (signal.configured === false) return 'Unconfigured';
  if (signal.healthy === false) return signal.lastError || 'Issues detected';
  return 'Healthy';
};

const formatAlertsEngine = (alertsEngine?: HealthPlusPayload['alertsEngine']) => {
  if (!alertsEngine) return 'Unknown';
  if (!alertsEngine.lastRunAt) return 'No runs yet';
  const duration = alertsEngine.lastDurationMs ? ` • ${alertsEngine.lastDurationMs}ms` : '';
  return `${new Date(alertsEngine.lastRunAt).toLocaleString()} (${alertsEngine.rulesLoaded ?? 0} rules)${duration}`;
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

const formatRuleEvaluations = (alertsEngine?: HealthPlusPayload['alertsEngine']) => {
  if (!alertsEngine) return 'Unknown';
  if (alertsEngine.evaluated == null) return 'Not available';
  const triggered = alertsEngine.triggered ?? 0;
  return `${triggered} triggered / ${alertsEngine.evaluated} evaluated`;
};

const Row: React.FC<{ label: string; value: string; testID?: string }> = ({ label, value, testID }) => (
  <View style={styles.row} testID={testID}>
    <Text style={[typography.caption, styles.muted]}>{label}</Text>
    <Text style={[typography.body, styles.title, styles.rowValue]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export const DiagnosticsScreen: React.FC = () => {
  const healthQuery = useHealthPlus();
  const userId = useAuthStore((s) => s.user?.id);

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
      <Text style={[typography.title1, styles.title, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
        About & Diagnostics
      </Text>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>App</Text>
        <Row label="App version" value={version} testID="diagnostics-version" />
        <Row label="API base URL" value={apiUrl} testID="diagnostics-api-url" />
        <Row label="Environment" value={healthQuery.data?.env ?? 'Unknown'} />
      </Card>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>Health</Text>
        <View style={styles.chipRow}>
          <View
            style={[
              styles.chip,
              healthQuery.data?.ok ? styles.chipOk : styles.chipIssue,
            ]}
          >
            <Text
              style={[
                typography.label,
                healthQuery.data?.ok ? styles.chipOkText : styles.chipIssueText,
              ]}
              testID="diagnostics-health-status"
            >
              {healthStatusLabel}
            </Text>
          </View>
        </View>
        <Row label="Last /health-plus" value={lastSample} testID="diagnostics-health-sample" />
        <Row label="Control" value={formatSubsystemStatus(healthQuery.data?.control)} />
        <Row
          label="Heat pump history"
          value={formatSubsystemStatus(healthQuery.data?.heatPumpHistory)}
        />
        <Row
          label="Push"
          value={
            healthQuery.data?.push?.enabled
              ? healthQuery.data?.push.lastError
                ? 'Enabled (errors)'
                : 'Enabled'
              : 'Disabled'
          }
        />
        <Row
          label="Alerts engine last run"
          value={formatAlertsEngine(healthQuery.data?.alertsEngine)}
          testID="diagnostics-alerts-engine"
        />
        <Row label="Active alerts" value={formatAlertsCounts(healthQuery.data?.alertsEngine)} />
        <Row label="Rule evaluations" value={formatRuleEvaluations(healthQuery.data?.alertsEngine)} />
        <Row
          label="Rules loaded"
          value={`${healthQuery.data?.alertsEngine?.rulesLoaded ?? 0} rules`}
        />
      </Card>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.title, styles.blockTitle]}>Support</Text>
        <Row label="User ID" value={userId ?? 'Unknown'} testID="diagnostics-user" />
        <Row label="Device ID" value={deviceId} testID="diagnostics-device" />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  block: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  blockTitle: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowValue: {
    marginLeft: spacing.sm,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipOk: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandGreen,
  },
  chipOkText: { color: colors.brandGreen },
  chipIssue: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  chipIssueText: { color: colors.warning },
});
