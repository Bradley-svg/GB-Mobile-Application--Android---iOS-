import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevices, useSite } from '../../api/hooks';
import type { ApiDevice, ApiSite, HealthStatus } from '../../api/types';
import {
  Screen,
  Card,
  IconButton,
  ErrorCard,
  EmptyState,
  StatusPill,
  connectivityDisplay,
  healthDisplay,
} from '../../components';
import { fetchSiteDevicesCsv } from '../../api/exports';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'SiteOverview'>;
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

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
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [exportingDevices, setExportingDevices] = useState(false);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing, typography } = theme;

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
        loadJsonWithMetadata<ApiSite>(`site:${siteId}`),
        loadJsonWithMetadata<ApiDevice[]>(`siteDevices:${siteId}`),
      ]);
      if (!cancelled) {
        setCachedSite(siteCache?.data ?? null);
        setCachedDevices(deviceCache?.data ?? null);
        setCachedAt(siteCache?.savedAt || deviceCache?.savedAt || null);
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
  const cacheStale = isCacheOlderThan(cachedAt, CACHE_STALE_MS);
  const cacheUpdatedLabel = cachedAt ? new Date(cachedAt).toLocaleString() : null;
  const showLoading = (siteLoading || devicesLoading) && !hasCachedData;
  const shouldShowError = (siteError || devicesError) && !isOffline && !hasCachedData;

  const onExportDevices = async () => {
    if (isOffline || exportingDevices) return;
    setExportingDevices(true);
    try {
      const csv = await fetchSiteDevicesCsv(siteId);
      const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to export devices', err);
      Alert.alert('Export failed', 'Could not export devices right now.');
    } finally {
      setExportingDevices(false);
    }
  };

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

  const siteHealthPill = healthDisplay((siteData.health as HealthStatus) || siteData.status);
  const siteConnectivityPill = connectivityDisplay(siteData.status);

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
            Last seen:{' '}
            {siteData.last_seen?.at
              ? new Date(siteData.last_seen.at).toLocaleString()
              : siteData.last_seen_at
              ? new Date(siteData.last_seen_at).toLocaleString()
              : 'Unknown'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.pillRow}>
            <StatusPill label={siteHealthPill.label} tone={siteHealthPill.tone} />
            <StatusPill
              label={siteConnectivityPill.label}
              tone={siteConnectivityPill.tone}
              style={{ marginLeft: spacing.xs }}
              testID="site-connectivity-pill"
            />
          </View>
          {!isOffline ? (
            <TouchableOpacity
              onPress={onExportDevices}
              disabled={exportingDevices}
              style={[styles.exportButton, exportingDevices ? styles.exportButtonDisabled : null]}
              testID="export-devices-button"
            >
              <Ionicons name="download-outline" size={16} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white, marginLeft: spacing.xs }]}>
                {exportingDevices ? 'Preparing...' : 'Export devices'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>

      <Card
        style={styles.quickLinkCard}
        onPress={() => navigation.navigate('Documents', { scope: 'site', siteId })}
        testID="site-documents-link"
      >
        <View style={styles.quickLinkRow}>
          <View style={styles.quickLinkIcon}>
            <Ionicons name="document-text-outline" size={18} color={colors.brandGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.subtitle, styles.title]}>Documents</Text>
            <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
              Manuals and schematics for this site.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </Card>

      {isOffline ? (
        <Text style={[typography.caption, styles.muted, styles.offlineNote]}>
          Offline - showing last known data.
        </Text>
      ) : null}
      {cacheStale ? (
        <Text style={[typography.caption, styles.staleNote]}>
          Data older than 24 hours – may be out of date{cacheUpdatedLabel ? ` (cached ${cacheUpdatedLabel})` : ''}.
        </Text>
      ) : null}

      <Text style={[typography.subtitle, styles.sectionTitle]}>Devices</Text>
      <FlatList
        data={devicesData}
        keyExtractor={(item) => item.id}
        testID="device-list"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => {
          const deviceHealth = healthDisplay((item.health as HealthStatus) || item.status);
          const connectivity = connectivityDisplay(item.connectivity_status || item.status);
          return (
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
                  <Text style={[typography.caption, styles.muted]}>
                    Last seen:{' '}
                    {item.last_seen?.at
                      ? new Date(item.last_seen.at).toLocaleString()
                      : item.last_seen_at
                      ? new Date(item.last_seen_at).toLocaleString()
                      : 'Unknown'}
                  </Text>
                  {item.firmware_version ? (
                    <Text style={[typography.caption, styles.muted]}>FW {item.firmware_version}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={styles.pillRow}>
                    <StatusPill
                      label={connectivity.label}
                      tone={connectivity.tone}
                      testID="device-connectivity-pill"
                    />
                    <StatusPill
                      label={deviceHealth.label}
                      tone={deviceHealth.tone}
                      style={{ marginLeft: spacing.xs }}
                    />
                  </View>
                  <View style={styles.quickActions}>
                    <IconButton
                      icon={<Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                      onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
                      testID="device-action-detail"
                    />
                  <IconButton
                    icon={<Ionicons name="alert-circle-outline" size={18} color={colors.textSecondary} />}
                    onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' } as never)}
                    testID="device-action-alerts"
                  />
                </View>
              </View>
            </View>
            </Card>
          );
        }}
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

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
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
    staleNote: {
      color: colors.warning,
      marginBottom: spacing.md,
    },
    quickLinkCard: {
      marginBottom: spacing.md,
      padding: spacing.lg,
    },
    quickLinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickLinkIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    sectionTitle: {
      marginBottom: spacing.md,
      color: colors.textPrimary,
    },
    pillRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.brandGreen,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      marginTop: spacing.sm,
    },
    exportButtonDisabled: {
      backgroundColor: colors.borderSubtle,
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
    quickActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
  });
};
