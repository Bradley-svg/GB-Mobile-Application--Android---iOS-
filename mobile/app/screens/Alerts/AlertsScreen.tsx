import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, PillTabGroup, IconButton, ErrorCard, EmptyState } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJson, saveJson } from '../../utils/storage';
import type { Alert } from '../../api/types';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
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

const ALERTS_CACHE_KEY = 'alerts-cache:all';

export const AlertsScreen: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'warning' | 'critical'>('all');
  const { data: alerts, isLoading, isError, refetch } = useAlerts({
    status: 'active',
    severity: severityFilter === 'all' ? undefined : severityFilter,
  });

  const navigation = useNavigation<Navigation>();
  const { isOffline } = useNetworkBanner();
  const [cachedAlerts, setCachedAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    if (!alerts || isOffline) return;

    setCachedAlerts((prev) => {
      const isSame =
        prev &&
        prev.length === alerts.length &&
        prev.every((a, idx) => a.id === alerts[idx].id && a.status === alerts[idx].status);
      if (isSame) return prev;
      saveJson(ALERTS_CACHE_KEY, alerts);
      return alerts;
    });
  }, [alerts, isOffline]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const cached = await loadJson<Alert[]>(ALERTS_CACHE_KEY);
      if (!cancelled) {
        setCachedAlerts(cached);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const alertsList = useMemo(() => alerts ?? cachedAlerts ?? [], [alerts, cachedAlerts]);
  const hasCachedAlerts = (cachedAlerts?.length ?? 0) > 0;
  const showLoading = isLoading && alertsList.length === 0;
  const shouldShowError = isError && !isOffline && alertsList.length === 0;

  const sortedAlerts = useMemo(
    () =>
      (alertsList || []).slice().sort((a, b) => {
        const sA = SEVERITY_ORDER[a.severity] ?? 99;
        const sB = SEVERITY_ORDER[b.severity] ?? 99;
        if (sA !== sB) return sA - sB;
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
      }),
    [alertsList]
  );

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertsScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading alerts...</Text>
      </Screen>
    );
  }

  if (shouldShowError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertsScreen">
        <ErrorCard
          title="Couldn't load alerts"
          message="Please try again in a moment."
          onRetry={() => refetch()}
          testID="alerts-error"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="AlertsScreen">
      {isOffline ? (
        <Text style={[typography.caption, styles.offlineNote]}>
          {hasCachedAlerts ? 'Offline - showing cached alerts (read-only).' : 'Offline and no cached alerts.'}
        </Text>
      ) : null}
      <FlatList
        data={sortedAlerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={6}
        removeClippedSubviews
        testID="alerts-list"
        ListHeaderComponent={
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[typography.caption, styles.muted]}>Overview</Text>
                <Text style={[typography.title1, styles.title]}>Alerts</Text>
              </View>
              <IconButton icon={<Ionicons name="filter-outline" size={20} color={colors.brandGrey} />} />
            </View>
            <View style={styles.filterRow}>
              <PillTabGroup
                value={severityFilter}
                options={[
                  { value: 'all', label: 'ALL' },
                  { value: 'warning', label: 'WARNING' },
                  { value: 'critical', label: 'CRITICAL' },
                ]}
                onChange={(value) => setSeverityFilter(value)}
              />
            </View>
          </Card>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const { backgroundColor, textColor } = severityStyles(item.severity);
          return (
            <Card
              style={styles.alertCard}
              onPress={() => navigation.navigate('AlertDetail', { alertId: item.id })}
              testID="alert-card"
            >
              <View style={[styles.alertRow]}>
                <View style={[styles.severityPill, { backgroundColor }]}>
                  <Text style={[typography.label, { color: textColor }]}>{item.severity.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.title]} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
                    {item.type.toUpperCase()} - {new Date(item.last_seen_at).toLocaleString()}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginLeft: spacing.sm }}
                />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            message={
              isOffline
                ? hasCachedAlerts
                  ? 'Offline - showing cached alerts (read-only).'
                  : 'Offline and no cached alerts.'
                : 'No active alerts.'
            }
            testID="alerts-empty"
          />
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  offlineNote: { color: colors.textSecondary, marginBottom: spacing.sm },
  headerCard: { marginTop: spacing.xl, marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  alertCard: { padding: spacing.md },
  alertRow: { flexDirection: 'row', alignItems: 'center' },
  severityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
});
