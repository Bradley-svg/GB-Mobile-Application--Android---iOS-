import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAcknowledgeAlert, useAlerts, useMuteAlert } from '../../api/hooks';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { Screen, Card, PrimaryButton, IconButton } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type AlertDetailRouteParams = RouteProp<AppStackParamList, 'AlertDetail'>;
type AlertDetailNavigation = NativeStackNavigationProp<AppStackParamList, 'AlertDetail'>;

export const AlertDetailScreen: React.FC = () => {
  const route = useRoute<AlertDetailRouteParams>();
  const alertId = route.params.alertId;
  const navigation = useNavigation<AlertDetailNavigation>();

  const { data: alerts, isLoading, isError } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const mute = useMuteAlert();
  const { isOffline } = useNetworkBanner();

  if (isLoading || !alerts) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading alert...</Text>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>Failed to load alert</Text>
        <Text style={[typography.body, styles.muted]}>Please try again.</Text>
      </Screen>
    );
  }

  const alertItem = alerts.find((a) => a.id === alertId);
  if (!alertItem) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="AlertDetailScreen">
        <Text style={[typography.body, styles.title]}>Alert not found</Text>
      </Screen>
    );
  }

  const onAcknowledge = async () => {
    if (isOffline) return;
    try {
      await acknowledge.mutateAsync(alertItem.id);
      Alert.alert('Acknowledged', 'Alert marked as acknowledged');
    } catch {
      Alert.alert('Error', 'Failed to acknowledge alert');
    }
  };

  const onMute = async () => {
    if (isOffline) return;
    try {
      await mute.mutateAsync({ alertId: alertItem.id, minutes: 60 });
      Alert.alert('Muted', 'Alert muted for 60 minutes');
    } catch {
      Alert.alert('Error', 'Failed to mute alert');
    }
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="AlertDetailScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="alert-back-button"
        />
      </View>

      <Card style={styles.headerCard}>
        {(() => {
          const severity = severityStyles(alertItem.severity);
          return (
            <View style={[styles.severityPill, { backgroundColor: severity.backgroundColor }]}>
              <Text style={[typography.label, { color: severity.textColor }]}>
                {alertItem.severity.toUpperCase()}
              </Text>
            </View>
          );
        })()}
        <Text style={[typography.title1, styles.title, { marginBottom: spacing.xs }]}>{alertItem.message}</Text>
        <Text style={[typography.caption, styles.muted, { marginBottom: spacing.sm }]} testID="alert-detail-meta">
          {alertItem.site_id ? `Site ${alertItem.site_id}` : 'No site'} |{' '}
          {alertItem.device_id ? `Device ${alertItem.device_id}` : 'No device'}
        </Text>
        <Text style={[typography.caption, styles.muted]}>
          {alertItem.type.toUpperCase()} - {alertItem.status.toUpperCase()}
        </Text>
      </Card>

      <Card style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>First seen</Text>
          <Text style={[typography.body, styles.title]}>{new Date(alertItem.first_seen_at).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Last seen</Text>
          <Text style={[typography.body, styles.title]}>{new Date(alertItem.last_seen_at).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Site</Text>
          <Text style={[typography.body, styles.title]}>{alertItem.site_id || '--'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Device</Text>
          <Text style={[typography.body, styles.title]}>{alertItem.device_id || '--'}</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          label={acknowledge.isPending ? 'Acknowledging...' : 'Acknowledge'}
          onPress={onAcknowledge}
          testID="acknowledge-button"
          disabled={acknowledge.isPending || isOffline}
        />
        <PrimaryButton
          label={mute.isPending ? 'Muting...' : 'Mute 60 minutes'}
          onPress={onMute}
          testID="mute-button"
          disabled={mute.isPending || isOffline}
          variant="outline"
          style={{ marginTop: spacing.sm }}
        />
        {isOffline ? (
          <Text style={[typography.caption, styles.offlineNote]}>
            Requires network connection to acknowledge or mute alerts.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
};

const severityStyles = (severity: string) => {
  switch (severity) {
    case 'critical':
      return { backgroundColor: colors.errorSoft, textColor: colors.error };
    case 'warning':
      return { backgroundColor: colors.warningSoft, textColor: colors.warning };
    default:
      return { backgroundColor: colors.brandGreenSoft, textColor: colors.brandGreenDark };
  }
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.brandText },
  muted: { color: colors.brandTextMuted },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.md,
  },
  severityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  detailCard: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  actions: {
    marginBottom: spacing.xl,
  },
  offlineNote: { color: colors.brandTextMuted, marginTop: spacing.sm },
});
