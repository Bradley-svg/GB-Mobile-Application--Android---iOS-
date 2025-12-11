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
  type?: string;
  external_id?: string | null;
  mac?: string | null;
  controller?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
  health?: HealthStatus;
  last_seen?: LastSeenSummary;
  firmware_version?: string | null;
  connectivity_status?: string | null;
  site_name?: string | null;
  site_city?: string | null;
};

export type HealthStatus = "healthy" | "warning" | "critical" | "offline";

export type LastSeenSummary = {
  at: string | null;
  ageMinutes: number | null;
  isStale: boolean;
  isOffline: boolean;
};

export type FleetSearchResult = {
  sites: ApiSite[];
  devices: ApiDevice[];
  meta?: {
    siteCount: number;
    deviceCount: number;
  };
};
