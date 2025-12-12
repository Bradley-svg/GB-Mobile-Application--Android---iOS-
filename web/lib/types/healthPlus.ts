import type { DemoStatus, VendorFlags } from "./demo";

export type HeatPumpHistoryRequestSummary = {
  mac: string;
  from: string;
  to: string;
  fieldsCount: number;
  pointsCount: number;
  nonZeroCount: number;
  firstTimestamp?: string | null;
  lastTimestamp?: string | null;
  min?: number | null;
  max?: number | null;
};

export type HealthPlusPayload = {
  ok: boolean;
  env: string;
  db: "ok" | "error";
  dbLatencyMs: number | null;
  version: string | null;
  vendorFlags?: VendorFlags;
  mqtt: {
    configured: boolean;
    disabled?: boolean;
    connected: boolean;
    lastMessageAt: string | null;
    lastIngestAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  control: {
    configured: boolean;
    disabled?: boolean;
    lastCommandAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  heatPumpHistory: {
    configured: boolean;
    disabled: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    lastCheckAt: string | null;
    healthy: boolean;
    lastRequestSummary: HeatPumpHistoryRequestSummary | null;
  };
  alertsWorker: {
    lastHeartbeatAt: string | null;
    healthy: boolean;
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
    target: "command" | "socket" | null;
    lastRunAt: string | null;
    lastResult: "clean" | "infected" | "error" | "scan_failed" | null;
    lastError: string | null;
    latencyMs: number | null;
  };
  maintenance?: {
    openCount: number;
    overdueCount: number;
    lastCalcAt: string | null;
  };
  perfHints?: {
    deviceCount: number;
    alertCount: number;
    workOrderCount: number;
    avgAlertsPerDevice: number;
    avgWorkOrdersPerDevice: number;
    slowQueriesLastHour: number | null;
  };
  storage?: {
    root: string;
    writable: boolean;
    latencyMs: number | null;
  };
  demo?: DemoStatus;
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
};
