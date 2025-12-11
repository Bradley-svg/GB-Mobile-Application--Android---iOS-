import type { TimeRange } from "./telemetry";

export type HeatPumpMetric =
  | "compressor_current"
  | "cop"
  | "tank_temp"
  | "dhw_temp"
  | "ambient_temp"
  | "flow_rate"
  | "power_kw";

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
  aggregation?: "raw" | "avg" | "min" | "max";
  mode?: "live" | "history";
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

export type HeatPumpHistoryError = {
  status?: number;
  message?: string;
  kind?: "circuitOpen" | "upstream" | "unavailable" | "otherError";
};
