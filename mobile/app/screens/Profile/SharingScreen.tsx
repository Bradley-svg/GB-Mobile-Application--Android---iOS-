import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSites, useDevices } from '../../api/hooks';
import { Screen, Card, StatusPill, EmptyState, connectivityDisplay, healthDisplay } from '../../components';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/types';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { isAdminOrOwner, isFacilities, useAuthStore } from '../../store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const SharingScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const userRole = useAuthStore((s) => s.user?.role ?? null);
  const canShare = isAdminOrOwner(userRole) || isFacilities(userRole);
  const { data: sites = [], isLoading: sitesLoading } = useSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || sites[0],
    [selectedSiteId, sites]
  );
  const { data: devices = [], isLoading: devicesLoading } = useDevices(selectedSite?.id || '');
  const { isOffline } = useNetworkBanner();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors, spacing, typography } = theme;

  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  if (!canShare) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="SharingScreen">
        <Card style={[styles.infoCard, { maxWidth: 420 }]}>
          <Text style={[typography.title2, styles.title]}>Sharing unavailable</Text>
          <Text style={[typography.body, styles.muted, { marginTop: spacing.xs }]}>
            Read-only access for your role. Contact an owner or admin for access to manage share links.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="SharingScreen">
      <ScrollView>
        <Card style={styles.infoCard}>
          <Text style={[typography.title2, styles.title]}>Sharing & access</Text>
          <Text style={[typography.body, styles.muted, { marginTop: spacing.xs }]}>
            Create read-only links for clients or contractors to view sites and devices without signing in.
          </Text>
          {isOffline ? (
            <Text style={[typography.caption, styles.warning]}>
              Offline - sharing actions are disabled until you reconnect.
            </Text>
          ) : null}
        </Card>

        <Text style={[typography.subtitle, styles.sectionTitle]}>Sites</Text>
        {sitesLoading && sites.length === 0 ? (
          <Text style={[typography.caption, styles.muted, styles.sectionPadding]}>Loading sites...</Text>
        ) : null}
        {sites.map((site) => (
          <Card key={site.id} style={styles.rowCard} testID="sharing-site-row">
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, styles.title]}>{site.name}</Text>
              <Text style={[typography.caption, styles.muted]}>
                {site.city || 'Unknown location'} - {site.device_count ?? 0} devices
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ShareLinks', { scope: 'site', id: site.id, name: site.name })
              }
              disabled={isOffline}
              style={[
                styles.manageButton,
                isOffline ? styles.manageButtonDisabled : styles.manageButtonEnabled,
              ]}
              testID="manage-site-share"
            >
              <Ionicons name="link-outline" size={16} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white, marginLeft: spacing.xs }]}>
                Manage
              </Text>
            </TouchableOpacity>
          </Card>
        ))}

        <Text style={[typography.subtitle, styles.sectionTitle]}>
          Devices {selectedSite ? `(${selectedSite.name})` : ''}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.siteChips}>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.id}
              onPress={() => setSelectedSiteId(site.id)}
              style={[
                styles.chip,
                selectedSite?.id === site.id ? styles.chipActive : styles.chipInactive,
              ]}
              disabled={isOffline}
            >
              <Text
                style={[
                  typography.caption,
                  { color: selectedSite?.id === site.id ? colors.white : colors.textSecondary },
                ]}
              >
                {site.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {devicesLoading && devices.length === 0 ? (
          <Text style={[typography.caption, styles.muted, styles.sectionPadding]}>
            Loading devices...
          </Text>
        ) : null}

        {devices.length === 0 ? (
          <EmptyState
            message={
              isOffline
                ? 'Offline - device list unavailable.'
                : 'No devices found for this site yet.'
            }
            testID="sharing-devices-empty"
          />
        ) : (
          devices.map((device) => (
            <Card key={device.id} style={styles.rowCard} testID="sharing-device-row">
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, styles.title]}>{device.name}</Text>
                <Text style={[typography.caption, styles.muted]} numberOfLines={1}>
                  {device.type}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                  <StatusPill
                    label={connectivityDisplay(device.connectivity_status || device.status).label}
                    tone={connectivityDisplay(device.connectivity_status || device.status).tone}
                  />
                  <StatusPill
                    label={healthDisplay(device.health || device.status).label}
                    tone={healthDisplay(device.health || device.status).tone}
                    style={{ marginLeft: spacing.xs }}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('ShareLinks', {
                    scope: 'device',
                    id: device.id,
                    name: device.name,
                  })
                }
                disabled={isOffline}
                style={[
                  styles.manageButton,
                  isOffline ? styles.manageButtonDisabled : styles.manageButtonEnabled,
                ]}
                testID="manage-device-share"
              >
                <Ionicons name="share-social-outline" size={16} color={colors.white} />
                <Text style={[typography.caption, { color: colors.white, marginLeft: spacing.xs }]}>
                  Manage
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoCard: {
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
      padding: spacing.lg,
    },
    title: { color: colors.textPrimary },
    muted: { color: colors.textSecondary },
    warning: { color: colors.warning, marginTop: spacing.sm },
    sectionTitle: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      color: colors.textPrimary,
    },
    sectionPadding: { paddingHorizontal: spacing.lg },
    rowCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
    },
    manageButtonEnabled: {
      backgroundColor: colors.brandGreen,
    },
    manageButtonDisabled: {
      backgroundColor: colors.borderSubtle,
    },
    siteChips: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      marginRight: spacing.sm,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: colors.brandGreen,
      borderColor: colors.brandGreen,
    },
    chipInactive: {
      backgroundColor: colors.backgroundAlt,
      borderColor: colors.borderSubtle,
    },
  });
};
