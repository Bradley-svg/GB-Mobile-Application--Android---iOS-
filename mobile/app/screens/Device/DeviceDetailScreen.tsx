import React, { useEffect, useMemo, useState } from 'react';
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
  useHeatPumpHistory,
} from '../../api/hooks';
import type {
  ApiDevice,
  ControlFailureReason,
  DeviceTelemetry,
  HeatPumpHistoryRequest,
  TimeRange,
} from '../../api/types';
import type { HeatPumpHistoryError } from '../../api/heatPumpHistory/hooks';
import { Screen, Card, PrimaryButton, IconButton, ErrorCard, PillTabGroup } from '../../components';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';

type Route = RouteProp<AppStackParamList, 'DeviceDetail'>;
type Navigation = NativeStackNavigationProp<AppStackParamList>;

const SETPOINT_MIN = 30;
const SETPOINT_MAX = 60;
const DEFAULT_SETPOINT = '45';
const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const DEVICE_CACHE_KEY = (deviceId: string) => `device-cache:${deviceId}`;
const RANGE_TO_WINDOW_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

type CachedDeviceDetail = {
  device: ApiDevice;
  telemetry: DeviceTelemetry;
  lastUpdatedAt: string | null;
  cachedAt: string;
};

type HistoryStatus =
  | 'ok'
  | 'noData'
  | 'circuitOpen'
  | 'upstreamError'
  | 'otherError'
  | 'offline'
  | 'disabled';
