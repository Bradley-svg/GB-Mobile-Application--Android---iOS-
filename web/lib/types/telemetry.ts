export type DeviceTelemetry = {
  range: "1h" | "6h" | "24h" | "7d";
  metrics: Record<string, { ts: string; value: number }[]>;
};
