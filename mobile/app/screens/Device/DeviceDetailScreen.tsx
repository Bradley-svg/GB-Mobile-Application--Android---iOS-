import React, { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/RootNavigator';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceTelemetry,
  useModeCommand,
  useSetpointCommand,
  useSite,
} from '../../api/hooks';
import { Screen, Card, PillTab, PrimaryButton, IconButton } from '../../theme/components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;
type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const DeviceDetailScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { deviceId } = route.params;
  const [range, setRange] = useState<'24h' | '7d'>('24h');

  const { data: device, isLoading, isError } = useDevice(deviceId);
  const siteId = device?.site_id;
  const { data: site } = useSite(siteId || '');
  const { data: deviceAlerts } = useDeviceAlerts(deviceId);
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    isError: telemetryError,
  } = useDeviceTelemetry(deviceId, range);

  const setpointMutation = useSetpointCommand(deviceId);
  const modeMutation = useModeCommand(deviceId);

  const [setpointInput, setSetpointInput] = useState('45');
  const [selectedMode, setSelectedMode] = useState<'OFF' | 'HEATING' | 'COOLING' | 'AUTO'>(
    'HEATING'
  );

  const siteName = useMemo(() => site?.name || 'Unknown site', [site]);

  if (isLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading device...</Text>
      </Screen>
    );
  }

  if (isError || !device) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>Device not found</Text>
        <Text style={[typography.body, styles.muted]}>
          The device you are looking for could not be retrieved.
        </Text>
      </Screen>
    );
  }

  const supplyPoints = telemetry?.metrics['supply_temp'] || [];
  const returnPoints = telemetry?.metrics['return_temp'] || [];
  const powerPoints = telemetry?.metrics['power_kw'] || [];
  const flowPoints = telemetry?.metrics['flow_rate'] || [];
  const copPoints = telemetry?.metrics['cop'] || [];

  const activeDeviceAlerts = (deviceAlerts || []).filter((a) => a.status === 'active');

  const supplyData = supplyPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const returnData = returnPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const powerData = powerPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const flowData = flowPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const copData = copPoints.map((p, idx) => ({ x: idx, y: p.value }));
  const hasSupplyData = supplyData.length > 0;
  const hasReturnData = returnData.length > 0;
  const hasPowerData = powerData.length > 0;
  const hasFlowData = flowData.length > 0;
  const hasCopData = copData.length > 0;
  const emptyMetricPlaceholder = 'No data for this metric in the selected range.';
  const currentTemp = Math.round(supplyPoints[supplyPoints.length - 1]?.value ?? 20);

  const onSetpointSave = async () => {
    const value = Number(setpointInput);
    if (Number.isNaN(value)) {
      Alert.alert('Invalid value', 'Please enter a number');
      return;
    }

    try {
      await setpointMutation.mutateAsync(value);
      Alert.alert('Success', `Setpoint updated to ${value}C`);
    } catch {
      Alert.alert('Error', 'Failed to update setpoint');
    }
  };

  const onModeChange = async (mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') => {
    setSelectedMode(mode);
    try {
      await modeMutation.mutateAsync(mode);
      Alert.alert('Success', `Mode changed to ${mode}`);
    } catch {
      Alert.alert('Error', 'Failed to change mode');
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.dark} />}
          onPress={() => navigation.goBack()}
        />
        <IconButton icon={<Ionicons name="notifications-outline" size={20} color={colors.dark} />} />
      </View>

      <Card style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Device</Text>
          <Text style={[typography.title1, styles.title]}>{device.name}</Text>
          <Text style={[typography.body, styles.muted]}>{device.type}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
            {renderStatusPill(device.status)}
            <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]} numberOfLines={1}>
              {siteName}
            </Text>
          </View>
        </View>

        <View style={styles.dialWrapper}>
          <View style={styles.dialOuter}>
            <View style={styles.dialInner}>
              <Text style={[typography.title1, { color: colors.primary }]}>{`${currentTemp}\u00B0`}</Text>
              <Text style={[typography.caption, styles.muted]}>Supply</Text>
            </View>
          </View>
        </View>

        <View style={styles.powerColumn}>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Power</Text>
          <View style={styles.powerSwitch}>
            <View style={styles.powerThumb} />
          </View>
          <Ionicons name="power-outline" size={20} color={colors.primary} style={{ marginTop: spacing.xs }} />
        </View>
      </Card>

      <View style={styles.rangeTabs}>
        {(['24h', '7d'] as const).map((label) => (
          <View key={label} style={{ marginRight: spacing.sm }}>
            <PillTab label={label} selected={range === label} onPress={() => setRange(label)} />
          </View>
        ))}
      </View>

      {telemetryLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>Loading telemetry...</Text>
        </View>
      )}
      {telemetryError && !telemetryLoading ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          Failed to load telemetry.
        </Text>
      ) : null}

      {!telemetryLoading && !telemetryError && (
        <View>
          {renderMetricCard(
            'Flow temperatures (C)',
            colors.info,
            hasSupplyData || hasReturnData,
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLegend
                x={40}
                y={0}
                orientation="horizontal"
                gutter={20}
                data={[
                  { name: 'Supply', symbol: { fill: colors.primary } },
                  { name: 'Return', symbol: { fill: colors.warning } },
                ]}
              />
              <VictoryLine data={supplyData} style={{ data: { stroke: colors.primary } }} />
              <VictoryLine data={returnData} style={{ data: { stroke: colors.warning } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'Power (kW)',
            colors.primary,
            hasPowerData,
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={powerData} style={{ data: { stroke: colors.primary } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'Flow rate (L/s)',
            colors.info,
            hasFlowData,
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={flowData} style={{ data: { stroke: colors.info } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'COP',
            colors.warning,
            hasCopData,
            <VictoryChart>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={copData} style={{ data: { stroke: colors.warning } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}
        </View>
      )}

      <Card style={styles.controlCard}>
        <View style={styles.controlHeader}>
          <View>
            <Text style={[typography.subtitle, styles.title]}>Setpoint</Text>
            <Text style={[typography.caption, styles.muted]}>Safe range 30-60C</Text>
          </View>
          <Text style={[typography.title2, { color: colors.primary }]}>{`${setpointInput}\u00B0C`}</Text>
        </View>
        <TextInput
          value={setpointInput}
          onChangeText={setSetpointInput}
          keyboardType="numeric"
          style={styles.input}
        />
        <PrimaryButton
          label={setpointMutation.isPending ? 'Updating...' : 'Update setpoint'}
          onPress={onSetpointSave}
          disabled={setpointMutation.isPending}
        />
      </Card>

      <Card style={styles.modeCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Mode</Text>
        <View style={styles.modeRow}>
          {(['OFF', 'HEATING', 'COOLING', 'AUTO'] as const).map((mode) => {
            const selected = selectedMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeChip,
                  selected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surfaceMuted },
                ]}
                onPress={() => onModeChange(mode)}
                activeOpacity={0.9}
                disabled={modeMutation.isPending}
              >
                <Text
                  style={[
                    typography.subtitle,
                    { color: selected ? colors.white : colors.textSecondary, textAlign: 'center' },
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {activeDeviceAlerts.length > 0 && (
        <Card style={styles.alertCard}>
          <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Active alerts</Text>
          {activeDeviceAlerts.map((a) => (
            <View key={a.id} style={styles.alertRow}>
              <View style={[styles.alertDot, { backgroundColor: severityColor(a.severity) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, styles.title]}>{a.message}</Text>
                <Text style={[typography.caption, styles.muted]}>
                  {a.severity.toUpperCase()} - {new Date(a.last_seen_at).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
};

const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return colors.danger;
    case 'warning':
      return colors.warning;
    default:
      return colors.info;
  }
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

const renderMetricCard = (
  title: string,
  accent: string,
  hasData: boolean,
  chart: React.ReactNode,
  emptyText: string
) => (
  <Card style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <View style={[styles.metricDot, { backgroundColor: accent }]} />
      <Text style={[typography.subtitle, styles.title]}>{title}</Text>
    </View>
    {hasData ? (
      <View>{chart}</View>
    ) : (
      <Text style={[typography.caption, styles.muted, { textAlign: 'center', marginTop: spacing.md }]}>
        {emptyText}
      </Text>
    )}
  </Card>
);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  dialWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  dialOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 10,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  dialInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerColumn: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  powerSwitch: {
    width: 24,
    height: 90,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    justifyContent: 'flex-start',
    padding: spacing.xs,
  },
  powerThumb: {
    width: 20,
    height: 28,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  rangeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metricCard: {
    marginBottom: spacing.md,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  controlCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  modeCard: {
    marginBottom: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertCard: {
    marginBottom: spacing.xl,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
});
