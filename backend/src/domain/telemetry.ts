export type TelemetryPoint = {
  ts: string;
  value: number;
};

export type TelemetryRange = '24h' | '7d';

export type TelemetryResult = {
  range: TelemetryRange;
  metrics: Record<string, TelemetryPoint[]>;
};
