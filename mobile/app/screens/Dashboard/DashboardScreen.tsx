import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlerts, useSites } from '../../api/hooks';
import type { ApiSite, HealthStatus } from '../../api/types';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, IconButton, ErrorCard, EmptyState } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const HEALTH_STATES: HealthStatus[] = ['healthy', 'warning', 'critical', 'offline'];

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, refetch } = useSites();
  const { data: alerts } = useAlerts({ status: 'active' });
  const { isOffline } = useNetworkBanner();
  const [cachedSites, setCachedSites] = useState<ApiSite[] | null>(null);
  const [cachedSitesSavedAt, setCachedSitesSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      saveJson('dashboardSites', data);
    }
  }, [data]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const cached = await loadJsonWithMetadata<ApiSite[]>('dashboardSites');
      if (!cancelled) {
        setCachedSites(cached?.data ?? null);
        setCachedSitesSavedAt(cached?.savedAt ?? null);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const sites = useMemo(() => data ?? cachedSites ?? [], [data, cachedSites]);
  const hasCachedSites = (cachedSites?.length ?? 0) > 0;
  const cacheStale = isCacheOlderThan(cachedSitesSavedAt, CACHE_STALE_MS);
  const cacheUpdatedLabel = cachedSitesSavedAt
    ? new Date(cachedSitesSavedAt).toLocaleString()
    : null;
  const showLoading = isLoading && !hasCachedSites;
  const shouldShowError = isError && !isOffline && !hasCachedSites;

  const metrics = useMemo(() => {
    const totalSites = sites.length;
    const onlineDevices = sites.reduce((acc, site) => {
      const onlineCount = site.online_devices ?? site.device_count_online ?? 0;
      return acc + onlineCount;
    }, 0);
    return [
      { label: 'Sites', value: totalSites },
      { label: 'Online devices', value: onlineDevices },
      { label: 'Active alerts', value: alerts?.length ?? 0, color: colors.error },
    ];
  }, [alerts?.length, sites]);

  const healthCounts = useMemo(() => {
    return sites.reduce(
      (acc, site) => {
        const state = (site.health as HealthStatus) || 'healthy';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      },
      { healthy: 0, warning: 0, critical: 0, offline: 0 } as Record<HealthStatus, number>
    );
  }, [sites]);

  const fleetRecency = useMemo(() => {
    if (sites.length === 0) return 'No sites yet';
    const anyOffline = sites.some((s) => s.last_seen?.isOffline);
    const anyStale = sites.some((s) => s.last_seen?.isStale && !s.last_seen?.isOffline);
    if (anyOffline) return 'Some sites offline';
    if (anyStale) return 'Some sites stale';
    return 'All data current';
  }, [sites]);

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DashboardScreen">
        <ActivityIndicator size="large" color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading sites...</Text>
      </Screen>
    );
  }

  if (shouldShowError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DashboardScreen">
        <ErrorCard
          title="Couldn't load sites"
          message="Check your connection and try again."
          onRetry={() => refetch()}
          testID="dashboard-error"
        />
      </Screen>
    );
  }

  const listHeader = (
    <View>
      <LinearGradient
        colors={[gradients.brandPrimary.start, gradients.brandPrimary.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heroCard}
      >
        <View>
          <Text style={[typography.caption, styles.heroMuted, { marginBottom: spacing.xs }]}>Portfolio</Text>
          <Text style={[typography.title1, styles.heroTitle]}>Greenbro</Text>
          <Text style={[typography.body, styles.heroMuted]}>Sites and devices at a glance</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={<Ionicons name="notifications-outline" size={20} color={colors.brandGrey} />}
            style={{ marginRight: spacing.sm }}
          />
          <IconButton icon={<Ionicons name="settings-outline" size={20} color={colors.brandGrey} />} />
        </View>
      </LinearGradient>

      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.9}
        testID="dashboard-search-entry"
      >
        <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
        <Text style={[typography.body, styles.muted]}>Search sites and devices</Text>
      </TouchableOpacity>

      {isOffline ? (
        <Card style={styles.offlineCard} testID="dashboard-offline-banner">
          <Text style={[typography.caption, styles.offlineNote]}>
            Offline - showing cached portfolio data in read-only mode.
          </Text>
          {cacheUpdatedLabel ? (
            <Text style={[typography.caption, styles.offlineNote]}>
              Viewing cached data (last updated {cacheUpdatedLabel}).
            </Text>
          ) : null}
          {cacheStale ? (
            <Text style={[typography.caption, styles.staleNote]}>
              Data older than 24 hours – may be out of date.
            </Text>
          ) : null}
        </Card>
      ) : cacheStale ? (
        <Card style={styles.offlineCard}>
          <Text style={[typography.caption, styles.staleNote]}>
            Data older than 24 hours – may be out of date.
          </Text>
          {cacheUpdatedLabel ? (
            <Text style={[typography.caption, styles.offlineNote]}>
              Last cached at {cacheUpdatedLabel}.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.metricsCard}>
        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text style={[typography.caption, styles.muted]}>{metric.label}</Text>
              <Text
                style={[
                  typography.title2,
                  styles.title,
                  metric.color ? { color: metric.color } : { color: colors.textPrimary },
                ]}
              >
                {metric.value}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.healthRow}>
          {HEALTH_STATES.map((state) => (
            <View key={state} style={[styles.healthChip, healthChipStyle(state)]}>
              <Text style={[typography.caption, styles.healthLabel]}>
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </Text>
              <Text style={[typography.subtitle, styles.healthCount]}>{healthCounts[state]}</Text>
            </View>
          ))}
        </View>
        <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
          {fleetRecency}
        </Text>
      </Card>

      <Text style={[typography.subtitle, styles.sectionTitle]}>Sites</Text>
    </View>
  );
  const allowSiteNavigation = !isOffline || hasCachedSites;

  return (
    <Screen scroll={false} testID="DashboardScreen">
      {listHeader}
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={null}
        ListEmptyComponent={
          <EmptyState
            message={isOffline ? 'Offline - no cached sites available yet.' : 'No sites available yet.'}
            testID="dashboard-empty"
          />
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        testID="dashboard-site-list"
        renderItem={({ item }) => (
          <Card
            style={styles.siteCard}
            testID="site-card"
            onPress={allowSiteNavigation ? () => navigation.navigate('SiteOverview', { siteId: item.id }) : undefined}
          >
            <View style={styles.siteHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="home-outline" size={18} color={colors.brandGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
                  {item.city || 'Unknown city'}
                </Text>
              </View>
              {renderStatusPill(item.health, item.status)}
            </View>
            <View style={styles.siteMeta}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, styles.muted]}>Last seen</Text>
                <Text style={[typography.body, styles.title]}>
                  {item.last_seen?.at
                    ? new Date(item.last_seen.at).toLocaleString()
                    : item.last_seen_at
                    ? new Date(item.last_seen_at).toLocaleString()
                    : 'Unknown'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, styles.muted]}>Status</Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {(item.health || item.status || 'Unknown').toString()}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
};

const renderStatusPill = (health?: HealthStatus, status?: string | null) => {
  const normalized = health || (status || '').toLowerCase();
  let backgroundColor: string = colors.backgroundAlt;
  let textColor: string = colors.textSecondary;
  let label = (health || status || 'Unknown').toString();

  if (normalized === 'healthy' || normalized.includes('healthy') || normalized.includes('online')) {
    backgroundColor = colors.brandSoft;
    textColor = colors.success;
    label = 'Healthy';
  } else if (normalized === 'critical' || normalized.includes('critical')) {
    backgroundColor = colors.errorSoft;
    textColor = colors.error;
    label = 'Critical';
  } else if (normalized === 'warning' || normalized.includes('warn')) {
    backgroundColor = colors.warningSoft;
    textColor = colors.warning;
    label = 'Warning';
  } else if (normalized === 'offline' || normalized.includes('off') || normalized.includes('down')) {
    backgroundColor = colors.errorSoft;
    textColor = colors.error;
    label = 'Offline';
  }

  return (
    <View style={[styles.statusPill, { backgroundColor }]}>
      <Text style={[typography.label, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const healthChipStyle = (state: HealthStatus) => {
  switch (state) {
    case 'healthy':
      return { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft };
    case 'warning':
      return { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft };
    case 'critical':
      return { backgroundColor: colors.errorSoft, borderColor: colors.errorSoft };
    case 'offline':
    default:
      return { backgroundColor: colors.backgroundAlt, borderColor: colors.borderSubtle };
  }
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
  },
  muted: {
    color: colors.textSecondary,
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: gradients.brandPrimary.end,
  },
  heroTitle: {
    color: colors.white,
  },
  heroMuted: {
    color: colors.white,
  },
  offlineCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundAlt,
  },
  offlineNote: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  staleNote: {
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  metricsCard: {
    marginBottom: spacing.xl,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  healthChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  healthLabel: {
    color: colors.textSecondary,
  },
  healthCount: {
    color: colors.textPrimary,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  gridRow: {
    flex: 1,
    justifyContent: 'space-between',
  },
  siteCard: {
    width: '48%',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 14,
  },
  siteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundAlt,
  },
});