type CommandDisabledReason = 'offline' | 'deviceOffline' | 'unconfigured' | null;

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { deviceId } = route.params;
  const navigation = useNavigation<Navigation>();
  const [range, setRange] = useState<TimeRange>('24h');
  const [cachedDeviceDetail, setCachedDeviceDetail] = useState<CachedDeviceDetail | null>(null);
  const [cachedSavedAt, setCachedSavedAt] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);

  const [setpointInput, setSetpointInput] = useState(DEFAULT_SETPOINT);
  const [lastSetpoint, setLastSetpoint] = useState(DEFAULT_SETPOINT);
  const [setpointError, setSetpointError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'OFF' | 'HEATING' | 'COOLING' | 'AUTO'>(
    'HEATING'
  );
  const [isSetpointPending, setIsSetpointPending] = useState(false);
  const [isModePending, setIsModePending] = useState(false);

  const deviceQuery = useDevice(deviceId);
  const siteId = deviceQuery.data?.site_id ?? cachedDeviceDetail?.device.site_id;
  const siteQuery = useSite(siteId || '');
  const alertsQuery = useDeviceAlerts(deviceId);
  const telemetryQuery = useDeviceTelemetry(deviceId, range);
  const setpointMutation = useSetpointCommand(deviceId);
  const modeMutation = useModeCommand(deviceId);
  const setpointPending = isSetpointPending || setpointMutation.isPending;
  const modePending = isModePending || modeMutation.isPending;
  const refetchTelemetry = telemetryQuery.refetch;
  const mac = deviceQuery.data?.mac ?? cachedDeviceDetail?.device.mac ?? null;
  const { isOffline } = useNetworkBanner();

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;
    setCacheLoading(true);

    const loadCache = async () => {
      const cached = await loadJsonWithMetadata<CachedDeviceDetail>(DEVICE_CACHE_KEY(deviceId));
      if (!cancelled) {
        setCachedDeviceDetail(cached?.data ?? null);
        setCachedSavedAt(cached?.savedAt ?? cached?.data?.cachedAt ?? null);
        setCacheLoading(false);
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [deviceId, isOffline]);

  const historyWindow = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - RANGE_TO_WINDOW_MS[range]);
    return {
      from: fromDate.toISOString(),
      to: now.toISOString(),
    };
  }, [range]);

  const historyRequest: HeatPumpHistoryRequest | null = useMemo(() => {
    if (!mac) return null;
    return {
      mac,
      from: historyWindow.from,
      to: historyWindow.to,
      aggregation: 'raw',
      mode: 'live',
      fields: [
        {
          field: 'metric_compCurrentA',
          unit: 'A',
          decimals: 1,
          displayName: 'Compressor current',
          propertyName: '',
        },
      ],
    };
  }, [historyWindow.from, historyWindow.to, mac]);

  const heatPumpHistoryQuery = useHeatPumpHistory(
    historyRequest ?? {
      mac: '',
      from: historyWindow.from,
      to: historyWindow.to,
      aggregation: 'raw',
      mode: 'live',
      fields: [],
    },
    {
      enabled: !!historyRequest && !isOffline,
    }
  );
  const refetchHistory = heatPumpHistoryQuery.refetch;

  const device = deviceQuery.data ?? cachedDeviceDetail?.device ?? null;
  const telemetryFromQuery = telemetryQuery.data;
  const telemetryData = telemetryFromQuery ?? cachedDeviceDetail?.telemetry ?? null;
  const siteName = useMemo(() => siteQuery.data?.name || 'Unknown site', [siteQuery.data]);
  const activeDeviceAlerts = useMemo(
    () => (alertsQuery.data || []).filter((a) => a.status === 'active'),
    [alertsQuery.data]
  );

  const supplyPoints = telemetryData?.metrics['supply_temp'] || [];
  const returnPoints = telemetryData?.metrics['return_temp'] || [];
  const powerPoints = telemetryData?.metrics['power_kw'] || [];
  const flowPoints = telemetryData?.metrics['flow_rate'] || [];
  const copPoints = telemetryData?.metrics['cop'] || [];
  const currentTemp = Math.round(supplyPoints[supplyPoints.length - 1]?.value ?? 20);

  const toSeries = (points: typeof supplyPoints) =>
    points.map((p) => ({ x: new Date(p.ts), y: p.value }));

  const supplyData = toSeries(supplyPoints);
  const returnData = toSeries(returnPoints);
  const powerData = toSeries(powerPoints);
  const flowData = toSeries(flowPoints);
  const copData = toSeries(copPoints);
  const lastUpdatedAt = useMemo(() => computeLastUpdatedAt(telemetryData), [telemetryData]);
  const liveLastUpdatedAt = useMemo(
    () => computeLastUpdatedAt(telemetryFromQuery),
    [telemetryFromQuery]
  );
  const hasAnyTelemetryPoints = useMemo(() => {
    const metrics = telemetryData?.metrics;
    if (!metrics) return false;
    return Object.values(metrics).some((points) => points.length > 0);
  }, [telemetryData]);
  const hasAnyHistoryPoints = useMemo(() => {
    const series = heatPumpHistoryQuery.data?.series ?? [];
    return series.some((s) => (s.points ?? []).length > 0);
  }, [heatPumpHistoryQuery.data]);
  const isStale = useMemo(() => {
    if (!lastUpdatedAt) return false;
    const ts = new Date(lastUpdatedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts > STALE_THRESHOLD_MS;
  }, [lastUpdatedAt]);
  const deviceStatus = (device?.status || '').toLowerCase();
  const isDeviceOffline = deviceStatus.includes('off') || deviceStatus.includes('down');
  const isControlConfigured = Boolean(device?.external_id);
  const commandsDisabledReason: CommandDisabledReason = isOffline
    ? 'offline'
    : isDeviceOffline
    ? 'deviceOffline'
    : !isControlConfigured
    ? 'unconfigured'
    : null;

  useEffect(() => {
    if (isOffline) return;
    if (!deviceQuery.data || !telemetryFromQuery) return;

    const snapshot: CachedDeviceDetail = {
      device: deviceQuery.data,
      telemetry: telemetryFromQuery,
      lastUpdatedAt: liveLastUpdatedAt,
      cachedAt: new Date().toISOString(),
    };
    setCachedDeviceDetail(snapshot);
    saveJson(DEVICE_CACHE_KEY(deviceId), snapshot);
  }, [deviceId, deviceQuery.data, telemetryFromQuery, isOffline, liveLastUpdatedAt]);

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

  const heatPumpSeries = useMemo(() => {
    const data = heatPumpHistoryQuery.data;
    if (!data || !data.series || data.series.length === 0) return [];

    const firstSeries = data.series[0];
    return firstSeries.points
      .filter((p) => p.value !== null)
      .map((p) => ({
        x: new Date(p.timestamp),
        y: p.value as number,
      }));
  }, [heatPumpHistoryQuery.data]);

  const historyErrorObj = heatPumpHistoryQuery.error;
  const historyStatus = useMemo<HistoryStatus>(() => {
    if (isOffline) return 'offline';
    if (!historyRequest) return 'disabled';
    if (heatPumpHistoryQuery.isError) {
      return deriveHistoryStatus(historyErrorObj as HeatPumpHistoryError | undefined);
    }
    if (!heatPumpHistoryQuery.isLoading && heatPumpSeries.length === 0) {
      return 'noData';
    }
    return 'ok';
  }, [
    heatPumpHistoryQuery.isError,
    heatPumpHistoryQuery.isLoading,
    heatPumpSeries.length,
    historyErrorObj,
    historyRequest,
    isOffline,
  ]);
  const showLoading = (deviceQuery.isLoading || cacheLoading) && !device;
  const deviceNotFound = !device && !showLoading;
  const telemetryLoading = telemetryQuery.isLoading && !telemetryData;
  const telemetryError = telemetryQuery.isError && !telemetryLoading && !telemetryData;
  const telemetryErrorObj = telemetryQuery.error;
  const telemetryOfflineEmpty = isOffline && !telemetryData && !telemetryLoading;
  const historyErrorMessage =
    mapHistoryError(historyStatus) || 'Failed to load history. Try again or contact support.';
  const isOfflineWithCache = isOffline && !!cachedDeviceDetail;
  const showUnknownLastUpdated = !lastUpdatedAt && (hasAnyTelemetryPoints || hasAnyHistoryPoints);
  const cacheStale = isCacheOlderThan(cachedSavedAt ?? cachedDeviceDetail?.cachedAt ?? null, CACHE_STALE_MS);

  if (__DEV__) {
    if (telemetryErrorObj) console.log('Telemetry load error', telemetryErrorObj);
    if (historyErrorObj) console.log('Heat pump history load error', historyErrorObj);
  }

  if (showLoading) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DeviceDetailScreen">
        <ActivityIndicator size="large" color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading device...</Text>
      </Screen>
    );
  }

  if (deviceNotFound) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DeviceDetailScreen">
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]}>
          {isOffline ? 'Offline and no cached data for this device.' : 'Device not found'}
        </Text>
        <Text style={[typography.body, styles.muted]}>
          {isOffline
            ? 'Reconnect to refresh this device.'
            : 'The device you are looking for could not be retrieved.'}
        </Text>
      </Screen>
    );
  }

  if (!device) return null;

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
    if (commandsDisabledReason) {
      setCommandError(mapControlDisabledMessage(commandsDisabledReason));
      return;
    }
    const previousValue = lastSetpoint;

    try {
      setIsSetpointPending(true);
      await setpointMutation.mutateAsync(value);
      const nextValue = value.toString();
      setLastSetpoint(nextValue);
      setSetpointInput(nextValue);
    } catch (err) {
      setSetpointInput(previousValue);
      const failureReason = axios.isAxiosError(err) ? err.response?.data?.failure_reason : undefined;
      const backendMessage = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.response?.data?.error
        : undefined;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = mapControlFailureReason(failureReason, backendMessage, status);
      setCommandError(message);
    } finally {
      setIsSetpointPending(false);
    }
  };

  const onModeChange = async (mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') => {
    if (commandsDisabledReason) {
      setCommandError(mapControlDisabledMessage(commandsDisabledReason));
      return;
    }
    const previousMode = selectedMode;
    setSelectedMode(mode);
    setCommandError(null);
    try {
      setIsModePending(true);
      await modeMutation.mutateAsync(mode);
    } catch (err) {
      setSelectedMode(previousMode);
      const failureReason = axios.isAxiosError(err) ? err.response?.data?.failure_reason : undefined;
      const backendMessage = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.response?.data?.error
        : undefined;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = mapControlFailureReason(failureReason, backendMessage, status);
      setCommandError(message);
    } finally {
      setIsModePending(false);
    }
  };

  return (
    <Screen testID="DeviceDetailScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="device-back-button"
        />
        <IconButton icon={<Ionicons name="notifications-outline" size={20} color={colors.brandGrey} />} />
      </View>

      <Card style={styles.headerCard} accented>
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
          {isStale ? (
            <Text style={[typography.caption, styles.staleText]}>
              Data is older than 15 minutes. Values may not reflect current site conditions.
            </Text>
          ) : null}
          {showUnknownLastUpdated ? (
            <Text style={[typography.caption, styles.staleText]}>
              Last updated time unavailable - data may be stale.
            </Text>
          ) : null}
        </View>

        <View style={styles.dialWrapper}>
          <View style={styles.dialOuter}>
            <View style={styles.dialInner}>
              <Text style={[typography.title1, { color: colors.brandGreen }]}>{`${currentTemp}\u00B0`}</Text>
              <Text style={[typography.caption, styles.muted]}>Supply</Text>
            </View>
          </View>
        </View>

        <View style={styles.powerColumn}>
          <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>Power</Text>
          <View style={styles.powerSwitch}>
            <View style={styles.powerThumb} />
          </View>
          <Ionicons name="power-outline" size={20} color={colors.brandGreen} style={{ marginTop: spacing.xs }} />
        </View>
      </Card>

      {isOffline ? (
        <Text style={[typography.caption, styles.offlineNote, { marginBottom: spacing.md }]}>
          {isOfflineWithCache
            ? 'Offline - showing cached data (read-only).'
            : 'Offline and no cached data for this device.'}
        </Text>
      ) : null}
      {cacheStale ? (
        <Text style={[typography.caption, styles.offlineNote, { marginBottom: spacing.md, color: colors.warning }]}>
          Data older than 24 hours – may be out of date.
        </Text>
      ) : null}
      {!isOffline && isDeviceOffline ? (
        <Text style={[typography.caption, styles.offlineNote, { marginBottom: spacing.md }]}>
          Device is offline. Commands are disabled until it reconnects.
        </Text>
      ) : null}
      {!isOffline && !isDeviceOffline && !isControlConfigured ? (
        <Text style={[typography.caption, styles.offlineNote, { marginBottom: spacing.md }]}>
          Control channel not configured for this device in this environment.
        </Text>
      ) : null}

      <View style={styles.rangeTabs}>
        <PillTabGroup
          value={range}
          options={[
            { value: '1h', label: '1h' },
            { value: '24h', label: '24h' },
            { value: '7d', label: '7d' },
          ]}
          onChange={setRange}
        />
      </View>

      {telemetryLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.brandGreen} />
          <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>Loading telemetry...</Text>
        </View>
      )}
      {telemetryOfflineEmpty ? (
        <ErrorCard
          title="Telemetry unavailable offline"
          message="Connect to the network to refresh telemetry for this device."
        />
      ) : telemetryError && !telemetryLoading ? (
        <ErrorCard
          title="Couldn't load telemetry"
          message={mapTelemetryError(telemetryErrorObj)}
          onRetry={() => refetchTelemetry()}
          testID="telemetry-error"
        />
      ) : null}

      {!telemetryLoading && !telemetryError && !telemetryOfflineEmpty && (
        <View testID="telemetry-section">
          {renderMetricCard(
            'Flow temperatures (C)',
            gradients.brandPrimary.start,
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
                  { name: 'Supply', symbol: { fill: colors.brandGreen } },
                  { name: 'Return', symbol: { fill: colors.warning } },
                ]}
              />
              <VictoryLine data={supplyData} style={{ data: { stroke: colors.brandGreen } }} />
              <VictoryLine data={returnData} style={{ data: { stroke: colors.warning } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'Power (kW)',
            colors.brandGreen,
            hasPowerData,
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={powerData} style={{ data: { stroke: colors.brandGreen } }} />
            </VictoryChart>,
            emptyMetricPlaceholder
          )}

          {renderMetricCard(
            'Flow rate (L/s)',
            gradients.brandPrimary.start,
            hasFlowData,
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} />
              <VictoryAxis dependentAxis />
              <VictoryLine data={flowData} style={{ data: { stroke: gradients.brandPrimary.start } }} />
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

      <Card style={styles.historyCard} testID="compressor-current-card">
        <Text style={[typography.subtitle, styles.title]}>Compressor current (A)</Text>

        {heatPumpHistoryQuery.isLoading ? (
          <View style={styles.historyLoadingRow}>
            <ActivityIndicator color={colors.brandGreen} />
            <Text style={[typography.caption, styles.cardPlaceholder, { marginLeft: spacing.sm }]}>
              Loading history...
            </Text>
          </View>
        ) : historyStatus === 'offline' ? (
          <Text style={[typography.caption, styles.cardPlaceholder]}>
            History unavailable while offline. Reconnect to refresh.
          </Text>
        ) : historyStatus === 'disabled' ? (
          <Text style={[typography.caption, styles.cardPlaceholder]}>
            History unavailable for this device.
          </Text>
        ) : historyStatus === 'noData' ? (
          <Text style={[typography.caption, styles.cardPlaceholder]}>
            No history for this period.
          </Text>
        ) : historyStatus === 'ok' && heatPumpSeries.length > 0 ? (
          <View testID="heatPumpHistoryChart" style={styles.chartWrapper}>
            <VictoryChart scale={{ x: 'time' }}>
              <VictoryAxis dependentAxis />
              <VictoryAxis tickFormat={(t) => formatAxisTick(t)} tickCount={xTickCount} />
              <VictoryLine data={heatPumpSeries} style={{ data: { stroke: colors.brandGreen } }} />
            </VictoryChart>
          </View>
        ) : historyStatus !== 'ok' ? (
          <ErrorCard
            title="Could not load heat pump history."
            message={historyErrorMessage}
            onRetry={() => refetchHistory()}
            testID="history-error"
          />
        ) : null}
      </Card>

      <Card style={styles.controlCard}>
        <View style={styles.controlHeader}>
          <View>
            <Text style={[typography.subtitle, styles.title]}>Setpoint</Text>
            <Text style={[typography.caption, styles.muted]}>Safe range 30-60C</Text>
          </View>
          <Text style={[typography.title2, { color: colors.brandGreen }]}>{`${lastSetpoint}\u00B0C`}</Text>
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
          label={setpointPending ? 'Sending...' : 'Update setpoint'}
          onPress={onSetpointSave}
          testID="setpoint-button"
          disabled={setpointPending || commandsDisabledReason !== null}
        />
        {setpointPending ? (
          <Text style={[typography.caption, styles.muted, styles.pendingText]}>Sending setpoint...</Text>
        ) : null}
        {commandsDisabledReason ? (
          <Text style={[typography.caption, styles.muted, styles.pendingText]}>
            {mapControlDisabledMessage(commandsDisabledReason)}
          </Text>
        ) : null}
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
                    ? { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen }
                    : { backgroundColor: colors.backgroundAlt },
                ]}
                onPress={() => onModeChange(mode)}
                activeOpacity={0.9}
                disabled={modePending || commandsDisabledReason !== null}
              >
                <Text
                  style={[
                    typography.subtitle,
                    { color: selected ? colors.background : colors.textSecondary, textAlign: 'center' },
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {modePending ? (
          <Text style={[typography.caption, styles.muted, styles.pendingText]}>Sending mode change...</Text>
        ) : null}
        {commandsDisabledReason ? (
          <Text style={[typography.caption, styles.muted, styles.pendingText]}>
            {mapControlDisabledMessage(commandsDisabledReason)}
          </Text>
        ) : null}
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
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
      return colors.error;
    case 'warning':
      return colors.warning;
    default:
      return gradients.brandPrimary.end;
  }
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
  } else if (normalized.includes('crit')) {
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

function computeLastUpdatedAt(telemetry?: DeviceTelemetry | null) {
  const metrics = telemetry?.metrics;
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
}

function deriveHistoryStatus(error?: HeatPumpHistoryError): HistoryStatus {
  if (!error) return 'otherError';
  if (error.kind === 'circuitOpen' || error.status === 503) return 'circuitOpen';
  if (error.kind === 'upstream' || error.status === 502) return 'upstreamError';
  return 'otherError';
}

function mapTelemetryError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404) return 'Telemetry unavailable for this device.';
    if (status && status >= 500) return 'Server error loading telemetry. Please try again.';
  }
  return 'Failed to load telemetry. Please try again.';
}

