import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
/* eslint react-native/no-unused-styles: "warn" */
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';
import type { HeatPumpHistoryError } from '../../api/heatPumpHistory/hooks';
import { fetchDeviceTelemetryCsv } from '../../api/exports';
import {
  useDevice,
  useDeviceAlerts,
  useDeviceTelemetry,
  useModeCommand,
  useSetpointCommand,
  useSite,
  useHeatPumpHistory,
  useDeviceCommands,
  useDeviceSchedule,
  useUpsertDeviceSchedule,
  useWorkOrdersList,
  useHealthPlus,
  useDemoStatus,
} from '../../api/hooks';
import type {
  ApiDevice,
  ControlFailureReason,
  ControlCommandHistoryRow,
  DeviceSchedule,
  DeviceTelemetry,
  HeatPumpHistoryRequest,
  HeatPumpMetric,
  TimeRange,
} from '../../api/types';
import {
  Screen,
  Card,
  PrimaryButton,
  IconButton,
  ErrorCard,
  PillTabGroup,
  StatusPill,
  OfflineBanner,
  RoleRestrictedHint,
  connectivityDisplay,
  healthDisplay,
  VendorDisabledBanner,
} from '../../components';
import { DeviceGaugesSection } from './DeviceGaugesSection';
import { CompressorHistoryCard, HistoryMetricOption } from './CompressorHistoryCard';
import type { HistoryStatus } from './types';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { loadJsonWithMetadata, saveJson, isCacheOlderThan } from '../../utils/storage';
import { useAppTheme } from '../../theme/useAppTheme';
import { getChartTheme } from '../../theme/chartTheme';
import type { AppTheme } from '../../theme/types';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { isContractor, useAuthStore } from '../../store/authStore';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { formatVendorDisabledSummary } from '../../components/VendorDisabledBanner';

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
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

type HistoryMetricDefinition = {
  key: HeatPumpMetric;
  label: string;
  unit?: string;
  decimals?: number;
  field: string;
};

const HISTORY_METRIC_DEFS: HistoryMetricDefinition[] = [
  {
    key: 'compressor_current',
    label: 'Compressor current',
    unit: 'A',
    decimals: 1,
    field: 'metric_compCurrentA',
  },
  {
    key: 'cop',
    label: 'COP',
    unit: '',
    decimals: 2,
    field: 'metric_cop',
  },
  {
    key: 'tank_temp',
    label: 'Tank temp',
    unit: '\u00B0C',
    decimals: 1,
    field: 'metric_tankTempC',
  },
  {
    key: 'dhw_temp',
    label: 'DHW temp',
    unit: '\u00B0C',
    decimals: 1,
    field: 'metric_dhwTempC',
  },
  {
    key: 'ambient_temp',
    label: 'Ambient temp',
    unit: '\u00B0C',
    decimals: 1,
    field: 'metric_ambientTempC',
  },
  {
    key: 'flow_rate',
    label: 'Flow rate',
    unit: 'L/s',
    decimals: 1,
    field: 'metric_flowRate',
  },
  {
    key: 'power_kw',
    label: 'Power',
    unit: 'kW',
    decimals: 1,
    field: 'metric_powerKw',
  },
];
const COMPRESSOR_METRIC_KEY: HeatPumpMetric = 'compressor_current';

type CachedDeviceDetail = {
  device: ApiDevice;
  telemetry: DeviceTelemetry;
  lastUpdatedAt: string | null;
  cachedAt: string;
};

type CommandDisabledReason = 'offline' | 'deviceOffline' | 'unconfigured' | 'readOnly' | 'vendor' | null;

