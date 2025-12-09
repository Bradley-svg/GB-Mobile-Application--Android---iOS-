import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenanceSummary } from '../../api/hooks';
import type { MaintenanceSummary, MaintenanceSummaryItem } from '../../api/workOrders/types';
import { Screen, Card, EmptyState, ErrorCard } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { createThemedStyles } from '../../theme/createThemedStyles';

const CACHE_KEY = 'maintenance-summary-cache';
const CACHE_STALE_MS = 12 * 60 * 60 * 1000;

type SummaryTone = 'open' | 'overdue' | 'soon';
type ItemTone = 'overdue' | 'open' | 'done';

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDayLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const itemStatusLabel = (item: MaintenanceSummaryItem) => {
  const due = new Date(item.slaDueAt);
  const now = new Date();
  const today = startOfDay(now).getTime();
  const dueDay = startOfDay(due).getTime();

  if (item.status === 'done') return 'Done';
  if (due.getTime() < now.getTime()) return 'Overdue';
  if (dueDay === today) return 'Due today';
  const diffDays = Math.round((dueDay - today) / (24 * 60 * 60 * 1000));
  return diffDays === 1 ? 'Due tomorrow' : `Due in ${diffDays} days`;
};

export const MaintenanceCalendarScreen: React.FC = () => {
  const { data, isLoading, isError, refetch } = useMaintenanceSummary();
  const { isOffline } = useNetworkBanner();
  const [cachedSummary, setCachedSummary] = useState<MaintenanceSummary | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing, typography, gradients } = theme;

  const renderSummaryChip = (label: string, count: number, tone: SummaryTone, testID?: string) => {
    const palette =
      tone === 'overdue'
        ? { bg: colors.errorSoft, fg: colors.error }
        : tone === 'soon'
        ? { bg: colors.warningSoft, fg: colors.warning }
        : { bg: colors.brandSoft, fg: colors.brandGreen };
    return (
      <View style={[styles.chip, { backgroundColor: palette.bg }]} testID={testID}>
        <Text style={[typography.caption, { color: palette.fg }]}>{label}</Text>
        <Text style={[typography.title2, { color: palette.fg }]}>{count}</Text>
      </View>
    );
  };

  const renderItemRow = (item: MaintenanceSummaryItem, tone: ItemTone) => {
    const accent =
      tone === 'overdue'
        ? colors.error
        : tone === 'open'
        ? gradients.brandPrimary.start
        : colors.brandGreen;
    return (
      <View key={item.workOrderId} style={styles.itemRow} testID="maintenance-item">
        <View style={[styles.itemAccent, { backgroundColor: accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, styles.title]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
            {item.siteName || 'Unknown site'}
            {item.deviceName ? ` > ${item.deviceName}` : ''}
          </Text>
          <Text style={[typography.caption, styles.muted]}>{itemStatusLabel(item)}</Text>
        </View>
      </View>
    );
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
      const cached = await loadJsonWithMetadata<MaintenanceSummary>(CACHE_KEY);
      if (!cancelled) {
        setCachedSummary(cached?.data ?? null);
        setCachedAt(cached?.savedAt ?? null);
      }
    };
    loadCache();
    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const summary = useMemo(() => data ?? cachedSummary, [cachedSummary, data]);
  const summaryCounts = useMemo(
    () => ({
      open: summary?.openCount ?? 0,
      overdue: summary?.overdueCount ?? 0,
      dueSoon: summary?.dueSoonCount ?? 0,
    }),
    [summary?.dueSoonCount, summary?.openCount, summary?.overdueCount]
  );
  const days = useMemo(() => (summary?.byDate ?? []).filter(Boolean), [summary?.byDate]);
  const hasCached = Boolean(cachedSummary);
  const cacheStale = isCacheOlderThan(cachedAt, CACHE_STALE_MS);
  const cachedAtDate = cachedAt ? new Date(cachedAt) : null;

  if (isLoading && !summary) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="MaintenanceCalendarScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading maintenance...</Text>
      </Screen>
    );
  }

  if (isError && !summary) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="MaintenanceCalendarScreen">
        <ErrorCard
          title="Couldn't load maintenance"
          message="Please try again in a moment."
          onRetry={() => refetch()}
          testID="maintenance-error"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="MaintenanceCalendarScreen">
      {isOffline ? (
        <View style={styles.banner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.textPrimary} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[typography.caption, styles.title]}>Read-only cached maintenance view</Text>
            <Text style={[typography.caption, styles.muted]}>
              {hasCached && cachedAtDate
                ? `Last updated ${cachedAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'No cached data available.'}
            </Text>
          </View>
        </View>
      ) : null}
      {cacheStale && cachedAtDate ? (
        <Text style={[typography.caption, styles.muted, { marginBottom: spacing.sm }]}>
          Data may be out of date (cached {cachedAtDate.toLocaleString()}).
        </Text>
      ) : null}

      {summary ? (
        <>
          <Card style={styles.summaryCard}>
            <Text style={[typography.caption, styles.muted]}>Maintenance</Text>
            <Text style={[typography.title1, styles.title, { marginBottom: spacing.sm }]}>
              Calendar & reminders
            </Text>
            <View style={styles.chipRow}>
              {renderSummaryChip('Open', summaryCounts.open, 'open', 'maintenance-open-count')}
              {renderSummaryChip('Overdue', summaryCounts.overdue, 'overdue', 'maintenance-overdue-count')}
              {renderSummaryChip('Due soon', summaryCounts.dueSoon, 'soon', 'maintenance-due-soon-count')}
            </View>
          </Card>

          {days.length === 0 ? (
            <EmptyState
              message={isOffline && !hasCached ? 'Offline and no cached maintenance data.' : 'No upcoming maintenance found.'}
              testID="maintenance-empty"
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {days.map((day) => (
                <Card key={day.date} style={styles.dayCard}>
                  <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.xs }]}>
                    {formatDayLabel(day.date)}
                  </Text>
                  {day.overdue.map((item) => renderItemRow(item, 'overdue'))}
                  {day.open.map((item) => renderItemRow(item, 'open'))}
                  {day.done.map((item) => renderItemRow(item, 'done'))}
                </Card>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <EmptyState
          message="No maintenance data available."
          testID="maintenance-empty"
        />
      )}
    </Screen>
  );
};

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return createThemedStyles(theme, {
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: colors.textPrimary },
    muted: { color: colors.textSecondary },
    summaryCard: {
      marginBottom: spacing.md,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    chip: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 14,
      marginRight: spacing.sm,
    },
    dayCard: {
      marginBottom: spacing.sm,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    itemAccent: {
      width: 6,
      height: 38,
      borderRadius: 6,
      marginRight: spacing.sm,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: colors.backgroundAlt,
      marginBottom: spacing.sm,
    },
  });
};
