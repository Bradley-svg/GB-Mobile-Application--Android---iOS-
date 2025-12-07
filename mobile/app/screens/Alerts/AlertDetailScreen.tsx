import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAcknowledgeAlert, useAlerts, useAlertRulesForDevice, useMuteAlert } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, PrimaryButton, IconButton } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type AlertDetailRouteParams = RouteProp<AppStackParamList, 'AlertDetail'>;
type AlertDetailNavigation = NativeStackNavigationProp<AppStackParamList, 'AlertDetail'>;

export const AlertDetailScreen: React.FC = () => {
  const route = useRoute<AlertDetailRouteParams>();
  const alertId = route.params.alertId;
  const navigation = useNavigation<AlertDetailNavigation>();

  const { data: alerts, isLoading, isError, refetch: refetchAlerts } = useAlerts();
  const alertItem = useMemo(
    () => alerts?.find((a) => a.id === alertId) ?? null,
    [alerts, alertId]
  );
  const acknowledge = useAcknowledgeAlert();
  const mute = useMuteAlert();
  const { isOffline } = useNetworkBanner();
  const [actionError, setActionError] = useState<string | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(60);
  const deviceIdForRules = alertItem?.device_id ?? '';
  const rulesQuery = useAlertRulesForDevice(deviceIdForRules);
  const matchingRule = alertItem
    ? rulesQuery.data?.find((rule) => rule.id === alertItem.rule_id)
    : undefined;
  const defaultSnoozeMinutes = useMemo(
    () =>
      matchingRule?.snooze_default_sec
        ? Math.max(1, Math.round(matchingRule.snooze_default_sec / 60))
        : null,
    [matchingRule]
  );
  const isResolved = alertItem?.status === 'cleared';

  useEffect(() => {
    if (defaultSnoozeMinutes) {
      setSnoozeMinutes(defaultSnoozeMinutes);
    }
  }, [defaultSnoozeMinutes, isResolved]);

  if (isLoading || !alerts) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading alert...</Text>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>Failed to load alert</Text>
        <Text style={[typography.body, styles.muted]}>Please try again.</Text>
      </Screen>
    );
  }

  if (!alertItem) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <Text style={[typography.body, styles.title]}>Alert not found</Text>
      </Screen>
    );
  }

  const onAcknowledge = async () => {
    setActionError(null);
    if (isOffline) {
      setActionError('Offline - acknowledgment requires a connection.');
      return;
    }
    try {
      await acknowledge.mutateAsync(alertItem.id);
      await refetchAlerts();
      Alert.alert('Acknowledged', 'Alert marked as acknowledged');
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
      setActionError('Failed to acknowledge alert. Please try again.');
    }
  };

  const onMute = async () => {
    setActionError(null);
    if (isOffline) {
      setActionError('Offline - muting requires a connection.');
      return;
    }
    try {
      await mute.mutateAsync({ alertId: alertItem.id, minutes: snoozeMinutes });
      await refetchAlerts();
      Alert.alert('Muted', `Alert muted for ${formatSnoozeLabel(snoozeMinutes)}`);
    } catch (err) {
      console.error('Failed to mute alert', err);
      setActionError('Failed to mute alert. Please try again.');
    }
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="AlertDetailScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="alert-back-button"
        />
      </View>

      <Card style={styles.headerCard}>
        {(() => {
          const severity = severityStyles(alertItem.severity);
          return (
            <View style={[styles.severityPill, { backgroundColor: severity.backgroundColor }]}>
              <Text style={[typography.label, { color: severity.textColor }]}>
                {alertItem.severity.toUpperCase()}
              </Text>
            </View>
          );
        })()}
        <Text style={[typography.title1, styles.title, { marginBottom: spacing.xs }]}>{alertItem.message}</Text>
        <Text style={[typography.caption, styles.muted, { marginBottom: spacing.sm }]} testID="alert-detail-meta">
          {alertItem.site_id ? `Site ${alertItem.site_id}` : 'No site'} |{' '}
          {alertItem.device_id ? `Device ${alertItem.device_id}` : 'No device'}
        </Text>
        <Text style={[typography.caption, styles.muted]}>
          {alertItem.type.toUpperCase()} - {alertItem.status.toUpperCase()}
        </Text>
      </Card>

      <Card style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>First seen</Text>
          <Text style={[typography.body, styles.title]}>{new Date(alertItem.first_seen_at).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Last seen</Text>
          <Text style={[typography.body, styles.title]}>{new Date(alertItem.last_seen_at).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Site</Text>
          <Text style={[typography.body, styles.title]}>{alertItem.site_id || '--'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Device</Text>
          <Text style={[typography.body, styles.title]}>{alertItem.device_id || '--'}</Text>
        </View>
      </Card>

      <Card style={styles.detailCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.xs }]}>Rule</Text>
        {rulesQuery.isLoading ? (
          <View style={styles.detailRow}>
            <ActivityIndicator color={colors.brandGreen} />
            <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
              Loading rule...
            </Text>
          </View>
        ) : matchingRule ? (
          <>
            <Text style={[typography.body, styles.title]}>{matchingRule.name || 'Alert rule'}</Text>
            <Text style={[typography.caption, styles.muted]}>
              Metric: {matchingRule.metric} ({matchingRule.rule_type})
            </Text>
            {matchingRule.threshold != null ? (
              <Text style={[typography.caption, styles.muted]}>
                Threshold: {matchingRule.threshold}
              </Text>
            ) : null}
            {matchingRule.offline_grace_sec ? (
              <Text style={[typography.caption, styles.muted]}>
                Offline grace: {Math.round(matchingRule.offline_grace_sec / 60)}m
              </Text>
            ) : null}
            <Text style={[typography.caption, styles.muted]}>
              Severity: {matchingRule.severity}
            </Text>
          </>
        ) : (
          <Text style={[typography.caption, styles.muted]}>
            No matching rule found for this alert.
          </Text>
        )}
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          label={acknowledge.isPending ? 'Acknowledging...' : 'Acknowledge'}
          onPress={onAcknowledge}
          testID="acknowledge-button"
          disabled={acknowledge.isPending || isOffline}
        />
        <View style={styles.snoozeRow}>
          {[15, 60, 240, 1440].map((minutes) => {
            const selected = snoozeMinutes === minutes;
            return (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.snoozeChip,
                  selected
                    ? { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen }
                    : { backgroundColor: colors.background },
                ]}
                onPress={() => setSnoozeMinutes(minutes)}
                disabled={mute.isPending || isResolved}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: selected ? colors.white : colors.textSecondary },
                  ]}
                >
                  {formatSnoozeLabel(minutes)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <PrimaryButton
          label={mute.isPending ? 'Muting...' : `Mute ${formatSnoozeLabel(snoozeMinutes)}`}
          onPress={onMute}
          testID="mute-button"
          disabled={mute.isPending || isOffline || isResolved}
          variant="outline"
          style={{ marginTop: spacing.sm }}
        />
        {actionError ? <Text style={[typography.caption, styles.errorText]}>{actionError}</Text> : null}
        {isResolved ? (
          <Text style={[typography.caption, styles.muted]}>
            This alert is resolved; snooze will be cleared until it reopens.
          </Text>
        ) : null}
        {isOffline ? (
          <Text style={[typography.caption, styles.offlineNote]}>
            Requires network connection to acknowledge or mute alerts.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
};

const formatSnoozeLabel = (minutes: number) => {
  if (minutes >= 1440) return 'Until resolved (max 24h)';
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  return `${minutes}m`;
};

const severityStyles = (severity: string) => {
  switch (severity) {
    case 'critical':
      return { backgroundColor: colors.errorSoft, textColor: colors.error };
    case 'warning':
      return { backgroundColor: colors.warningSoft, textColor: colors.warning };
    default:
      return { backgroundColor: colors.brandSoft, textColor: gradients.brandPrimary.start };
  }
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.md,
  },
  severityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  detailCard: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  actions: {
    marginBottom: spacing.xl,
  },
  snoozeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  snoozeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.error, marginTop: spacing.sm },
  offlineNote: { color: colors.textSecondary, marginTop: spacing.sm },
});