function mapControlDisabledMessage(reason: CommandDisabledReason) {
  switch (reason) {
    case 'offline':
      return 'Commands are unavailable while offline.';
    case 'deviceOffline':
      return 'Device is offline; commands are disabled.';
    case 'unconfigured':
      return 'Control channel is not configured for this device in this environment.';
    default:
      return '';
  }
}

function mapControlFailureReason(
  reason?: ControlFailureReason | string,
  fallbackMessage?: string,
  status?: number
) {
  const normalized = (reason || '').toUpperCase();
  if (status === 429 || normalized === 'THROTTLED') {
    return 'Too many commands in a short time. Try again shortly.';
  }
  switch (normalized) {
    case 'ABOVE_MAX':
      return 'Setpoint above allowed range.';
    case 'BELOW_MIN':
      return 'Setpoint below allowed range.';
    case 'DEVICE_NOT_CAPABLE':
      return "This device doesn't support that mode.";
    case 'INVALID_VALUE':
      return 'Command value is not supported by this device.';
    case 'VALIDATION_ERROR':
      return 'Command validation failed. Please check the values and retry.';
    default:
      if (status === 503 || fallbackMessage?.includes('CONTROL_CHANNEL_UNCONFIGURED')) {
        return 'Control unavailable right now. Please try again later.';
      }
      if (status === 404) {
        return 'Device not controllable right now.';
      }
      if (status === 502) {
        return 'Command failed to reach the device. Please retry.';
      }
      return fallbackMessage || 'Command failed, please try again.';
  }
}

