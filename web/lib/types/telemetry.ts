export type TimeRange = "1h" | "6h" | "24h" | "7d";

export type DeviceTelemetry = {
  range: TimeRange;
  metrics: Record<string, { ts: string; value: number }[]>;
};
