import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { View, Text, ActivityIndicator, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
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
import { Screen, Card, PillTab, PrimaryButton, IconButton } from '../../components';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;
type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SETPOINT_MIN = 30;
const SETPOINT_MAX = 60;
const DEFAULT_SETPOINT = '45';

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { deviceId } = route.params;
  const navigation = useNavigation<Navigation>();
  const [range, setRange] = useState<'24h' | '7d'>('24h');

  const [setpointInput, setSetpointInput] = useState(DEFAULT_SETPOINT);
  const [lastSetpoint, setLastSetpoint] = useState(DEFAULT_SETPOINT);
  const [setpointError, setSetpointError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'OFF' | 'HEATING' | 'COOLING' | 'AUTO'>(
    'HEATING'
  );

  const deviceQuery = useDevice(deviceId);
  const siteId = deviceQuery.data?.site_id;
  const siteQuery = useSite(siteId || '');
  const alertsQuery = useDeviceAlerts(deviceId);
  const telemetryQuery = useDeviceTelemetry(deviceId, range);
  const setpointMutation = useSetpointCommand(deviceId);
  const modeMutation = useModeCommand(deviceId);
  const refetchTelemetry = telemetryQuery.refetch;

  const siteName = useMemo(() => siteQuery.data?.name || 'Unknown site', [siteQuery.data]);
  const activeDeviceAlerts = useMemo(
    () => (alertsQuery.data || []).filter((a) => a.status === 'active'),
    [alertsQuery.data]
  );

  const supplyPoints = telemetryQuery.data?.metrics['supply_temp'] || [];
  const returnPoints = telemetryQuery.data?.metrics['return_temp'] || [];
  const powerPoints = telemetryQuery.data?.metrics['power_kw'] || [];
  const flowPoints = telemetryQuery.data?.metrics['flow_rate'] || [];
  const copPoints = telemetryQuery.data?.metrics['cop'] || [];
  const currentTemp = Math.round(supplyPoints[supplyPoints.length - 1]?.value ?? 20);

  const toSeries = (points: typeof supplyPoints) =>
    points.map((p) => ({ x: new Date(p.ts), y: p.value }));

  const supplyData = toSeries(supplyPoints);
  const returnData = toSeries(returnPoints);
  const powerData = toSeries(powerPoints);
  const flowData = toSeries(flowPoints);
  const copData = toSeries(copPoints);
  const lastUpdatedAt = useMemo(() => {
    const metrics = telemetryQuery.data?.metrics;
    if (!metrics) return null;

    const timestamps = Object.values(metrics).reduce<number[]>((acc, points) => {
      points.forEach((p) => {
        const ts = new Date(p.ts).getTime();
        if (!Number.isNaN(ts)) {
          acc.push(ts);
        }
      });
      return acc;
    }, []);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [telemetryQuery.data]);

  const xTickCount = range === '7d' ? 5 : 6;
  const formatAxisTick = useMemo(
    () => (value: Date | number) => {
      const date = typeof value === 'number' ? new Date(value) : value;
      if (Number.isNaN(date.getTime())) return '';

      if (range === '7d') {
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }

      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      return `${hours}:${minutes}`;
    },
    [range]
  );

  const isLoading = deviceQuery.isLoading;
  const deviceNotFound = (deviceQuery.isError || !deviceQuery.data) && !deviceQuery.isLoading;
  const telemetryLoading = telemetryQuery.isLoading;
  const telemetryError = telemetryQuery.isError;

  if (isLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading device...</Text>
      </Screen>
    );
  }

  if (deviceNotFound) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>Device not found</Text>
        <Text style={[typography.body, styles.muted]}>
          The device you are looking for could not be retrieved.
        </Text>
      </Screen>
    );
  }

  const device = deviceQuery.data!;

  const hasSupplyData = supplyData.length > 0;
  const hasReturnData = returnData.length > 0;
  const hasPowerData = powerData.length > 0;
  const hasFlowData = flowData.length > 0;
  const hasCopData = copData.length > 0;
  const emptyMetricPlaceholder = 'No data for this metric in the selected range.';

  const onSetpointSave = async () => {
    const value = Number(setpointInput);
    if (Number.isNaN(value)) {
      setSetpointError('Please enter a number');
      return;
    }

    if (value < SETPOINT_MIN || value > SETPOINT_MAX) {
      setSetpointError(
        `Flow temperature must be between ${SETPOINT_MIN}-${SETPOINT_MAX}\u00B0C`
      );
      return;
    }

    setSetpointError(null);
    setCommandError(null);
    const previousValue = lastSetpoint;

    try {
      await setpointMutation.mutateAsync(value);
      const nextValue = value.toString();
      setLastSetpoint(nextValue);
      setSetpointInput(nextValue);
    } catch (err) {
      setSetpointInput(previousValue);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? 'Failed to update setpoint'
        : 'Failed to update setpoint';
      setCommandError(message);
    }
  };

  const onModeChange = async (mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') => {
    const previousMode = selectedMode;
    setSelectedMode(mode);
    setCommandError(null);
    try {
      await modeMutation.mutateAsync(mode);
    } catch (err) {
      setSelectedMode(previousMode);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? 'Failed to change mode'
        : 'Failed to change mode';
      setCommandError(message);
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
          <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
            {lastUpdatedAt
              ? `Last updated at ${new Date(lastUpdatedAt).toLocaleString()}`
              : 'No telemetry yet'}
          </Text>
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
        <Card style={styles.errorCard}>
          <Text style={[typography.caption, styles.title, { marginBottom: spacing.sm }]}>
            Failed to load telemetry.
          </Text>
          <PrimaryButton label="Retry" onPress={() => refetchTelemetry()} />
        </Card>
      ) : null}

      {!telemetryLoading && !telemetryError && (
        <View>
          {renderMetricCard(
            'Flow temperatures (C)',
            colors.info,
            hasSupplyData || hasReturnData,
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
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
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={powerData} style={{ data: { stroke: colors.primary } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'Flow rate (L/s)',
            colors.info,
            hasFlowData,
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={flowData} style={{ data: { stroke: colors.info } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'COP',
            colors.warning,
            hasCopData,
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
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
          <Text style={[typography.title2, { color: colors.primary }]}>{`${lastSetpoint}\u00B0C`}</Text>
        </View>
        <TextInput
          testID="setpoint-input"
          value={setpointInput}
          onChangeText={(text) => {
            setSetpointInput(text);
            setSetpointError(null);
            setCommandError(null);
          }}
          keyboardType="numeric"
          style={styles.input}
        />
        {setpointError ? (
          <Text style={[typography.caption, styles.errorText]}>{setpointError}</Text>
        ) : null}
        <PrimaryButton
          label={setpointMutation.isPending ? 'Updating...' : 'Update setpoint'}
          onPress={onSetpointSave}
          disabled={setpointMutation.isPending}
        />
      </Card>

      {commandError ? (
        <View style={styles.commandError}>
          <Text style={[typography.caption, styles.errorText]}>{commandError}</Text>
        </View>
      ) : null}

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
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  commandError: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#FFE8E6',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
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
