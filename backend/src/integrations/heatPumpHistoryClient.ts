import { markHeatPumpHistoryError, markHeatPumpHistorySuccess } from '../services/statusService';
import { logger } from '../config/logger';

const DEFAULT_HEATPUMP_HISTORY_URL =
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

const MAX_FAILURES = 3;
const OPEN_WINDOW_MS = 60_000;
const log = logger.child({ module: 'heatPumpHistory' });

let consecutiveFailures = 0;
let circuitOpenedAt: Date | null = null;

function isCircuitOpen(nowMs = Date.now()): boolean {
  if (!circuitOpenedAt) return false;

  const elapsed = nowMs - circuitOpenedAt.getTime();
  if (elapsed < OPEN_WINDOW_MS) return true;

  consecutiveFailures = 0;
  circuitOpenedAt = null;
  return false;
}

function recordFailure(now: Date = new Date()) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= MAX_FAILURES && !circuitOpenedAt) {
    circuitOpenedAt = now;
  }
}

function recordSuccess() {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}

let legacyEnvWarningLogged = false;
let invalidTimeoutWarningLogged = false;

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
  aggregation: 'raw' | 'avg' | 'min' | 'max';
  mode: 'live' | 'history';
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

export type HeatPumpHistoryResult =
  | { ok: true; series: HeatPumpHistorySeries[] }
  | { ok: false; kind: 'UPSTREAM_ERROR' | 'CIRCUIT_OPEN'; message: string };

type AzureHeatPumpHistoryRequest = HeatPumpHistoryRequest;

function buildAzureRequest(payload: HeatPumpHistoryRequest): AzureHeatPumpHistoryRequest {
  // Azure dev endpoint (see src/scripts/debugHeatPumpHistory.ts) accepts the vendor shape:
  // top-level aggregation string plus from/to/mode/fields/mac at the same level.
  return { ...payload };
}

function logLegacyEnvWarning() {
  if (legacyEnvWarningLogged) return;
  log.warn(
    'HEAT_PUMP_* env vars are deprecated; please use HEATPUMP_HISTORY_URL, HEATPUMP_HISTORY_API_KEY, and HEATPUMP_HISTORY_TIMEOUT_MS instead.'
  );
  legacyEnvWarningLogged = true;
}

function resolveEnvValue(primaryKey: string, legacyKey: string) {
  const primary = process.env[primaryKey]?.trim();
  if (primary) return { value: primary, usedLegacy: false };

  const legacy = process.env[legacyKey]?.trim();
  if (legacy) {
    logLegacyEnvWarning();
    return { value: legacy, usedLegacy: true };
  }

  return { value: undefined, usedLegacy: false };
}

function resolveTimeoutMs() {
  const primaryTimeout = process.env.HEATPUMP_HISTORY_TIMEOUT_MS?.trim();
  const legacyTimeout = process.env.HEAT_PUMP_HISTORY_TIMEOUT_MS?.trim();
  const timeoutEnv = primaryTimeout || legacyTimeout;

  if (!primaryTimeout && legacyTimeout) {
    logLegacyEnvWarning();
  }

  if (!timeoutEnv) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsedTimeout = Number(timeoutEnv);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    if (!invalidTimeoutWarningLogged) {
      log.warn(
        'Invalid HEATPUMP_HISTORY_TIMEOUT_MS (or HEAT_PUMP_HISTORY_TIMEOUT_MS) value; falling back to default of 10000ms.'
      );
      invalidTimeoutWarningLogged = true;
    }
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return parsedTimeout;
}

function resolveConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const resolvedUrl = resolveEnvValue('HEATPUMP_HISTORY_URL', 'HEAT_PUMP_HISTORY_URL');
  const url = resolvedUrl.value || DEFAULT_HEATPUMP_HISTORY_URL;

  const resolvedApiKey = resolveEnvValue('HEATPUMP_HISTORY_API_KEY', 'HEAT_PUMP_HISTORY_API_KEY');
  const apiKey = resolvedApiKey.value;

  const requestTimeoutMs = resolveTimeoutMs();

  if (!url && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_URL is required when NODE_ENV is not development');
  }

  if (!apiKey && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development');
  }

  return { url, apiKey, requestTimeoutMs };
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizePoint(rawPoint: unknown): HeatPumpHistoryPoint | null {
  if (rawPoint === null || rawPoint === undefined) return null;

  let timestamp: unknown;
  let value: unknown;

  if (Array.isArray(rawPoint)) {
    [timestamp, value] = rawPoint;
  } else if (typeof rawPoint === 'object') {
    const obj = rawPoint as Record<string, unknown>;
    timestamp = obj.timestamp ?? obj.ts ?? obj.time;
    value = obj.value ?? obj.val ?? obj.data ?? obj.reading;
  } else {
    return null;
  }

  if (timestamp === undefined || timestamp === null) return null;

  const timestampString =
    typeof timestamp === 'number' && Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : String(timestamp);

  let numericValue: number | null;
  if (value === null || value === undefined) {
    numericValue = null;
  } else if (typeof value === 'number') {
    numericValue = value;
  } else {
    const parsed = Number(value);
    numericValue = Number.isFinite(parsed) ? parsed : null;
  }

  return { timestamp: timestampString, value: numericValue };
}

function normalizeSeriesEntry(entry: unknown): HeatPumpHistorySeries | null {
  if (!entry || typeof entry !== 'object') return null;

  const obj = entry as Record<string, unknown>;
  const field = obj.field ?? obj.metric ?? obj.name;
  const rawPoints =
    obj.points ?? obj.values ?? obj.data ?? obj.items ?? obj.readings ?? obj.samples;

  if (!field) return null;

  const points = Array.isArray(rawPoints)
    ? (rawPoints.map(normalizePoint).filter(Boolean) as HeatPumpHistoryPoint[])
    : [];

  return { field: String(field), points };
}

function normalizeHeatPumpHistoryResponse(raw: unknown): HeatPumpHistoryResponse {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { series?: unknown }).series)) {
    const series = ((raw as { series?: unknown }).series as unknown[]).map(normalizeSeriesEntry);
    return { series: series.filter(Boolean) as HeatPumpHistorySeries[] };
  }

  if (Array.isArray(raw)) {
    const series = raw.map(normalizeSeriesEntry).filter(Boolean) as HeatPumpHistorySeries[];
    return { series };
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>).map(([field, points]) =>
      normalizeSeriesEntry({ field, points })
    );
    return { series: entries.filter(Boolean) as HeatPumpHistorySeries[] };
  }

  return { series: [] };
}

export async function fetchHeatPumpHistory(req: HeatPumpHistoryRequest): Promise<HeatPumpHistoryResult> {
  if (isCircuitOpen()) {
    return {
      ok: false,
      kind: 'CIRCUIT_OPEN',
      message: 'Heat pump history is temporarily unavailable. Please try again shortly.',
    };
  }

  const azurePayload = buildAzureRequest(req);
  const { url, apiKey, requestTimeoutMs } = resolveConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        // Vendor requires text/plain; JSON is returned as text and parsed below.
        accept: 'text/plain',
        'content-type': 'application/json-patch+json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(azurePayload),
      signal: controller.signal,
    });

    const responseText = await res.text().catch(() => '');

    if (!res.ok) {
      log.error(
        {
          status: res.status,
          statusText: res.statusText,
          bodyPreview: responseText.slice(0, 200),
        },
        'heat pump history upstream error'
      );
      const message = `Heat pump history upstream error (${res.status})`;
      recordFailure();
      await markHeatPumpHistoryError(new Date(), message);
      return { ok: false, kind: 'UPSTREAM_ERROR', message };
    }

    const parsed = responseText ? safeParseJson(responseText) : {};
    const normalized = normalizeHeatPumpHistoryResponse(parsed);
    recordSuccess();
    await markHeatPumpHistorySuccess(new Date());
    return { ok: true, series: normalized.series };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      const message = 'Heat pump history request timed out';
      log.error({ err }, message);
      recordFailure();
      await markHeatPumpHistoryError(new Date(), message);
      return { ok: false, kind: 'UPSTREAM_ERROR', message };
    }

    const message = 'Heat pump history request failed';
    log.error({ err }, message);
    recordFailure();
    await markHeatPumpHistoryError(new Date(), (err as Error)?.message ?? message);
    return { ok: false, kind: 'UPSTREAM_ERROR', message };
  } finally {
    clearTimeout(timeout);
  }
}
