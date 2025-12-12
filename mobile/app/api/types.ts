export type ApiSite = {
  id: string;
  name: string;
  city?: string;
  status?: string;
  last_seen_at?: string;
  online_devices?: number;
  device_count_online?: number;
  health?: HealthStatus;
  last_seen?: LastSeenSummary;
  device_count?: number;
};

export type ApiDevice = {
  id: string;
  site_id: string;
  name: string;
  type: string;
  external_id?: string | null;
  mac?: string | null;
  controller?: string | null;
  status?: string;
  last_seen_at?: string;
  health?: HealthStatus;
  last_seen?: LastSeenSummary;
  firmware_version?: string | null;
  connectivity_status?: string | null;
};

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export type HeatPumpMetric =
  | 'compressor_current'
  | 'cop'
  | 'tank_temp'
  | 'dhw_temp'
  | 'ambient_temp'
  | 'flow_rate'
  | 'power_kw';

export type DeviceTelemetry = {
  range: TimeRange;
  metrics: Record<string, { ts: string; value: number }[]>;
};

export type HeatPumpHistoryField = {
  field: string;
  unit?: string;
  decimals?: number;
  displayName?: string;
  propertyName?: string;
};

export type HeatPumpHistoryRequest = {
  deviceId: string;
  from: string;
  to: string;
  aggregation?: 'raw' | 'avg' | 'min' | 'max';
  mode?: 'live' | 'history';
  fields: HeatPumpHistoryField[];
};

export type HeatPumpHistoryPoint = {
  timestamp: string;
  value: number | null;
};

export type HeatPumpHistorySeries = {
  field: string;
  points: HeatPumpHistoryPoint[];
};

export type HeatPumpHistoryResponse = {
  series: HeatPumpHistorySeries[];
};

export type VendorFlags = {
  prodLike: boolean;
  disabled: string[];
  mqttDisabled: boolean;
  controlDisabled: boolean;
  heatPumpHistoryDisabled: boolean;
  pushNotificationsDisabled: boolean;
};

export type Alert = {
  id: string;
  site_id: string | null;
  device_id: string | null;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  status: 'active' | 'cleared';
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
  rule_id?: string | null;
};

export type AlertRule = {
  id: string;
  org_id: string;
  site_id: string | null;
  device_id: string | null;
  metric: string;
  rule_type: string;
  threshold: number | null;
  roc_window_sec: number | null;
  offline_grace_sec: number | null;
  enabled: boolean;
  severity: 'warning' | 'critical';
  snooze_default_sec: number | null;
  name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DeviceSchedule = {
  id: string;
  device_id: string;
  name: string;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  target_setpoint: number;
  target_mode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO' | string;
  created_at: string;
  updated_at: string;
};

export type ControlCommandHistoryRow = {
  id: string;
  device_id: string;
  status: string;
  command_type: string;
  requested_value: unknown;
  payload: unknown;
  requested_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  failure_message: string | null;
  actor: {
    id: string | null;
    email: string | null;
    name: string | null;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id?: string | null;
  role?: string | null;
  two_factor_enabled?: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = Partial<AuthTokens> & {
  user?: AuthUser;
  requires2fa?: boolean;
  challengeToken?: string;
  twoFactorSetupRequired?: boolean;
};

export type TwoFactorSetupResponse = {
  secret: string;
  otpauthUrl: string;
};

export type TwoFactorStatusResponse = {
  enabled: boolean;
};

export type DemoStatus = {
  isDemoOrg: boolean;
  heroDeviceId: string | null;
  heroDeviceMac: string | null;
  seededAt: string | null;
  vendorFlags?: VendorFlags;
};

export type ControlFailureReason =
  | 'ABOVE_MAX'
  | 'BELOW_MIN'
  | 'THROTTLED'
  | 'DEVICE_NOT_CAPABLE'
  | 'VALIDATION_ERROR';

export type HealthPlusPayload = {
  ok: boolean;
  env: string;
  version: string | null;
  db?: 'ok' | 'error';
  dbLatencyMs?: number | null;
  vendorFlags?: VendorFlags;
  mqtt: {
    configured: boolean;
    disabled?: boolean;
    healthy: boolean;
    lastIngestAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  control: {
    configured: boolean;
    disabled?: boolean;
    healthy: boolean;
    lastCommandAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  heatPumpHistory: {
    configured: boolean;
    disabled: boolean;
    healthy: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    lastCheckAt: string | null;
  };
  alertsWorker: {
    healthy: boolean;
    lastHeartbeatAt: string | null;
  };
  push: {
    enabled: boolean;
    disabled?: boolean;
    lastSampleAt: string | null;
    lastError: string | null;
  };
  antivirus: {
    configured: boolean;
    enabled: boolean;
    target: 'command' | 'socket' | null;
    lastRunAt: string | null;
    lastResult: 'clean' | 'infected' | 'error' | null;
    lastError: string | null;
    latencyMs: number | null;
  };
  maintenance?: {
    openCount: number;
    overdueCount: number;
    lastCalcAt: string | null;
  };
  storage?: {
    root: string;
    writable: boolean;
    latencyMs: number | null;
  };
  alertsEngine: {
    lastRunAt: string | null;
    lastDurationMs: number | null;
    rulesLoaded: number | null;
    activeAlertsTotal: number | null;
    activeWarning: number | null;
    activeCritical: number | null;
    activeInfo: number | null;
    evaluated: number | null;
    triggered: number | null;
  };
  demo?: DemoStatus;
};

export type NotificationPreferences = {
  alertsEnabled: boolean;
  // Mirror of backend /user/preferences response.
};

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';

export type LastSeenSummary = {
  at: string | null;
  ageMinutes: number | null;
  isStale: boolean;
  isOffline: boolean;
};

export type FleetSearchResult = {
  sites: ApiSite[];
  devices: (ApiDevice & { site_name?: string; site_city?: string | null })[];
  meta?: {
    siteCount: number;
    deviceCount: number;
  };
};

export type ShareLink = {
  id: string;
  scopeType: 'site' | 'device';
  scopeId: string;
  permissions: string;
  expiresAt: string;
  createdAt: string;
  token: string;
  createdBy?: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
};

export type DeviceLookupResponse = {
  device: {
    id: string;
    name?: string | null;
    site_id: string;
    site_name?: string | null;
    status?: string | null;
    last_seen_at?: string | null;
    mac?: string | null;
  };
  navigateTo: 'deviceDetail';
};
