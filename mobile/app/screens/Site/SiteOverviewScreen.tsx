import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevices, useSite } from '../../api/hooks';
import type { ApiDevice, ApiSite } from '../../api/types';
import { Screen, Card, IconButton, ErrorCard, EmptyState } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJson, saveJson } from '../../utils/storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'SiteOverview'>;

export const SiteOverviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { siteId } = route.params;

  const {
    data: site,
    isLoading: siteLoading,
    isError: siteError,
    refetch: refetchSite,
  } = useSite(siteId);
  const {
    data: devices,
    isLoading: devicesLoading,
    isError: devicesError,
    refetch: refetchDevices,
  } = useDevices(siteId);
  const { isOffline } = useNetworkBanner();
  const [cachedSite, setCachedSite] = useState<ApiSite | null>(null);
  const [cachedDevices, setCachedDevices] = useState<ApiDevice[] | null>(null);

  useEffect(() => {
    if (site) {
      saveJson(`site:${siteId}`, site);
    }
  }, [site, siteId]);

  useEffect(() => {
    if (devices) {
      saveJson(`siteDevices:${siteId}`, devices);
    }
  }, [devices, siteId]);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;

    const loadCache = async () => {
      const [siteCache, deviceCache] = await Promise.all([
        loadJson<ApiSite>(`site:${siteId}`),
        loadJson<ApiDevice[]>(`siteDevices:${siteId}`),
      ]);
      if (!cancelled) {
        setCachedSite(siteCache);
        setCachedDevices(deviceCache);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [isOffline, siteId]);

  const siteData = site ?? cachedSite;
  const devicesData = devices ?? cachedDevices ?? [];
  const hasCachedData = !!cachedSite || (cachedDevices?.length ?? 0) > 0;
  const showLoading = (siteLoading || devicesLoading) && !hasCachedData;
  const shouldShowError = (siteError || devicesError) && !isOffline && !hasCachedData;

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="SiteOverviewScreen">
        <ActivityIndicator size="large" color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading site...</Text>
      </Screen>
    );
  }

  if (shouldShowError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="SiteOverviewScreen">
        <ErrorCard
          title="Couldn't load site details"
          message="Please check your connection and try again."
          onRetry={() => {
            refetchSite();
            refetchDevices();
          }}
          testID="site-error"
        />
      </Screen>
    );
  }

  if (!siteData) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="SiteOverviewScreen">
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>
          {isOffline ? 'Site data unavailable offline' : 'Site not found'}
        </Text>
        <Text style={[typography.body, styles.muted]}>
          {isOffline ? 'Reconnect to refresh this site.' : 'The site you are looking for could not be found.'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="SiteOverviewScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="site-back-button"
          style={{ marginRight: spacing.sm }}
        />
        <IconButton icon={<Ionicons name="ellipsis-horizontal" size={20} color={colors.brandGrey} />} />
      </View>

      <Card style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Site</Text>
          <Text style={[typography.title1, styles.title]}>{siteData.name}</Text>
          <Text style={[typography.body, styles.muted]}>{siteData.city || 'Unknown location'}</Text>
          <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
            Last seen: {siteData.last_seen_at ? new Date(siteData.last_seen_at).toLocaleString() : 'Unknown'}
          </Text>
        </View>
        {renderStatusPill(siteData.status)}
      </Card>

      {isOffline ? (
        <Text style={[typography.caption, styles.muted, styles.offlineNote]}>Offline - showing last known data.</Text>
      ) : null}

      <Text style={[typography.subtitle, styles.sectionTitle]}>Devices</Text>
      <FlatList
        data={devicesData}
        keyExtractor={(item) => item.id}
        testID="device-list"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Card
            style={styles.deviceCard}
            testID="device-card"
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
          >
            <View style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Ionicons name="thermometer-outline" size={18} color={colors.brandGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, styles.title]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[typography.caption, styles.muted]}>{item.type}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {renderStatusPill(item.status)}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            message={isOffline ? 'Offline - no cached devices available yet.' : 'No devices available yet.'}
            testID="site-empty"
          />
        }
      />
    </Screen>
  );
};

const renderStatusPill = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  let backgroundColor: string = colors.backgroundAlt;
  let textColor: string = colors.textSecondary;
  let label = status || 'Unknown';

  if (normalized.includes('online') || normalized.includes('healthy')) {
    backgroundColor = colors.brandSoft;
    textColor = colors.success;
    label = 'Healthy';
  } else if (normalized.includes('critical')) {
    backgroundColor = colors.errorSoft;
    textColor = colors.error;
    label = 'Critical';
  } else if (normalized.includes('warn')) {
    backgroundColor = colors.warningSoft;
    textColor = colors.warning;
    label = 'Warning';
  } else if (normalized.includes('off')) {
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderLeftWidth: 4,
    borderColor: colors.brandGreen,
  },
  offlineNote: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginLeft: spacing.md,
  },
  deviceCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
