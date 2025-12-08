import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkOrdersList } from '../../api/hooks';
import type { WorkOrder, WorkOrderStatus } from '../../api/workOrders/types';
import { Screen, Card, PillTabGroup, ErrorCard, EmptyState, StatusPill } from '../../components';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { typography } from '../../theme/typography';

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

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

const slaInfo = (order: WorkOrder) => {
  const slaDueAt = parseDate(order.slaDueAt ?? order.sla_due_at ?? null);
  const resolvedAt = parseDate(order.resolvedAt ?? order.resolved_at ?? null);
  const slaBreached = order.slaBreached ?? order.sla_breached ?? false;
  const now = new Date();
  const isDone = order.status === 'done';
  const overdue = !isDone && slaDueAt ? now.getTime() > slaDueAt.getTime() || slaBreached : false;
  const dueSoon =
    !isDone && slaDueAt
      ? slaDueAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 && slaDueAt.getTime() >= now.getTime()
      : false;

  return {
    slaDueAt,
    resolvedAt,
    slaBreached: isDone ? slaBreached : overdue || slaBreached,
    overdue,
    dueSoon,
    isDone,
  };
};

const slaPillFor = (order: WorkOrder) => {
  const info = slaInfo(order);
  if (!info.slaDueAt) return { label: 'No SLA', tone: 'muted' as const };
  if (info.isDone) {
    return info.slaBreached
      ? { label: 'Done (breached)', tone: 'warning' as const }
      : { label: 'Done (SLA)', tone: 'success' as const };
  }
  if (info.overdue) return { label: 'Overdue', tone: 'error' as const };
  if (info.dueSoon) return { label: 'Due soon', tone: 'warning' as const };
  return { label: 'On track', tone: 'success' as const };
};

const formatSlaDueLabel = (dueAt: Date | null) => {
  if (!dueAt) return 'No SLA target';
  const now = new Date();
  const time = dueAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (dueAt.toDateString() === now.toDateString()) {
    return `Due today ${time}`;
  }
  if (dueAt.toDateString() === tomorrow.toDateString()) {
    return `Due tomorrow ${time}`;
  }
  return `Due ${dueAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
};

export const WorkOrdersScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');
  const { data, isLoading, isError, refetch } = useWorkOrdersList({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { isOffline } = useNetworkBanner();
  const { theme } = useAppTheme();
  const { colors, gradients, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [cachedOrders, setCachedOrders] = useState<WorkOrder[] | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
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

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    if (statusFilter === 'done') {
      return list.sort((a, b) => {
        const aResolved = slaInfo(a).resolvedAt ?? parseDate(a.updated_at) ?? parseDate(a.created_at);
        const bResolved = slaInfo(b).resolvedAt ?? parseDate(b.updated_at) ?? parseDate(b.created_at);
        return (bResolved?.getTime() ?? 0) - (aResolved?.getTime() ?? 0);
      });
    }
    if (statusFilter === 'open' || statusFilter === 'in_progress') {
      return list.sort((a, b) => {
        const aSla = slaInfo(a);
        const bSla = slaInfo(b);
        if (aSla.overdue !== bSla.overdue) return aSla.overdue ? -1 : 1;
        if (aSla.slaDueAt && bSla.slaDueAt) {
          return aSla.slaDueAt.getTime() - bSla.slaDueAt.getTime();
        }
        if (aSla.slaDueAt) return -1;
        if (bSla.slaDueAt) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
    return list;
  }, [filteredOrders, statusFilter]);

  const hasCached = (cachedOrders?.length ?? 0) > 0;
  const cacheStale = isCacheOlderThan(cachedAt, CACHE_STALE_MS);
  const cachedAtDate = cachedAt ? new Date(cachedAt) : null;
  const cacheUpdatedLabel = cachedAtDate ? cachedAtDate.toLocaleString() : null;
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
      {cachedAtDate && (isOffline || cacheStale) ? (
        <Text style={[typography.caption, styles.staleNote]}>
          SLA timers are based on last sync at{' '}
          {cachedAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        </Text>
      ) : null}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.caption, styles.muted]}>Maintenance</Text>
            <Text style={[typography.title1, styles.title]}>Work orders</Text>
          </View>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => navigation.navigate('MaintenanceCalendar')}
            testID="view-calendar-button"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.brandGreen} />
            <Text style={[typography.caption, styles.title, { marginLeft: spacing.xs }]}>
              View calendar
            </Text>
          </TouchableOpacity>
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
        data={sortedOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        testID="workorders-list"
        renderItem={({ item }) => {
          const status = statusPillFor(item.status);
          const sla = slaPillFor(item);
          const slaDueAt = slaInfo(item).slaDueAt;
          return (
            <Card
              style={styles.orderCard}
              onPress={() => navigation.navigate('WorkOrderDetail', { workOrderId: item.id })}
              testID="work-order-card"
            >
              <View style={styles.orderHeader}>
                <View style={styles.badgeRow}>
                  <StatusPill label={status.label} tone={status.tone} />
                  <StatusPill
                    label={sla.label}
                    tone={sla.tone}
                    style={{ marginLeft: spacing.xs }}
                    testID={`sla-pill-${item.id}`}
                  />
                </View>
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
                {item.device_name ? ` > ${item.device_name}` : ''}
              </Text>
              <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
                {formatSlaDueLabel(slaDueAt)}
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

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: theme.colors.textPrimary },
    muted: { color: theme.colors.textSecondary },
    headerCard: {
      marginBottom: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    filterRow: {
      marginTop: theme.spacing.md,
    },
    orderCard: {
      paddingVertical: theme.spacing.md,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    calendarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundAlt,
    },
    priority: {
      color: theme.colors.brandGrey,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    alertBadge: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: theme.colors.backgroundAlt,
    },
    offlineNote: { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
    staleNote: { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  });
