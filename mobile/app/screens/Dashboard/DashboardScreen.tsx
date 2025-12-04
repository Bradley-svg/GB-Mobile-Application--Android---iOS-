import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts, useSites } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, IconButton, ErrorCard, EmptyState } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { data, isLoading, isError, refetch } = useSites();
  const { data: alerts } = useAlerts({ status: 'active' });

  const metrics = useMemo(() => {
    const totalSites = data?.length ?? 0;
    const onlineDevices = (data || []).reduce((acc, site) => {
      const onlineCount = site.online_devices ?? site.device_count_online ?? 0;
      return acc + onlineCount;
    }, 0);
    return [
      { label: 'Sites', value: totalSites },
      { label: 'Online devices', value: onlineDevices },
      { label: 'Active alerts', value: alerts?.length ?? 0, color: colors.danger },
    ];
  }, [alerts?.length, data]);

  if (isLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading sites...</Text>
      </Screen>
    );
  }

  if (isError) {
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

  if (!isLoading && !isError && (data?.length ?? 0) === 0) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <EmptyState message="No sites available yet." testID="dashboard-empty" />
      </Screen>
    );
  }

  return (
    <Screen>
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
      <View style={styles.grid}>
        {(data || []).map((item) => (
          <Card
            key={item.id}
            style={styles.siteCard}
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
        ))}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
