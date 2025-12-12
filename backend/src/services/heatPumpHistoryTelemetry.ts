import type { HeatPumpHistorySeries } from '../integrations/heatPumpHistoryClient';

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

type HeatPumpHistorySeriesStats = Omit<
  HeatPumpHistoryRequestSummary,
  'mac' | 'from' | 'to' | 'fieldsCount'
>;

let lastRequestSummary: HeatPumpHistoryRequestSummary | null = null;

export function summarizeHeatPumpSeries(series: HeatPumpHistorySeries[]): HeatPumpHistorySeriesStats {
  let pointsCount = 0;
  let nonZeroCount = 0;
  let min: number | null = null;
  let max: number | null = null;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  series.forEach((entry) => {
    entry.points.forEach((point) => {
      pointsCount += 1;
      const ts = new Date(point.timestamp);
      if (!Number.isNaN(ts.getTime())) {
        if (!firstTimestamp || ts < new Date(firstTimestamp)) {
          firstTimestamp = ts.toISOString();
        }
        if (!lastTimestamp || ts > new Date(lastTimestamp)) {
          lastTimestamp = ts.toISOString();
        }
      }
      const value = point.value;
      if (value !== null && value !== undefined) {
        if (value !== 0) nonZeroCount += 1;
        if (min === null || value < min) min = value;
        if (max === null || value > max) max = value;
      }
    });
  });

  return { pointsCount, nonZeroCount, min, max, firstTimestamp, lastTimestamp };
}

export function recordHeatPumpHistorySummary(summary: HeatPumpHistoryRequestSummary) {
  lastRequestSummary = summary;
}

export function getLastHeatPumpHistorySummary(): HeatPumpHistoryRequestSummary | null {
  return lastRequestSummary;
}

