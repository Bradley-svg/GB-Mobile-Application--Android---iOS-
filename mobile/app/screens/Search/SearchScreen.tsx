import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFleetSearch } from '../../api/hooks';
import type { FleetSearchResult, HealthStatus } from '../../api/types';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, IconButton, EmptyState, PillTab } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { isCacheOlderThan, loadJsonWithMetadata, saveJson } from '../../utils/storage';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const HEALTH_FILTERS: HealthStatus[] = ['healthy', 'warning', 'critical', 'offline'];
const CACHE_KEY = 'fleet-search-cache';
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

type SearchItem =
  | ({ type: 'site'; siteId: string } & FleetSearchResult['sites'][number])
  | ({ type: 'device'; deviceId: string } & FleetSearchResult['devices'][number]);

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { isOffline } = useNetworkBanner();
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthStatus[]>([]);
  const [cachedResults, setCachedResults] = useState<FleetSearchResult | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const searchQuery = useFleetSearch({
    q: query,
    health: healthFilter,
    enabled: !isOffline,
  });

  useEffect(() => {
    if (!isOffline && searchQuery.data) {
      saveJson(CACHE_KEY, searchQuery.data);
      setCachedAt(new Date().toISOString());
    }
  }, [isOffline, searchQuery.data]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const cached = await loadJsonWithMetadata<FleetSearchResult>(CACHE_KEY);
      if (!cancelled) {
        setCachedResults(cached?.data ?? null);
        setCachedAt(cached?.savedAt ?? null);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const toggleHealth = (state: HealthStatus) => {
    setHealthFilter((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const onlineResults = searchQuery.data;
  const isCacheStale = isCacheOlderThan(cachedAt, CACHE_STALE_MS);

  const offlineResults = useMemo(() => {
    if (!cachedResults) return null;
    const needle = query.toLowerCase();
    const matchesHealth = (health?: HealthStatus) =>
      healthFilter.length === 0 || (health && healthFilter.includes(health));

    const filteredSites = cachedResults.sites.filter(
      (s) =>
        matchesHealth(s.health as HealthStatus) &&
        (!needle ||
          s.name.toLowerCase().includes(needle) ||
          (s.city || '').toLowerCase().includes(needle))
    );
    const filteredDevices = cachedResults.devices.filter(
      (d) =>
        matchesHealth(d.health as HealthStatus) &&
        (!needle ||
          d.name.toLowerCase().includes(needle) ||
          (d.site_name || '').toLowerCase().includes(needle))
    );

    return { sites: filteredSites, devices: filteredDevices } as FleetSearchResult;
  }, [cachedResults, healthFilter, query]);

  const results = isOffline ? offlineResults : onlineResults;
  const isLoading = searchQuery.isLoading && !isOffline;
  const shouldShowNoConnection = isOffline && !cachedResults;
  const items: SearchItem[] = useMemo(() => {
    if (!results) return [];
    const siteItems =
      results.sites?.map((s) => ({
        ...s,
        type: 'site' as const,
        siteId: s.id,
      })) ?? [];
    const deviceItems =
      results.devices?.map((d) => ({
        ...d,
        type: 'device' as const,
        deviceId: d.id,
      })) ?? [];
    return [...siteItems, ...deviceItems];
  }, [results]);

  const renderItem = ({ item }: { item: SearchItem }) => {
    if (item.type === 'site') {
      return (
        <Card
          style={styles.resultCard}
          onPress={() => navigation.navigate('SiteOverview', { siteId: item.siteId })}
          testID="search-result-site"
        >
          <View style={styles.resultRow}>
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
            {renderHealthPill(item.health as HealthStatus, item.status)}
          </View>
        </Card>
      );
    }

    return (
      <Card
        style={styles.resultCard}
        onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.deviceId })}
        testID="search-result-device"
      >
        <View style={styles.resultRow}>
          <View style={styles.iconBadge}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.brandGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
              {item.site_name || 'Unknown site'}
            </Text>
          </View>
          {renderHealthPill(item.health as HealthStatus, item.status)}
          <IconButton
            icon={<Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.deviceId })}
            testID="search-device-detail"
            style={{ marginLeft: spacing.xs }}
          />
        </View>
      </Card>
    );
  };

  return (
    <Screen scroll={false} testID="SearchScreen">
      <Text style={[typography.title2, styles.title, { marginTop: spacing.lg }]}>Search</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
        <TextInput
          placeholder="Search sites or devices"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          autoFocus
          testID="search-input"
        />
      </View>
      <View style={styles.filterRow}>
        {HEALTH_FILTERS.map((state) => (
          <View key={state} style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}>
            <PillTab
              label={state.toUpperCase()}
              selected={healthFilter.includes(state)}
              onPress={() => toggleHealth(state)}
              testID={`health-filter-${state}`}
            />
          </View>
        ))}
      </View>

      {isOffline ? (
        <Text style={[typography.caption, styles.muted, { marginBottom: spacing.sm }]}>
          Offline search - based on cached data.
        </Text>
      ) : null}
      {isCacheStale ? (
        <Text style={[typography.caption, styles.staleNote]}>
          Data older than 24 hours may be out of date.
        </Text>
      ) : null}

      {shouldShowNoConnection ? (
        <EmptyState message="Search requires a connection. Reconnect to search the fleet." testID="search-offline-empty" />
      ) : isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.brandGreen} />
          <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
            Searching fleet...
          </Text>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          message={query ? 'No results found.' : 'Start typing to search sites and devices.'}
          testID="search-empty"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.type === 'site' ? item.siteId : item.deviceId}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          testID="search-results"
        />
      )}
    </Screen>
  );
};

const renderHealthPill = (health?: HealthStatus, status?: string | null) => {
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
  } else if (normalized === 'offline' || normalized.includes('off')) {
    backgroundColor = colors.errorSoft;
    textColor = colors.error;
    label = 'Offline';
  }

  return (
    <View style={[styles.healthPill, { backgroundColor }]}>
      <Text style={[typography.label, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  resultCard: {
    padding: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  healthPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    marginLeft: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  staleNote: {
    color: colors.warning,
    marginBottom: spacing.sm,
  },
});
