const DEFAULT_HEATPUMP_HISTORY_URL =
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
const REQUEST_TIMEOUT_MS = 10_000;

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

function resolveConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const url = process.env.HEATPUMP_HISTORY_URL?.trim() || DEFAULT_HEATPUMP_HISTORY_URL;
  const apiKey = process.env.HEATPUMP_HISTORY_API_KEY?.trim();

  if (!url && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_URL is required when NODE_ENV is not development');
  }

  if (!apiKey && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development');
  }

  return { url, apiKey };
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

export async function fetchHeatPumpHistory(
  req: HeatPumpHistoryRequest
): Promise<HeatPumpHistoryResponse> {
  const { url, apiKey } = resolveConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json,text/plain',
        'content-type': 'application/json-patch+json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    const responseText = await res.text().catch(() => '');

    if (!res.ok) {
      console.error('Heat pump history upstream error', {
        status: res.status,
        statusText: res.statusText,
        bodyPreview: responseText.slice(0, 200),
      });
      throw new Error('HEATPUMP_HISTORY_UPSTREAM_ERROR');
    }

    const parsed = responseText ? safeParseJson(responseText) : {};
    return normalizeHeatPumpHistoryResponse(parsed);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('HEATPUMP_HISTORY_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
