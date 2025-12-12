import { z } from 'zod';
import {
  fetchHeatPumpHistory,
  getHeatPumpHistoryConfig,
  type HeatPumpHistoryPoint,
  type HeatPumpHistoryResult,
  type HeatPumpHistorySeries,
} from '../integrations/heatPumpHistoryClient';
import {
  recordHeatPumpHistorySummary,
  summarizeHeatPumpSeries,
} from './heatPumpHistoryTelemetry';
import { getDeviceById } from '../repositories/devicesRepository';
import { logger } from '../config/logger';
import { ERR_RANGE_TOO_LARGE } from '../config/limits';
import { getRequestContext } from '../config/requestContext';
import { performance } from 'node:perf_hooks';

const isoString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO timestamp' });

const heatPumpHistoryRequestSchema = z
  .object({
    deviceId: z.string().min(1),
    from: isoString,
    to: isoString,
    aggregation: z.enum(['raw', 'avg', 'min', 'max']).default('raw'),
    mode: z.enum(['live', 'history']).default('live'),
    fields: z
      .array(
        z.object({
          field: z.string().min(1),
          unit: z.string().optional(),
          decimals: z.number().int().optional(),
          displayName: z.string().optional(),
          propertyName: z.string().optional(),
        })
      )
      .min(1),
  })
  .refine(
    (value) => Date.parse(value.from) <= Date.parse(value.to),
    { message: '`from` must be before or equal to `to`' }
  );

const DEFAULT_MAX_RANGE_HOURS = 24;
const DEFAULT_PAGE_RANGE_HOURS = 6;
const warnedInvalidEnvKeys = new Set<string>();
const log = logger.child({ module: 'heatPumpHistoryService' });

type VendorCallMeta = {
  pointsCount?: number;
  nonZeroCount?: number;
  min?: number | null;
  max?: number | null;
  elapsedMs?: number;
  fieldsCount?: number;
};

function logDevVendorCall(params: {
  deviceId: string;
  mac: string;
  from: string;
  to: string;
  seriesLength: number;
  meta?: VendorCallMeta;
}) {
  if ((process.env.NODE_ENV || 'development') !== 'development') return;
  const { requestId } = getRequestContext() ?? {};
  const payload = { ...params, requestId };
  if (params.meta) {
    payload.pointsCount = params.meta.pointsCount;
    payload.nonZeroCount = params.meta.nonZeroCount;
    payload.min = params.meta.min;
    payload.max = params.meta.max;
    payload.elapsedMs = params.meta.elapsedMs;
    payload.fieldsCount = params.meta.fieldsCount;
  }
  log.info(payload, 'heat pump history vendor call');
}

function countPoints(series: HeatPumpHistorySeries[]) {
  return series.reduce((total, entry) => total + entry.points.length, 0);
}

export class HeatPumpHistoryValidationError extends Error {
  constructor(message = 'Invalid body', public code?: string, public maxHours?: number) {
    super(message);
    this.name = 'HeatPumpHistoryValidationError';
  }
}

export class HeatPumpHistoryFeatureDisabledError extends Error {
  constructor(message = 'Heat pump history is disabled in this environment') {
    super(message);
    this.name = 'HeatPumpHistoryFeatureDisabledError';
  }
}

export class HeatPumpHistoryDeviceNotFoundError extends Error {
  constructor(message = 'Device not found') {
    super(message);
    this.name = 'HeatPumpHistoryDeviceNotFoundError';
  }
}

export class HeatPumpHistoryMissingMacError extends Error {
  constructor(message = 'Device is missing a MAC address') {
    super(message);
    this.name = 'HeatPumpHistoryMissingMacError';
  }
}

type UserContext = {
  userId: string;
  organisationId: string;
};

export async function getHistoryForRequest(
  userContext: UserContext,
  payload: unknown
): Promise<HeatPumpHistoryResult> {
  const parsed = heatPumpHistoryRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HeatPumpHistoryValidationError('Invalid body');
  }

  const config = getHeatPumpHistoryConfig();
  if (config.disabled) {
    throw new HeatPumpHistoryFeatureDisabledError(
      'Heat pump history is disabled via HEATPUMP_HISTORY_DISABLED'
    );
  }
  if (config.nodeEnv !== 'development' && config.missingKeys.length > 0) {
    throw new HeatPumpHistoryFeatureDisabledError(
      'Heat pump history is disabled until required env vars are set'
    );
  }

  const maxRangeHours = resolveMaxRangeHours();
  const fromDate = new Date(parsed.data.from);
  const toDate = new Date(parsed.data.to);
  const rangeMs = toDate.getTime() - fromDate.getTime();
  const maxRangeMs = maxRangeHours * 60 * 60 * 1000;

  if (rangeMs > maxRangeMs) {
    throw new HeatPumpHistoryValidationError(
      `Requested range exceeds maximum of ${maxRangeHours} hours`,
      ERR_RANGE_TOO_LARGE,
      maxRangeHours
    );
  }

  const device = await getDeviceById(parsed.data.deviceId, userContext.organisationId);
  if (!device) {
    throw new HeatPumpHistoryDeviceNotFoundError('Device not found for this organisation');
  }

  const mac = (device.mac ?? '').trim();
  if (!mac) {
    throw new HeatPumpHistoryMissingMacError('Device has no MAC configured');
  }

  const { deviceId, ...historyRequest } = parsed.data;
  const maxPageHours = resolvePageHours(maxRangeHours);
  const requestContext = { mac, from: parsed.data.from, to: parsed.data.to };
  if (rangeMs <= maxPageHours * 60 * 60 * 1000) {
    const startedAt = performance.now();
    const result = await fetchHeatPumpHistory({ ...historyRequest, mac });
    const elapsedMs = performance.now() - startedAt;
    if (result.ok) {
      const stats = summarizeHeatPumpSeries(result.series);
      logDevVendorCall({
        deviceId,
        mac,
        from: parsed.data.from,
        to: parsed.data.to,
        seriesLength: countPoints(result.series),
        meta: { ...stats, elapsedMs, fieldsCount: historyRequest.fields.length },
      });
      recordHeatPumpHistorySummary({
        mac,
        from: parsed.data.from,
        to: parsed.data.to,
        fieldsCount: historyRequest.fields.length,
        pointsCount: stats.pointsCount,
        nonZeroCount: stats.nonZeroCount,
        firstTimestamp: stats.firstTimestamp,
        lastTimestamp: stats.lastTimestamp,
        min: stats.min,
        max: stats.max,
      });
    }
    return result;
  }

  const paged = await fetchPagedHistory(
    { ...historyRequest, mac },
    fromDate,
    toDate,
    maxPageHours,
    deviceId,
    historyRequest.fields.length
  );
  if (paged.ok) {
    const stats = summarizeHeatPumpSeries(paged.series);
    recordHeatPumpHistorySummary({
      ...requestContext,
      fieldsCount: historyRequest.fields.length,
      pointsCount: stats.pointsCount,
      nonZeroCount: stats.nonZeroCount,
      firstTimestamp: stats.firstTimestamp,
      lastTimestamp: stats.lastTimestamp,
      min: stats.min,
      max: stats.max,
    });
  }
  return paged;
}

function resolveHoursEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (!warnedInvalidEnvKeys.has(key)) {
      log.warn({ key, raw }, 'invalid heat pump history hours env; using default');
      warnedInvalidEnvKeys.add(key);
    }
    return fallback;
  }

  return parsed;
}

function resolveMaxRangeHours() {
  return resolveHoursEnv('HEATPUMP_HISTORY_MAX_RANGE_HOURS', DEFAULT_MAX_RANGE_HOURS);
}

function resolvePageHours(maxRangeHours: number) {
  const fallback = Math.min(DEFAULT_PAGE_RANGE_HOURS, maxRangeHours);
  const resolved = resolveHoursEnv('HEATPUMP_HISTORY_PAGE_HOURS', fallback);
  return Math.min(resolved, maxRangeHours);
}

function chunkRange(from: Date, to: Date, maxHours: number): Array<{ from: Date; to: Date }> {
  const segments: Array<{ from: Date; to: Date }> = [];
  const maxMs = maxHours * 60 * 60 * 1000;
  let cursor = from.getTime();
  const end = to.getTime();

  while (cursor < end) {
    const nextEnd = Math.min(cursor + maxMs, end);
    segments.push({ from: new Date(cursor), to: new Date(nextEnd) });
    if (nextEnd === end) break;
    cursor = nextEnd;
  }

  return segments;
}

function mergeSeries(existing: Map<string, HeatPumpHistoryPoint[]>, next: HeatPumpHistorySeries[]) {
  next.forEach((series) => {
    const points = existing.get(series.field) ?? [];
    points.push(...series.points);
    existing.set(series.field, points);
  });
}

function normalizeSeriesMap(series: Map<string, HeatPumpHistoryPoint[]>): HeatPumpHistorySeries[] {
  return Array.from(series.entries()).map(([field, points]) => {
    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const deduped: HeatPumpHistoryPoint[] = [];
    sorted.forEach((point) => {
      const last = deduped[deduped.length - 1];
      if (last && last.timestamp === point.timestamp) {
        deduped[deduped.length - 1] = point;
      } else {
        deduped.push(point);
      }
    });

    return { field, points: deduped };
  });
}

async function fetchPagedHistory(
  request: Omit<Parameters<typeof fetchHeatPumpHistory>[0], 'from' | 'to'>,
  from: Date,
  to: Date,
  maxPageHours: number,
  deviceId: string,
  fieldsCount: number
): Promise<HeatPumpHistoryResult> {
  const segments = chunkRange(from, to, maxPageHours);
  if (segments.length <= 1) {
    const startedAt = performance.now();
    const result = await fetchHeatPumpHistory({
      ...request,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const elapsedMs = performance.now() - startedAt;
    if (result.ok) {
      const stats = summarizeHeatPumpSeries(result.series);
      logDevVendorCall({
        deviceId,
        mac: request.mac,
        from: from.toISOString(),
        to: to.toISOString(),
        seriesLength: countPoints(result.series),
        meta: { ...stats, elapsedMs, fieldsCount },
      });
    }
    return result;
  }

  const combined = new Map<string, HeatPumpHistoryPoint[]>();

  for (const segment of segments) {
    const startedAt = performance.now();
    const result = await fetchHeatPumpHistory({
      ...request,
      from: segment.from.toISOString(),
      to: segment.to.toISOString(),
    });
    const elapsedMs = performance.now() - startedAt;

    if (!result.ok) {
      return result;
    }

    const stats = summarizeHeatPumpSeries(result.series);
    logDevVendorCall({
      deviceId,
      mac: request.mac,
      from: segment.from.toISOString(),
      to: segment.to.toISOString(),
      seriesLength: countPoints(result.series),
      meta: { ...stats, elapsedMs, fieldsCount },
    });

    mergeSeries(combined, result.series);
  }

  return { ok: true, series: normalizeSeriesMap(combined) };
}
