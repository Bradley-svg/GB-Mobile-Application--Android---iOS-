import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useDevices, useSite } from '../../api/hooks';
import { Screen, Card, IconButton, ErrorCard, EmptyState } from '../../components';
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

  if (siteLoading || devicesLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading site...</Text>
      </Screen>
    );
  }

  if (siteError || devicesError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
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

  if (!site) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>Site not found</Text>
        <Text style={[typography.body, styles.muted]}>
          The site you are looking for could not be found.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.dark} />}
          onPress={() => navigation.goBack()}
          style={{ marginRight: spacing.sm }}
        />
        <IconButton icon={<Ionicons name="ellipsis-horizontal" size={20} color={colors.dark} />} />
      </View>

      <Card style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Site</Text>
          <Text style={[typography.title1, styles.title]}>{site.name}</Text>
          <Text style={[typography.body, styles.muted]}>{site.city || 'Unknown location'}</Text>
          <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
            Last seen: {site.last_seen_at ? new Date(site.last_seen_at).toLocaleString() : 'Unknown'}
          </Text>
        </View>
        {renderStatusPill(site.status)}
      </Card>

      <Text style={[typography.subtitle, styles.sectionTitle]}>Devices</Text>
      <FlatList
        data={devices || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Card
            style={styles.deviceCard}
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
          >
            <View style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Ionicons name="thermometer-outline" size={18} color={colors.primary} />
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
                  color={colors.textMuted}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No devices available yet." testID="site-empty" />}
      />
    </Screen>
  );
};

const renderStatusPill = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  let backgroundColor = colors.surfaceMuted;
  let textColor = colors.textSecondary;
  let label = status || 'Unknown';

  if (normalized.includes('online') || normalized.includes('healthy')) {
    backgroundColor = colors.primarySoft;
    textColor = colors.success;
    label = 'Healthy';
  } else if (normalized.includes('warn')) {
    backgroundColor = '#FFF5E6';
    textColor = colors.warning;
    label = 'Warning';
  } else if (normalized.includes('off')) {
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
  },
  sectionTitle: {
    marginBottom: spacing.md,
    color: colors.dark,
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
