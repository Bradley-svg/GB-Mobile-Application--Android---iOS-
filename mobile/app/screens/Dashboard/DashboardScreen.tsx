import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts, useSites } from '../../api/hooks';
import type { ApiSite } from '../../api/types';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, IconButton, ErrorCard, EmptyState } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJson, saveJson } from '../../utils/storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, refetch } = useSites();
  const { data: alerts } = useAlerts({ status: 'active' });
  const { isOffline } = useNetworkBanner();
  const [cachedSites, setCachedSites] = useState<ApiSite[] | null>(null);

  useEffect(() => {
    if (data) {
      saveJson('dashboardSites', data);
    }
  }, [data]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const cached = await loadJson<ApiSite[]>('dashboardSites');
      if (!cancelled) {
        setCachedSites(cached);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const sites = useMemo(() => data ?? cachedSites ?? [], [data, cachedSites]);
  const hasCachedSites = (cachedSites?.length ?? 0) > 0;
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
      { label: 'Active alerts', value: alerts?.length ?? 0, color: colors.danger },
    ];
  }, [alerts?.length, sites]);

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading sites...</Text>
      </Screen>
    );
  }

  if (shouldShowError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
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
      <View style={styles.heroCard}>
        <View>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Portfolio</Text>
          <Text style={[typography.title1, styles.title]}>Greenbro</Text>
          <Text style={[typography.body, styles.muted]}>Sites and devices at a glance</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={<Ionicons name="notifications-outline" size={20} color={colors.dark} />}
            style={{ marginRight: spacing.sm }}
          />
          <IconButton icon={<Ionicons name="settings-outline" size={20} color={colors.dark} />} />
        </View>
      </View>

      {isOffline ? (
        <Text style={[typography.caption, styles.offlineNote]}>Offline - showing last known data.</Text>
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
                  metric.color ? { color: metric.color } : { color: colors.dark },
                ]}
              >
                {metric.value}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={[typography.subtitle, styles.sectionTitle]}>Sites</Text>
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        initialNumToRender={8}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            message={isOffline ? 'Offline - no cached sites available yet.' : 'No sites available yet.'}
            testID="dashboard-empty"
          />
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Card
            style={styles.siteCard}
            testID="site-card"
            onPress={() => navigation.navigate('SiteOverview', { siteId: item.id })}
          >
            <View style={styles.siteHeader}>
              <View style={styles.iconBadge}>
                <Ionicons name="home-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
                  {item.city || 'Unknown city'}
                </Text>
              </View>
              {renderStatusPill(item.status)}
            </View>
            <View style={styles.siteMeta}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, styles.muted]}>Last seen</Text>
                <Text style={[typography.body, styles.title]}>
                  {item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, styles.muted]}>Status</Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {item.status || 'Unknown'}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
};

const renderStatusPill = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  let backgroundColor = colors.surfaceMuted;
  let textColor = colors.textSecondary;
  let label = status || 'Unknown';

  if (normalized.includes('healthy') || normalized.includes('online')) {
    backgroundColor = colors.primarySoft;
    textColor = colors.success;
    label = 'Healthy';
  } else if (normalized.includes('warn')) {
    backgroundColor = '#FFF5E6';
    textColor = colors.warning;
    label = 'Warning';
  } else if (normalized.includes('off') || normalized.includes('down')) {
    backgroundColor = '#FFE8E6';
    textColor = colors.danger;
    label = 'Offline';
  }

  return (
    <View style={[styles.statusPill, { backgroundColor }]}>
      <Text style={[typography.label, { color: textColor }]}>{label}</Text>
    </View>
  );
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
    color: colors.dark,
  },
  muted: {
    color: colors.textSecondary,
  },
  heroCard: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  offlineNote: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
  sectionTitle: {
    marginBottom: spacing.md,
    color: colors.dark,
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
    backgroundColor: colors.primarySoft,
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
});