function mapHistoryError(status: HistoryStatus) {
  if (status === 'circuitOpen') {
    return 'History unavailable, please try again later.';
  }
  if (status === 'upstreamError') {
    return 'History temporarily unavailable. Please retry shortly.';
  }
  if (status === 'offline') {
    return 'History unavailable while offline. Reconnect to refresh.';
  }
  if (status === 'disabled') {
    return 'History unavailable for this device.';
  }
  if (status === 'otherError') {
    return 'Failed to load history. Try again or contact support.';
  }
  return undefined;
}

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
    color: colors.textPrimary,
  },
  muted: {
    color: colors.textSecondary,
  },
  staleText: {
    color: colors.warning,
    marginTop: spacing.xs,
  },
  offlineNote: {
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
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  dialInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
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
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    justifyContent: 'flex-start',
    padding: spacing.xs,
  },
  powerThumb: {
    width: 20,
    height: 28,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  historyCard: {
    marginBottom: spacing.md,
  },
  historyLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cardPlaceholder: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  cardError: {
    color: colors.error,
    marginTop: spacing.sm,
  },
  chartWrapper: {
    marginTop: spacing.sm,
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
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
  commandError: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  pendingText: {
    marginTop: spacing.xs,
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
    borderColor: colors.borderSubtle,
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