export const DeviceDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const deviceId = route.params?.deviceId ?? '';
  const navigation = useNavigation<Navigation>();
  const [telemetryRange, setTelemetryRange] = useState<TimeRange>('24h');
  const [historyRange, setHistoryRange] = useState<TimeRange>('6h');
  const [historyView, setHistoryView] = useState<'telemetry' | 'compressor' | 'timeline'>('telemetry');
  const [historyMetric, setHistoryMetric] = useState<HeatPumpMetric>(COMPRESSOR_METRIC_KEY);
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
  const [isScheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{
    name: string;
    enabled: boolean;
    startHour: number;
    endHour: number;
    targetSetpoint: number;
    targetMode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO';
  }>({
    name: 'Daily schedule',
    enabled: true,
    startHour: 6,
    endHour: 22,
    targetSetpoint: 45,
    targetMode: 'HEATING',
  });
  const [exportingTelemetry, setExportingTelemetry] = useState(false);

  const deviceQuery = useDevice(deviceId);
  const siteId = deviceQuery.data?.site_id ?? cachedDeviceDetail?.device.site_id;
  const siteQuery = useSite(siteId || '');
  const alertsQuery = useDeviceAlerts(deviceId);
  const telemetryQuery = useDeviceTelemetry(deviceId, telemetryRange);
  const setpointMutation = useSetpointCommand(deviceId);
  const modeMutation = useModeCommand(deviceId);
  const scheduleQuery = useDeviceSchedule(deviceId);
  const scheduleMutation = useUpsertDeviceSchedule(deviceId);
  const commandsQuery = useDeviceCommands(deviceId);
  const workOrdersQuery = useWorkOrdersList({ deviceId }, { enabled: !!deviceId });
  const setpointPending = isSetpointPending || setpointMutation.isPending;
  const modePending = isModePending || modeMutation.isPending;
  const refetchTelemetry = telemetryQuery.refetch;
  const mac = deviceQuery.data?.mac ?? cachedDeviceDetail?.device.mac ?? null;
  const { isOffline } = useNetworkBanner();
  const healthPlusQuery = useHealthPlus({ enabled: !isOffline });
  const { data: demoStatus } = useDemoStatus();
  const vendorFlagsFromHealth = healthPlusQuery.data?.vendorFlags;
  const vendorFlagsFromDemo = demoStatus?.vendorFlags;
  const vendorFlags = vendorFlagsFromHealth ?? vendorFlagsFromDemo;
  const isDemoOrg = demoStatus?.isDemoOrg ?? false;
  const vendorDisabled = formatVendorDisabledSummary(vendorFlags, {
    mqtt: healthPlusQuery.data?.mqtt?.disabled,
    control: healthPlusQuery.data?.control?.disabled,
    history: healthPlusQuery.data?.heatPumpHistory?.disabled,
    push: healthPlusQuery.data?.push?.disabled,
  });
  const vendorHistoryDisabled = Boolean(
    healthPlusQuery.data?.heatPumpHistory?.disabled ||
      vendorDisabled?.features.includes('history') ||
      vendorFlags?.heatPumpHistoryDisabled
  );
  const controlDisabledByVendor = Boolean(
    vendorDisabled?.features.includes('control') ||
      vendorFlags?.controlDisabled ||
      healthPlusQuery.data?.control?.disabled
  );
  const userRole = useAuthStore((s) => s.user?.role);
  const contractorReadOnly = isContractor(userRole);
  const readOnlyCopy = 'Read-only access for your role.';
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chartTheme = useMemo(() => getChartTheme(theme), [theme]);
  const { colors, gradients, spacing, typography } = theme;
  const chartAxisStyle = useMemo(
    () => ({
      axis: { stroke: chartTheme.axisColor },
      tickLabels: { fill: chartTheme.axisColor, fontSize: 10 },
    }),
    [chartTheme.axisColor]
  );
  const chartDependentAxisStyle = useMemo(
    () => ({
      ...chartAxisStyle,
      grid: { stroke: chartTheme.gridColor, strokeDasharray: '4,4' },
    }),
    [chartAxisStyle, chartTheme.gridColor]
  );

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

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setScheduleForm({
      name: scheduleQuery.data.name,
      enabled: scheduleQuery.data.enabled,
      startHour: scheduleQuery.data.start_hour,
      endHour: scheduleQuery.data.end_hour,
      targetSetpoint: scheduleQuery.data.target_setpoint,
      targetMode: (scheduleQuery.data.target_mode as 'OFF' | 'HEATING' | 'COOLING' | 'AUTO') || 'HEATING',
    });
  }, [scheduleQuery.data]);

  const historyWindow = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - RANGE_TO_WINDOW_MS[historyRange]);
    return {
      from: fromDate.toISOString(),
      to: now.toISOString(),
    };
  }, [historyRange]);

  const selectedHistoryMetricDef = useMemo(
    () => HISTORY_METRIC_DEFS.find((def) => def.key === historyMetric) ?? HISTORY_METRIC_DEFS[0],
    [historyMetric]
  );
  const compressorMetricDef =
    HISTORY_METRIC_DEFS.find((def) => def.key === COMPRESSOR_METRIC_KEY) ?? HISTORY_METRIC_DEFS[0];

  const historyFields = useMemo(() => {
    const fields: HeatPumpHistoryRequest['fields'] = [];
    const pushField = (def?: HistoryMetricDefinition) => {
      if (!def) return;
      if (fields.some((field) => field.field === def.field)) return;
      fields.push({
        field: def.field,
        unit: def.unit,
        decimals: def.decimals,
        displayName: def.label,
        propertyName: '',
      });
    };

    pushField(compressorMetricDef);
    pushField(selectedHistoryMetricDef);
    return fields;
  }, [compressorMetricDef, selectedHistoryMetricDef]);

  const historyRequest: HeatPumpHistoryRequest | null = useMemo(() => {
    if (!deviceId || !mac) return null;
    if (vendorHistoryDisabled) return null;
    return {
      deviceId,
      from: historyWindow.from,
      to: historyWindow.to,
      aggregation: 'raw',
      mode: 'live',
      fields: historyFields,
    };
  }, [deviceId, historyFields, historyWindow.from, historyWindow.to, mac, vendorHistoryDisabled]);

  const historyMetricOptions = useMemo<HistoryMetricOption[]>(() => {
    const colorForMetric = (key: HeatPumpMetric) => {
      switch (key) {
        case 'compressor_current':
          return chartTheme.linePrimary;
        case 'cop':
          return chartTheme.lineSecondary;
        case 'flow_rate':
          return chartTheme.lineQuaternary;
        case 'power_kw':
          return chartTheme.lineSecondary;
        case 'ambient_temp':
          return chartTheme.lineTertiary;
        case 'tank_temp':
        case 'dhw_temp':
          return chartTheme.lineTertiary;
        default:
          return chartTheme.linePrimary;
      }
    };

    return HISTORY_METRIC_DEFS.map((def) => ({
      key: def.key,
      label: def.label,
      unit: def.unit,
      decimals: def.decimals,
      color: colorForMetric(def.key),
    }));
  }, [
    chartTheme.linePrimary,
    chartTheme.lineQuaternary,
    chartTheme.lineSecondary,
    chartTheme.lineTertiary,
  ]);

  const heatPumpHistoryQuery = useHeatPumpHistory(
    historyRequest ?? {
      deviceId: '',
      from: historyWindow.from,
      to: historyWindow.to,
      aggregation: 'raw',
      mode: 'live',
      fields: [],
    },
    {
      enabled: !!historyRequest && !isOffline && !vendorHistoryDisabled,
    }
  );
  const refetchHistory = heatPumpHistoryQuery.refetch ?? (() => {});

  const missingDeviceId = !deviceId;
  const device = deviceQuery.data ?? cachedDeviceDetail?.device ?? null;
  const telemetryFromQuery = telemetryQuery.data;
  const telemetryData = telemetryFromQuery ?? cachedDeviceDetail?.telemetry ?? null;
  const siteName = useMemo(() => siteQuery.data?.name || 'Unknown site', [siteQuery.data]);
  const activeDeviceAlerts = useMemo(
    () => (alertsQuery.data || []).filter((a) => a.status === 'active'),
    [alertsQuery.data]
  );

  const supplyPoints = useMemo(
    () => telemetryData?.metrics['supply_temp'] || [],
    [telemetryData]
  );
  const returnPoints = useMemo(
    () => telemetryData?.metrics['return_temp'] || [],
    [telemetryData]
  );
  const powerPoints = useMemo(
    () => telemetryData?.metrics['power_kw'] || [],
    [telemetryData]
  );
  const flowPoints = useMemo(
    () => telemetryData?.metrics['flow_rate'] || [],
    [telemetryData]
  );
  const copPoints = useMemo(() => telemetryData?.metrics['cop'] || [], [telemetryData]);
  const deltaT = useMemo(() => {
    if (supplyPoints.length === 0 || returnPoints.length === 0) return null;
    const latestSupply = supplyPoints[supplyPoints.length - 1]?.value;
    const latestReturn = returnPoints[returnPoints.length - 1]?.value;
    if (latestSupply == null || latestReturn == null) return null;
    return Number((latestSupply - latestReturn).toFixed(2));
  }, [supplyPoints, returnPoints]);
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
  const isStale = useMemo(() => {
    if (!lastUpdatedAt) return false;
    const ts = new Date(lastUpdatedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts > STALE_THRESHOLD_MS;
  }, [lastUpdatedAt]);
  const deviceStatus = (device?.status || '').toLowerCase();
  const isDeviceOffline = deviceStatus.includes('off') || deviceStatus.includes('down');
  const isControlConfigured = Boolean(device?.external_id);
  const commandsDisabledReason: CommandDisabledReason = contractorReadOnly
    ? 'readOnly'
    : isOffline
    ? 'offline'
    : isDeviceOffline
    ? 'deviceOffline'
    : controlDisabledByVendor
    ? 'vendor'
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

  const xTickCount = telemetryRange === '7d' ? 5 : 6;
  const formatAxisTick = useMemo(
    () => (value: Date | number) => {
      const date = typeof value === 'number' ? new Date(value) : value;
      if (Number.isNaN(date.getTime())) return '';

      if (telemetryRange === '7d') {
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }

      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      return `${hours}:${minutes}`;
    },
    [telemetryRange]
  );

  const historySeriesByField = useMemo(() => {
    const series = heatPumpHistoryQuery.data?.series ?? [];
    return series.reduce<Record<string, typeof series[number]>>((acc, curr) => {
      acc[curr.field] = curr;
      return acc;
    }, {});
  }, [heatPumpHistoryQuery.data?.series]);

  const hasAnyHistoryPoints = useMemo(
    () =>
      Object.values(historySeriesByField).some((series) =>
        (series.points ?? []).some((p) => p.value !== null)
      ),
    [historySeriesByField]
  );

  const mapHistoryPoints = (series?: { points?: { timestamp: string; value: number | null }[] }) =>
    (series?.points ?? [])
      .filter((p) => p.value !== null)
      .map((p) => ({ x: new Date(p.timestamp), y: p.value as number }));

  const selectedHistoryOption = useMemo(
    () => historyMetricOptions.find((opt) => opt.key === historyMetric) ?? historyMetricOptions[0],
    [historyMetric, historyMetricOptions]
  );

  const selectedHistorySeries = selectedHistoryMetricDef
    ? historySeriesByField[selectedHistoryMetricDef.field]
    : undefined;
  const selectedHistoryPoints = useMemo(
    () => mapHistoryPoints(selectedHistorySeries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHistorySeries?.points]
  );

  const compressorHistorySeries = historySeriesByField[compressorMetricDef.field];
  const compressorHistoryPoints = useMemo(
    () => mapHistoryPoints(compressorHistorySeries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compressorHistorySeries?.points]
  );

  const latestCompressorPoint = useMemo(() => {
    const sourcePoints =
      compressorHistoryPoints.length > 0
        ? compressorHistoryPoints
        : selectedHistoryMetricDef?.key === COMPRESSOR_METRIC_KEY
        ? selectedHistoryPoints
        : [];
    if (!sourcePoints.length) return null;
    const last = sourcePoints[sourcePoints.length - 1];
    return {
      value: last.y,
      timestamp: last.x instanceof Date ? last.x.toISOString() : null,
    };
  }, [compressorHistoryPoints, selectedHistoryMetricDef?.key, selectedHistoryPoints]);

  const compressorGaugeValue = latestCompressorPoint?.value ?? null;
  const compressorGaugeUpdatedAt = latestCompressorPoint?.timestamp ?? null;
  const vendorHistoryEnabled = useMemo(() => {
    const heatPumpHistoryConfig = healthPlusQuery.data?.heatPumpHistory;
    const disabledByVendor = vendorHistoryDisabled ?? heatPumpHistoryConfig?.disabled;
    return Boolean(heatPumpHistoryConfig?.configured && !disabledByVendor);
  }, [
    healthPlusQuery.data?.heatPumpHistory,
    vendorHistoryDisabled,
  ]);

  const historyErrorObj = heatPumpHistoryQuery.error;
  const noHistoryPoints = useMemo(
    () =>
      selectedHistoryPoints.length === 0 ||
      selectedHistoryPoints.every((point) => (point.y ?? 0) === 0),
    [selectedHistoryPoints]
  );
  const historyStatus = useMemo<HistoryStatus>(() => {
    if (vendorHistoryDisabled) return 'vendorDisabled';
    if (isOffline) return 'offline';
    if (!historyRequest) return 'disabled';
    if (heatPumpHistoryQuery.isError) {
      return deriveHistoryStatus(historyErrorObj as HeatPumpHistoryError | undefined);
    }
    if (!heatPumpHistoryQuery.isLoading && noHistoryPoints) {
      return 'noData';
    }
    return 'ok';
  }, [
    heatPumpHistoryQuery.isError,
    heatPumpHistoryQuery.isLoading,
    noHistoryPoints,
    historyErrorObj,
    historyRequest,
    isOffline,
    vendorHistoryDisabled,
  ]);
  const historyEmptyState = useMemo(() => {
    const waitingMessage = 'Waiting for live data... Try the last 6h range.';
    if (heatPumpHistoryQuery.isLoading) return null;
    if (historyStatus !== 'noData' && !noHistoryPoints) return null;
    if (noHistoryPoints && historyRange === '1h') {
      return {
        message: isDemoOrg ? waitingMessage : 'No history for this metric in the selected range.',
        actionLabel: 'Switch to 6h',
        onAction: () => setHistoryRange('6h'),
      };
    }
    if (noHistoryPoints && historyRange === '6h' && isDemoOrg) {
      return { message: waitingMessage };
    }
    if (noHistoryPoints && historyRange === '6h' && vendorHistoryEnabled) {
      return {
        message: 'Vendor history returned no data for the last 6h.',
      };
    }
    return null;
  }, [
    heatPumpHistoryQuery.isLoading,
    historyStatus,
    historyRange,
    noHistoryPoints,
    vendorHistoryEnabled,
    isDemoOrg,
  ]);
  const commandRows = useMemo(
    () =>
      [...(commandsQuery.data ?? [])].sort(
        (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
      ),
    [commandsQuery.data]
  );
  const timelineEvents = useMemo(
    () => {
      const events: Array<{
        id: string;
        title: string;
        timestamp: string;
        type: 'alert' | 'workOrder';
        statusLabel?: string;
        tone: 'success' | 'warning' | 'error' | 'muted';
        detail?: string | null;
      }> = [];

      (alertsQuery.data ?? []).forEach((alert) => {
        const ts = alert.last_seen_at || alert.first_seen_at;
        if (!ts) return;
        const tone =
          alert.severity === 'critical'
            ? 'error'
            : alert.severity === 'warning'
            ? 'warning'
            : 'muted';
        events.push({
          id: `alert-${alert.id}`,
          title: alert.message,
          timestamp: ts,
          type: 'alert',
          statusLabel: (alert.status || 'Alert').toString().toUpperCase(),
          tone,
          detail: alert.severity ? alert.severity.toUpperCase() : null,
        });
      });

      (workOrdersQuery.data ?? []).forEach((wo) => {
        const ts = wo.resolvedAt ?? wo.resolved_at ?? wo.updated_at ?? wo.created_at;
        if (!ts) return;
        let tone: 'success' | 'warning' | 'error' | 'muted' = 'warning';
        if (wo.status === 'done') tone = 'success';
        else if (wo.status === 'cancelled') tone = 'muted';
        events.push({
          id: `work-${wo.id}`,
          title: wo.title || 'Work order',
          timestamp: ts,
          type: 'workOrder',
          statusLabel: (wo.status || 'work order').replace('_', ' '),
          tone,
          detail: wo.alert_severity ? `From alert: ${wo.alert_severity}` : undefined,
        });
      });

      return events
        .filter((event) => event.timestamp)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);
    },
    [alertsQuery.data, workOrdersQuery.data]
  );
  const timelineLoading = alertsQuery.isLoading || workOrdersQuery.isLoading;
  const timelineError = alertsQuery.isError || workOrdersQuery.isError;
  const hasCachedCommands = commandRows.length > 0;
  const showHistorySpinner = commandsQuery.isLoading && (!isOffline || hasCachedCommands);
  const showOfflineHistoryEmpty = isOffline && !hasCachedCommands;
  const showLoading = (deviceQuery.isLoading || cacheLoading) && !device;
  const deviceNotFound = !device && !showLoading;
  const telemetryLoading = telemetryQuery.isLoading && !telemetryData;
  const telemetryError = telemetryQuery.isError && !telemetryLoading && !telemetryData;
  const telemetryErrorObj = telemetryQuery.error;
  const telemetryOfflineEmpty = isOffline && !telemetryData && !telemetryLoading;
  const historyErrorMessage =
    (historyStatus === 'vendorDisabled'
      ? isDemoOrg
        ? 'History disabled for this demo environment.'
        : 'History disabled in this environment.'
      : mapHistoryError(historyStatus)) ||
    `Failed to load ${selectedHistoryMetricDef?.label ?? 'history'}. Try again or contact support.`;
  const isOfflineWithCache = isOffline && !!cachedDeviceDetail;
  const showUnknownLastUpdated = !lastUpdatedAt && (hasAnyTelemetryPoints || hasAnyHistoryPoints);
  const cacheStale = isCacheOlderThan(cachedSavedAt ?? cachedDeviceDetail?.cachedAt ?? null, CACHE_STALE_MS);
  type ModalProps = React.ComponentProps<typeof Modal>;
  const ModalComponent = (Modal || View) as React.ComponentType<ModalProps>;

  const onExportTelemetry = async () => {
    if (isOffline || exportingTelemetry || contractorReadOnly) return;
    setExportingTelemetry(true);
    try {
      const now = new Date();
      const windowMs = RANGE_TO_WINDOW_MS[telemetryRange] ?? RANGE_TO_WINDOW_MS['24h'];
      const from = new Date(now.getTime() - windowMs);
      const csv = await fetchDeviceTelemetryCsv(deviceId, from.toISOString(), now.toISOString());
      const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to export telemetry', err);
      Alert.alert('Export failed', 'Could not export telemetry right now.');
    } finally {
      setExportingTelemetry(false);
    }
  };

  if (__DEV__) {
    if (telemetryErrorObj) console.log('Telemetry load error', telemetryErrorObj);
    if (historyErrorObj) console.log('Heat pump history load error', historyErrorObj);
  }

  if (missingDeviceId) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="DeviceDetailScreen">
        <ErrorCard
          title="Missing device context"
          message="Select a device to view its details."
          testID="device-missing"
        />
      </Screen>
    );
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

  const mapFailureReasonLabel = (reason?: string | null) => {
    const normalized = (reason || '').toUpperCase();
    switch (normalized) {
      case 'THROTTLED':
        return 'Throttled';
      case 'VALIDATION_ERROR':
        return 'Validation failed';
      case 'SEND_FAILED':
        return 'Send failed';
      case 'EXTERNAL_ERROR':
        return 'Upstream error';
      default:
        return undefined;
    }
  };

  const commandStatusMeta = (cmd: ControlCommandHistoryRow) => {
    const normalized = (cmd.status || '').toLowerCase();
    const failureReason = (cmd.failure_reason || '').toUpperCase();
    if (failureReason === 'THROTTLED') {
      return { label: 'Throttled', color: colors.warning, failureLabel: 'Throttled' };
    }
    if (normalized === 'failed') {
      return {
        label: 'Failed',
        color: colors.error,
        failureLabel: mapFailureReasonLabel(failureReason),
      };
    }
    if (normalized === 'success') {
      return { label: 'Success', color: colors.success, failureLabel: undefined };
    }
    return {
      label: 'Pending',
      color: colors.warning,
      failureLabel: mapFailureReasonLabel(failureReason),
    };
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
        <Text
          style={[typography.caption, styles.muted, { textAlign: 'center', marginTop: spacing.md }]}
        >
          {emptyText}
        </Text>
      )}
    </Card>
  );

  const hasSupplyData = supplyData.length > 0;
  const hasReturnData = returnData.length > 0;
  const hasPowerData = powerData.length > 0;
  const hasFlowData = flowData.length > 0;
  const hasCopData = copData.length > 0;
  const emptyMetricPlaceholder = 'No data for this metric in the selected range.';
  const scheduleData = scheduleQuery.data;
  const scheduleSummary = formatScheduleSummary(scheduleData);
  const scheduleReadOnly = contractorReadOnly || isOffline;
  const exportDisabled = exportingTelemetry || contractorReadOnly;
  const healthPill = healthDisplay(device?.status);
  const connectivityPill = connectivityDisplay(device?.connectivity_status || device?.status);

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
      setCommandError(mapControlDisabledMessage(commandsDisabledReason, isDemoOrg));
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
      setCommandError(mapControlDisabledMessage(commandsDisabledReason, isDemoOrg));
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

  const onSaveSchedule = async () => {
    if (contractorReadOnly) {
      setScheduleError(readOnlyCopy);
      return;
    }
    if (isOffline) {
      setScheduleError('Schedule changes require a connection.');
      return;
    }
    if (
      scheduleForm.startHour < 0 ||
      scheduleForm.startHour > 24 ||
      scheduleForm.endHour < 0 ||
      scheduleForm.endHour > 24
    ) {
      setScheduleError('Hours must be between 0 and 24.');
      return;
    }
    if (scheduleForm.startHour === scheduleForm.endHour) {
      setScheduleError('Start and end hours must be different.');
      return;
    }
    if (
      scheduleForm.targetSetpoint < SETPOINT_MIN ||
      scheduleForm.targetSetpoint > SETPOINT_MAX
    ) {
      setScheduleError(
        `Setpoint must be between ${SETPOINT_MIN}-${SETPOINT_MAX}\u00B0C`
      );
      return;
    }

    setScheduleError(null);
    try {
      await scheduleMutation.mutateAsync({
        name: scheduleForm.name,
        enabled: scheduleForm.enabled,
        startHour: scheduleForm.startHour,
        endHour: scheduleForm.endHour,
        targetSetpoint: scheduleForm.targetSetpoint,
        targetMode: scheduleForm.targetMode,
      });
      setScheduleModalVisible(false);
    } catch {
      setScheduleError('Failed to save schedule. Please try again.');
    }
  };

  return (
    <>
      <ModalComponent visible={isScheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[typography.title2, styles.title, { marginBottom: spacing.sm }]}>
              Edit schedule
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputRow}>
                <Text style={[typography.caption, styles.muted]}>Name</Text>
                <TextInput
                  value={scheduleForm.name}
                  onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, name: text }))}
                  editable={!scheduleReadOnly}
                  style={styles.input}
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={[typography.caption, styles.muted]}>Start hour</Text>
                <TextInput
                  value={scheduleForm.startHour.toString()}
                  onChangeText={(text) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      startHour: Number.isNaN(Number(text)) ? 0 : Math.min(24, Math.max(0, Number(text))),
                    }))
                  }
                  keyboardType="numeric"
                  editable={!scheduleReadOnly}
                  style={styles.input}
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={[typography.caption, styles.muted]}>End hour</Text>
                <TextInput
                  value={scheduleForm.endHour.toString()}
                  onChangeText={(text) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      endHour: Number.isNaN(Number(text)) ? 0 : Math.min(24, Math.max(0, Number(text))),
                    }))
                  }
                  keyboardType="numeric"
                  editable={!scheduleReadOnly}
                  style={styles.input}
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={[typography.caption, styles.muted]}>Setpoint (\u00B0C)</Text>
                <TextInput
                  value={scheduleForm.targetSetpoint.toString()}
                  onChangeText={(text) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      targetSetpoint: Number.isNaN(Number(text))
                        ? prev.targetSetpoint
                        : Number(text),
                    }))
                  }
                  keyboardType="numeric"
                  editable={!scheduleReadOnly}
                  style={styles.input}
                />
              </View>
              <Text style={[typography.caption, styles.muted, { marginBottom: spacing.xs }]}>
                Mode
              </Text>
              <View style={styles.modeRow}>
                {(['OFF', 'HEATING', 'COOLING', 'AUTO'] as const).map((mode) => {
                  const selected = scheduleForm.targetMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.modeChip,
                        selected
                          ? { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen }
                          : { backgroundColor: colors.backgroundAlt },
                      ]}
                      onPress={() => setScheduleForm((prev) => ({ ...prev, targetMode: mode }))}
                      disabled={scheduleMutation.isPending || scheduleReadOnly}
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
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setScheduleForm((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                disabled={scheduleMutation.isPending || scheduleReadOnly}
              >
                <Text style={[typography.body, styles.title]}>Enabled</Text>
                <Ionicons
                  name={scheduleForm.enabled ? 'checkbox-outline' : 'square-outline'}
                  size={20}
                  color={scheduleForm.enabled ? colors.brandGreen : colors.textSecondary}
                />
              </TouchableOpacity>
              {scheduleError ? (
                <Text style={[typography.caption, styles.errorText]}>{scheduleError}</Text>
              ) : null}
              {isOffline ? (
                <Text style={[typography.caption, styles.offlineNote, { marginTop: spacing.xs }]}>
                  Schedule changes require a connection.
                </Text>
              ) : null}
              {contractorReadOnly ? (
                <RoleRestrictedHint action="edit schedules" testID="schedule-role-hint" />
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <PrimaryButton
                label={scheduleMutation.isPending ? 'Saving...' : 'Save schedule'}
                onPress={onSaveSchedule}
                disabled={scheduleMutation.isPending || isOffline || contractorReadOnly}
              />
              <PrimaryButton
                label="Cancel"
                variant="outline"
                onPress={() => setScheduleModalVisible(false)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        </View>
      </ModalComponent>
      <Screen
        scroll
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        testID="DeviceDetailScreen"
        scrollTestID="DeviceDetailScroll"
      >
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
          <View style={[styles.pillRow, { marginTop: spacing.sm }]}>
            <StatusPill label={healthPill.label} tone={healthPill.tone} />
            <StatusPill
              label={connectivityPill.label}
              tone={connectivityPill.tone}
              style={{ marginLeft: spacing.xs }}
              testID="device-connectivity-pill"
            />
          </View>
          <Text style={[typography.caption, styles.muted, { marginLeft: 0, marginTop: spacing.xs }]} numberOfLines={1}>
            {siteName}
          </Text>
          {device.firmware_version ? (
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
              FW {device.firmware_version}
            </Text>
          ) : null}
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

      <Card
        style={styles.quickLinkCard}
        onPress={() => navigation.navigate('Documents', { scope: 'device', deviceId })}
        testID="device-documents-link"
      >
        <View style={styles.quickLinkRow}>
          <View style={styles.quickLinkIcon}>
            <Ionicons name="document-text-outline" size={18} color={colors.brandGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.subtitle, styles.title]}>Documents</Text>
            <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
              Manuals, schematics, and documents for this device.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </Card>

      {isOffline ? (
        <OfflineBanner
          message={
            isOfflineWithCache
              ? 'Offline - showing cached data (read-only).'
              : 'Offline and no cached data for this device.'
          }
          lastUpdatedLabel={cachedSavedAt ? new Date(cachedSavedAt).toLocaleString() : null}
          testID="device-offline-banner"
        />
      ) : null}
      {contractorReadOnly ? (
        <RoleRestrictedHint
          action="change setpoints, schedules, or export telemetry"
          testID="device-role-hint"
        />
      ) : null}
      {cacheStale ? (
        <OfflineBanner
          message="Data older than 24 hours may be out of date."
          lastUpdatedLabel={cachedSavedAt ? new Date(cachedSavedAt).toLocaleString() : null}
          tone="warning"
        />
      ) : null}
      {!isOffline && isDeviceOffline ? (
        <OfflineBanner
          message="Device is offline. Commands are disabled until it reconnects."
          tone="warning"
        />
      ) : null}
      {!isOffline && !isDeviceOffline && !isControlConfigured ? (
        <OfflineBanner
          message="Control channel not configured for this device in this environment."
          tone="warning"
        />
      ) : null}
      <VendorDisabledBanner
        vendorFlags={vendorFlags}
        isDemoOrg={isDemoOrg}
        forceShow={!isDemoOrg && !!vendorDisabled}
        extraDisabled={{
          mqtt: healthPlusQuery.data?.mqtt?.disabled,
          control: controlDisabledByVendor,
          history: vendorHistoryDisabled,
          push: healthPlusQuery.data?.push?.disabled,
        }}
        style={{ marginBottom: spacing.sm }}
      />

      <View style={styles.historyToggle} testID="history-toggle">
        <PillTabGroup
          value={historyView}
          options={[
            { value: 'telemetry', label: 'Telemetry' },
            { value: 'compressor', label: 'Compressor' },
            { value: 'timeline', label: 'Events' },
          ]}
          onChange={(val) => setHistoryView(val as 'telemetry' | 'compressor' | 'timeline')}
        />
      </View>

      {historyView === 'telemetry' ? (
        <>
          <View style={styles.rangeTabs} testID="telemetry-range-tabs">
            <PillTabGroup
              value={telemetryRange}
              options={[
                { value: '1h', label: '1h' },
                { value: '24h', label: '24h' },
                { value: '7d', label: '7d' },
              ]}
              onChange={setTelemetryRange}
            />
          </View>
          {!isOffline ? (
            <TouchableOpacity
              onPress={onExportTelemetry}
              disabled={exportDisabled}
              style={[
                styles.exportButton,
                exportDisabled ? styles.exportButtonDisabled : styles.exportButtonEnabled,
              ]}
              testID="export-telemetry-button"
            >
              <Ionicons name="download-outline" size={16} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white, marginLeft: spacing.xs }]}>
                {exportingTelemetry ? 'Preparing...' : 'Export telemetry'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {contractorReadOnly ? (
            <RoleRestrictedHint action="export telemetry or adjust device controls" />
          ) : null}

          <DeviceGaugesSection
            telemetry={telemetryData}
            isOffline={isOffline}
            lastUpdatedAt={lastUpdatedAt}
            compressorCurrent={compressorGaugeValue}
            compressorUpdatedAt={compressorGaugeUpdatedAt}
          />

          {telemetryLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.brandGreen} />
              <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
                Loading telemetry...
              </Text>
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
                chartTheme.linePrimary,
                hasSupplyData || hasReturnData,
                <VictoryChart scale={{ x: 'time' }}>
                  <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} style={chartAxisStyle} />
                  <VictoryAxis dependentAxis style={chartDependentAxisStyle} />
                  <VictoryLegend
                    x={40}
                    y={0}
                    orientation="horizontal"
                    gutter={20}
                    data={[
                      { name: 'Supply', symbol: { fill: chartTheme.linePrimary } },
                      { name: 'Return', symbol: { fill: chartTheme.lineSecondary } },
                    ]}
                    style={{ labels: { fill: chartTheme.axisColor } }}
                  />
                  <VictoryLine data={supplyData} style={{ data: { stroke: chartTheme.linePrimary } }} />
                  <VictoryLine data={returnData} style={{ data: { stroke: chartTheme.lineSecondary } }} />
                </VictoryChart>,
                emptyMetricPlaceholder
              )}

              {renderMetricCard(
                'Delta T (Supply - Return)',
                chartTheme.lineSecondary,
                deltaT !== null,
                <View style={styles.deltaRow}>
                  <Text style={[typography.title1, styles.title]}>{`${deltaT?.toFixed(1)}\u00B0C`}</Text>
                  <Text style={[typography.caption, styles.muted]}>Latest difference</Text>
                </View>,
                'Delta T unavailable for this range.'
              )}

              {renderMetricCard(
                'Power (kW)',
                chartTheme.linePrimary,
                hasPowerData,
                <VictoryChart scale={{ x: 'time' }}>
                  <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} style={chartAxisStyle} />
                  <VictoryAxis dependentAxis style={chartDependentAxisStyle} />
                  <VictoryLine data={powerData} style={{ data: { stroke: chartTheme.linePrimary } }} />
                </VictoryChart>,
                emptyMetricPlaceholder
              )}

              {renderMetricCard(
                'Flow rate (L/s)',
                chartTheme.linePrimary,
                hasFlowData,
                <VictoryChart scale={{ x: 'time' }}>
                  <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} style={chartAxisStyle} />
                  <VictoryAxis dependentAxis style={chartDependentAxisStyle} />
                  <VictoryLine data={flowData} style={{ data: { stroke: chartTheme.linePrimary } }} />
                </VictoryChart>,
                emptyMetricPlaceholder
              )}

              {renderMetricCard(
                'COP',
                chartTheme.lineSecondary,
                hasCopData,
                <VictoryChart scale={{ x: 'time' }}>
                  <VictoryAxis tickFormat={formatAxisTick} tickCount={xTickCount} style={chartAxisStyle} />
                  <VictoryAxis dependentAxis style={chartDependentAxisStyle} />
                  <VictoryLine data={copData} style={{ data: { stroke: chartTheme.lineSecondary } }} />
                </VictoryChart>,
                emptyMetricPlaceholder
              )}
            </View>
          )}
        </>
      ) : null}
      {historyView === 'compressor' ? (
        <CompressorHistoryCard
          metric={historyMetric}
          metricOptions={historyMetricOptions}
          status={historyStatus}
          isLoading={heatPumpHistoryQuery.isLoading}
          range={historyRange}
          onRangeChange={setHistoryRange}
          onMetricChange={setHistoryMetric}
          onRetry={() => refetchHistory()}
          points={selectedHistoryPoints}
          errorMessage={historyErrorMessage}
          testID="compressor-current-card"
          isDemoOrg={isDemoOrg}
          emptyState={historyEmptyState || undefined}
          vendorCaption={
            vendorHistoryEnabled
              ? `Live vendor history: ${selectedHistoryOption?.label}${
                  selectedHistoryOption?.unit ? ` (${selectedHistoryOption.unit})` : ''
                } via /heat-pump-history`
              : undefined
          }
        />
      ) : null}

      {historyView === 'timeline' ? (
        <Card style={styles.timelineCard} testID="device-timeline">
          <View style={styles.scheduleHeader}>
            <Text style={[typography.subtitle, styles.title]}>Recent events</Text>
            <Text style={[typography.caption, styles.muted]}>
              {timelineEvents.length ? `${timelineEvents.length} items` : ''}
            </Text>
          </View>
          {timelineLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.brandGreen} />
              <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
                Loading timeline...
              </Text>
            </View>
          ) : null}
          {timelineError ? (
            <Text style={[typography.caption, styles.errorText]}>
              Could not load events. Pull to refresh.
            </Text>
          ) : null}
          {isOffline && timelineEvents.length === 0 ? (
            <Text style={[typography.caption, styles.muted]}>
              Timeline unavailable while offline.
            </Text>
          ) : null}
          {!timelineLoading && timelineEvents.length === 0 && !timelineError ? (
            <Text style={[typography.caption, styles.muted]}>No recent events.</Text>
          ) : null}
          {timelineEvents.map((event) => (
            <View key={event.id} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <View style={styles.timelineRowHeader}>
                  <StatusPill
                    label={event.type === 'alert' ? 'Alert' : 'Work order'}
                    tone={event.tone}
                  />
                  {event.statusLabel ? (
                    <StatusPill label={event.statusLabel} tone={event.tone} />
                  ) : null}
                </View>
                <Text style={[typography.body, styles.title]}>{event.title}</Text>
                <Text style={[typography.caption, styles.muted]}>
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}
                </Text>
                {event.detail ? (
                  <Text style={[typography.caption, styles.muted]}>{event.detail}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

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
          editable={!contractorReadOnly}
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
          <Text testID="setpoint-readonly" style={[typography.caption, styles.muted, styles.pendingText]}>
            {mapControlDisabledMessage(commandsDisabledReason, isDemoOrg)}
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
          <Text testID="mode-readonly" style={[typography.caption, styles.muted, styles.pendingText]}>
            {mapControlDisabledMessage(commandsDisabledReason, isDemoOrg)}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.scheduleCard}>
        <View style={styles.scheduleHeader}>
          <Text style={[typography.subtitle, styles.title]}>Schedule</Text>
          <TouchableOpacity
            onPress={() => setScheduleModalVisible(true)}
            disabled={isOffline || contractorReadOnly}
            testID="edit-schedule-button"
          >
            <Text
              style={[
                typography.caption,
                isOffline || contractorReadOnly ? styles.muted : styles.title,
              ]}
            >
              {isOffline ? 'Offline' : contractorReadOnly ? 'Read-only' : 'Edit schedule'}
            </Text>
          </TouchableOpacity>
        </View>
        {scheduleQuery.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.brandGreen} />
            <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
              Loading schedule...
            </Text>
          </View>
        ) : (
          <>
            <Text style={[typography.body, styles.title]}>{scheduleSummary}</Text>
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
              {scheduleData
                ? `Updated ${new Date(scheduleData.updated_at).toLocaleString()}`
                : 'Create a safe setpoint window for this device.'}
            </Text>
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
              Schedules are advisory and not yet automated.
            </Text>
          </>
        )}
        {scheduleQuery.isError ? (
          <Text style={[typography.caption, styles.errorText]}>
            Could not load schedule. Pull to refresh or retry.
          </Text>
        ) : null}
        {isOffline ? (
          <Text style={[typography.caption, styles.offlineNote, { marginTop: spacing.xs }]}>
            Schedule read-only while offline.
          </Text>
        ) : null}
        {contractorReadOnly ? (
          <Text style={[typography.caption, styles.offlineNote, { marginTop: spacing.xs }]}>
            {readOnlyCopy}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.historyCard}>
        <View style={styles.scheduleHeader}>
          <Text style={[typography.subtitle, styles.title]}>Control history</Text>
          <Text style={[typography.caption, styles.muted]}>Last 5 commands</Text>
        </View>
        {showHistorySpinner ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.brandGreen} />
            <Text style={[typography.caption, styles.muted, { marginLeft: spacing.sm }]}>
              Loading history...
            </Text>
          </View>
        ) : showOfflineHistoryEmpty ? (
          <Text style={[typography.caption, styles.muted]}>History unavailable while offline.</Text>
        ) : commandRows.length === 0 ? (
          <Text style={[typography.caption, styles.muted]}>No recent commands.</Text>
        ) : (
          commandRows.slice(0, 5).map((cmd) => {
            const meta = commandStatusMeta(cmd);
            return (
              <View key={cmd.id} style={styles.historyRow}>
                <View style={[styles.alertDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, styles.title]}>{formatCommandSummary(cmd)}</Text>
                  <Text style={[typography.caption, styles.muted]}>
                    {`${meta.label.toUpperCase()} | ${new Date(cmd.requested_at).toLocaleString()}${
                      meta.failureLabel ? ` | ${meta.failureLabel}` : ''
                    }`}
                  </Text>
                  {cmd.failure_message ? (
                    <Text style={[typography.caption, styles.errorText]}>{cmd.failure_message}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
        {commandsQuery.isError ? (
          <Text style={[typography.caption, styles.errorText]}>
            Could not load command history.
          </Text>
        ) : null}
        {isOffline && hasCachedCommands ? (
          <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
            Showing cached history.
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
    </>
  );
};

function formatHour(hour: number) {
  const clamped = Math.max(0, Math.min(24, Math.floor(hour)));
  return `${`${clamped}`.padStart(2, '0')}:00`;
}

function formatScheduleSummary(schedule?: DeviceSchedule | null) {
  if (!schedule) return 'No schedule configured yet.';
  const window = `${formatHour(schedule.start_hour)}-${formatHour(schedule.end_hour)}`;
  const state = schedule.enabled ? 'Active' : 'Paused';
  return `${state} | ${window} | ${schedule.target_setpoint}\u00B0C | ${schedule.target_mode}`;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const formatCommandSummary = (cmd: ControlCommandHistoryRow) => {
  const actor = cmd.actor?.name || cmd.actor?.email || 'Unknown user';
  const requested = toRecord(cmd.requested_value);
  const payload = toRecord(cmd.payload);
  const requestedMode = typeof requested.mode === 'string' ? requested.mode : undefined;
  const payloadMode = typeof payload.mode === 'string' ? payload.mode : undefined;
  if ((cmd.command_type || '').includes('mode')) {
    const mode = requestedMode || payloadMode || 'N/A';
    return `Mode ${mode} (${actor})`;
  }
  const requestedValue =
    typeof requested.value === 'number' || typeof requested.value === 'string'
      ? requested.value
      : undefined;
  const payloadValue =
    typeof payload.value === 'number' || typeof payload.value === 'string' ? payload.value : undefined;
  const requestedMetric = typeof requested.metric === 'string' ? requested.metric : undefined;
  const payloadMetric = typeof payload.metric === 'string' ? payload.metric : undefined;
  if ((cmd.command_type || '').includes('setpoint') || payloadMetric === 'flow_temp') {
    const value = requestedValue ?? payloadValue ?? requestedMetric ?? payloadMetric ?? '';
    return `Setpoint ${value ?? ''}\u00B0C (${actor})`;
  }
  return `${cmd.command_type || 'Command'} (${actor})`;
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

function mapControlDisabledMessage(reason: CommandDisabledReason, isDemoOrg?: boolean) {
  switch (reason) {
    case 'readOnly':
      return 'Read-only access for your role.';
    case 'offline':
      return 'Commands are unavailable while offline.';
    case 'deviceOffline':
      return 'Device is offline; commands are disabled.';
    case 'vendor':
      return isDemoOrg
        ? 'Control disabled for this demo environment.'
        : 'Control disabled in this environment.';
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

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return createThemedStyles(theme, {
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
    pillRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rangeTabs: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    historyToggle: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.md,
      alignSelf: 'flex-start',
    },
    exportButtonEnabled: {
      backgroundColor: colors.brandGreen,
    },
    exportButtonDisabled: {
      backgroundColor: colors.borderSubtle,
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
    deltaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    scheduleCard: {
      marginBottom: spacing.md,
    },
    scheduleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    historyCard: {
      marginBottom: spacing.md,
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
    inputRow: {
      marginBottom: spacing.sm,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: spacing.lg,
      maxHeight: '85%',
    },
    modalActions: {
      marginTop: spacing.md,
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
    timelineCard: {
      marginBottom: spacing.md,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.brandGreen,
      marginRight: spacing.sm,
      marginTop: spacing.xs,
    },
    timelineRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
  });
};
