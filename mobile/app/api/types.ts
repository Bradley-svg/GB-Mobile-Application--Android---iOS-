export type ApiSite = {
  id: string;
  name: string;
  city?: string;
  status?: string;
  last_seen_at?: string;
  online_devices?: number;
  device_count_online?: number;
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
};

export type DeviceTelemetry = {
  range: '24h' | '7d';
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
