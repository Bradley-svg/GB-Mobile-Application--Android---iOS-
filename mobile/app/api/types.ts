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
};

export type TimeRange = '1h' | '24h' | '7d';

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
  mac: string;
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
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id?: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = AuthTokens & { user: AuthUser };

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
  db?: string;
  mqtt: {
    configured: boolean;
    healthy: boolean;
    lastIngestAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  control: {
    configured: boolean;
    healthy: boolean;
    lastCommandAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  heatPumpHistory: {
    configured: boolean;
    healthy: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  alertsWorker: {
    healthy: boolean;
    lastHeartbeatAt: string | null;
  };
  push: {
    enabled: boolean;
    lastSampleAt: string | null;
    lastError: string | null;
  };
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
