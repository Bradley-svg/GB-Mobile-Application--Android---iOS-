import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkOrdersList } from '../../api/hooks';
import type { WorkOrder, WorkOrderStatus } from '../../api/workOrders/types';
import { Screen, Card, PillTabGroup, ErrorCard, EmptyState, StatusPill } from '../../components';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList, 'WorkOrders'>;

const CACHE_KEY = 'work-orders-cache:all';
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

const statusPillFor = (status: WorkOrderStatus) => {
  switch (status) {
    case 'open':
      return { label: 'Open', tone: 'warning' as const };
    case 'in_progress':
      return { label: 'In progress', tone: 'warning' as const };
    case 'done':
      return { label: 'Done', tone: 'success' as const };
    case 'cancelled':
    default:
      return { label: 'Cancelled', tone: 'muted' as const };
  }
};

const severityColor = (severity?: string | null) => {
  switch (severity) {
    case 'critical':
      return colors.error;
    case 'warning':
      return colors.warning;
    default:
      return gradients.brandPrimary.start;
  }
};

export const WorkOrdersScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');
  const { data, isLoading, isError, refetch } = useWorkOrdersList({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { isOffline } = useNetworkBanner();
  const [cachedOrders, setCachedOrders] = useState<WorkOrder[] | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!data || isOffline) return;

    saveJson(CACHE_KEY, data);
    setCachedAt(new Date().toISOString());
  }, [data, isOffline]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const cached = await loadJsonWithMetadata<WorkOrder[]>(CACHE_KEY);
      if (!cancelled) {
        setCachedOrders(cached?.data ?? null);
        setCachedAt(cached?.savedAt ?? null);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const ordersList = useMemo(
    () => data ?? cachedOrders ?? [],
    [data, cachedOrders]
  );
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return ordersList;
    return ordersList.filter((wo) => wo.status === statusFilter);
  }, [ordersList, statusFilter]);

  const hasCached = (cachedOrders?.length ?? 0) > 0;
  const cacheStale = isCacheOlderThan(cachedAt, CACHE_STALE_MS);
  const cacheUpdatedLabel = cachedAt ? new Date(cachedAt).toLocaleString() : null;
  const showLoading = isLoading && filteredOrders.length === 0;
  const shouldShowError = isError && !isOffline && filteredOrders.length === 0;

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="WorkOrdersScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>
          Loading work orders...
        </Text>
      </Screen>
    );
  }

  if (shouldShowError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="WorkOrdersScreen">
        <ErrorCard
          title="Couldn't load work orders"
          message="Please try again in a moment."
          onRetry={() => refetch()}
          testID="workorders-error"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="WorkOrdersScreen">
      {isOffline ? (
        <Text style={[typography.caption, styles.offlineNote]}>
          {hasCached ? 'Offline - showing cached work orders (read-only).' : 'Offline and no cached work orders.'}
        </Text>
      ) : null}
      {cacheStale ? (
        <Text style={[typography.caption, styles.staleNote]}>
          Data older than 24 hours may be out of date
          {cacheUpdatedLabel ? ` (cached ${cacheUpdatedLabel})` : ''}.
        </Text>
      ) : null}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.caption, styles.muted]}>Maintenance</Text>
            <Text style={[typography.title1, styles.title]}>Work orders</Text>
          </View>
          <Ionicons name="construct-outline" size={20} color={colors.brandGrey} />
        </View>
        <View style={styles.filterRow}>
          <PillTabGroup
            value={statusFilter}
            options={[
              { value: 'all', label: 'ALL' },
              { value: 'open', label: 'OPEN' },
              { value: 'in_progress', label: 'IN PROGRESS' },
              { value: 'done', label: 'DONE' },
            ]}
            onChange={(value) => setStatusFilter(value as 'all' | WorkOrderStatus)}
          />
        </View>
      </Card>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        testID="workorders-list"
        renderItem={({ item }) => {
          const status = statusPillFor(item.status);
          return (
            <Card
              style={styles.orderCard}
              onPress={() => navigation.navigate('WorkOrderDetail', { workOrderId: item.id })}
              testID="work-order-card"
            >
              <View style={styles.orderHeader}>
                <StatusPill label={status.label} tone={status.tone} />
                {item.priority ? (
                  <Text style={[typography.caption, styles.priority]}>
                    {item.priority.toUpperCase()}
                  </Text>
                ) : null}
              </View>
              <Text style={[typography.title2, styles.title]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
                {item.site_name || 'Unknown site'}
                {item.device_name ? ` • ${item.device_name}` : ''}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[typography.caption, styles.muted]}>
                  Created {new Date(item.created_at).toLocaleDateString()}
                </Text>
                {item.alert_id ? (
                  <View style={styles.alertBadge}>
                    <Ionicons name="alert-circle" size={14} color={severityColor(item.alert_severity)} />
                  </View>
                ) : null}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            message={
              isOffline
                ? hasCached
                  ? 'Offline - showing cached work orders (read-only).'
                  : 'Offline and no cached work orders.'
                : statusFilter === 'all'
                ? 'No work orders yet.'
                : 'No work orders match this filter.'
            }
            testID="workorders-empty"
          />
        }
      />
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
  headerCard: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    marginTop: spacing.md,
  },
  orderCard: {
    paddingVertical: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priority: {
    color: colors.brandGrey,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  alertBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.backgroundAlt,
  },
  offlineNote: { color: colors.textSecondary, marginBottom: spacing.xs },
  staleNote: { color: colors.textSecondary, marginBottom: spacing.xs },
});
