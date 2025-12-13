#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-require-imports */
/**
 * Quick smoke test for the vendor heat pump history endpoint and the backend proxy.
 *
 * Env:
 *  - HEATPUMP_HISTORY_URL / HEAT_PUMP_HISTORY_URL
 *  - HEATPUMP_HISTORY_API_KEY / HEAT_PUMP_HISTORY_API_KEY
 *  - HEATPUMP_HISTORY_TIMEOUT_MS (default 10000)
 *  - HEATPUMP_HISTORY_MAX_RANGE_HOURS (default 24)
 *  - HEATPUMP_HISTORY_PAGE_HOURS (default 6)
 *  - HEATPUMP_HISTORY_DISABLED
 *  - DEMO_ORG_ID / DEMO_DEVICE_MAC (mac used as default)
 *  - HEATPUMP_HISTORY_PROXY_URL (default http://localhost:4000/heat-pump-history)
 *  - HEATPUMP_HISTORY_BEARER_TOKEN (Authorization header for proxy)
 *  - DEMO_DEVICE_ID (optional default device id for proxy call)
 *
 * Args:
 *  --mac <mac>            (default DEMO_DEVICE_MAC or 38:18:2B:60:A9:94)
 *  --field <field>        (default metric_compCurrentA)
 *  --hours <n>            (default 6)
 *  --from <iso>           (optional)
 *  --to <iso>             (optional)
 *  --deviceId <id>        (optional; enables proxy check)
 *  --proxy-url <url>      (override proxy URL)
 *  --token <bearer>       (override bearer token for proxy)
 */
const { setTimeout: delay } = require('timers/promises');

const DEFAULT_URL =
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
const DEFAULT_MAC = '38:18:2B:60:A9:94';
const DEFAULT_FIELD = 'metric_compCurrentA';
const DEFAULT_FIELD_META = {
  metric_compCurrentA: {
    unit: 'A',
    decimals: 1,
    displayName: 'Current',
    propertyName: '',
  },
};
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RANGE_HOURS = 24;
const DEFAULT_PAGE_HOURS = 6;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[name] = true;
      continue;
    }
    args[name] = next;
    i += 1;
  }
  return args;
}

function normalizeEnvValue(primary, legacy) {
  const current = process.env[primary];
  if (current && current.trim()) return current.trim();
  const fallback = process.env[legacy];
  return fallback && fallback.trim() ? fallback.trim() : undefined;
}

function parseNumber(raw, fallback) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(raw, fallback) {
  if (raw === undefined || raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePoint(rawPoint) {
  if (rawPoint === null || rawPoint === undefined) return null;

  let timestamp;
  let value;

  if (Array.isArray(rawPoint)) {
    [timestamp, value] = rawPoint;
  } else if (typeof rawPoint === 'object') {
    const obj = rawPoint;
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

  let numericValue = null;
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

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry;
  const field = obj.field ?? obj.metric ?? obj.name;
  const rawPoints =
    obj.points ?? obj.values ?? obj.data ?? obj.items ?? obj.readings ?? obj.samples;

  if (!field) return null;

  const points = Array.isArray(rawPoints)
    ? rawPoints.map(normalizePoint).filter(Boolean)
    : [];

  return { field: String(field), points };
}

function normalizeResponse(raw) {
  if (raw && typeof raw === 'object' && Array.isArray(raw.series)) {
    const series = raw.series.map(normalizeEntry).filter(Boolean);
    return { series };
  }

  if (Array.isArray(raw)) {
    return { series: raw.map(normalizeEntry).filter(Boolean) };
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw).map(([field, points]) =>
      normalizeEntry({ field, points })
    );
    return { series: entries.filter(Boolean) };
  }

  return { series: [] };
}

function summarizeSeries(series) {
  let pointsCount = 0;
  let nonZeroCount = 0;
  let min = null;
  let max = null;
  let firstTimestamp = null;
  let lastTimestamp = null;

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
      if (point.value !== null && point.value !== undefined) {
        if (point.value !== 0) nonZeroCount += 1;
        if (min === null || point.value < min) min = point.value;
        if (max === null || point.value > max) max = point.value;
      }
    });
  });

  return { pointsCount, nonZeroCount, min, max, firstTimestamp, lastTimestamp };
}

function formatSummary(label, payload) {
  const lines = [];
  lines.push(`${label}:`);
  lines.push(
    `  status=${payload.status} points=${payload.stats.pointsCount} nonZero=${payload.stats.nonZeroCount}`
  );
  lines.push(`  elapsedMs=${payload.elapsedMs ?? 'n/a'}`);
  lines.push(
    `  first=${payload.stats.firstTimestamp || 'n/a'} last=${payload.stats.lastTimestamp || 'n/a'}`
  );
  lines.push(`  min=${payload.stats.min ?? 'n/a'} max=${payload.stats.max ?? 'n/a'}`);
  console.log(lines.join('\n'));
}

function resolveFieldMeta(field, args) {
  const defaults = DEFAULT_FIELD_META[field] || {};
  const unit = args.unit ?? defaults.unit ?? 'A';
  const decimals = parseNonNegativeNumber(args.decimals, defaults.decimals);
  const displayName = args.displayName ?? defaults.displayName ?? field;
  const propertyName = args.propertyName ?? defaults.propertyName ?? '';
  return { unit, decimals, displayName, propertyName };
}

async function callVendor({
  url,
  apiKey,
  payload,
  timeoutMs,
}) {
  const started = Date.now();
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      accept: 'text/plain',
      'content-type': 'application/json-patch+json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify(payload),
  }, timeoutMs);
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text || {};
  }
  const normalized = normalizeResponse(parsed);
  const stats = summarizeSeries(normalized.series);
  return { status: res.status, elapsedMs, stats, series: normalized.series, raw: parsed };
}

async function callProxy({
  url,
  token,
  body,
  timeoutMs,
}) {
  const started = Date.now();
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  const elapsedMs = Date.now() - started;
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
    parsed = {};
  }
  const normalized = normalizeResponse(parsed);
  const stats = summarizeSeries(normalized.series);
  return { status: res.status, elapsedMs, stats, series: normalized.series, raw: parsed };
}

function resolveWindow({ fromArg, toArg, hours }) {
  if (fromArg && toArg) return { from: fromArg, to: toArg };
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mac = (args.mac || process.env.DEMO_DEVICE_MAC || DEFAULT_MAC).trim();
  const field = (args.field || DEFAULT_FIELD).trim();
  const fieldMeta = resolveFieldMeta(field, args);
  const hours = parseNumber(args.hours, 6);
  const timeoutMs = parseNumber(process.env.HEATPUMP_HISTORY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxRangeHours = parseNumber(
    process.env.HEATPUMP_HISTORY_MAX_RANGE_HOURS,
    DEFAULT_MAX_RANGE_HOURS
  );
  const pageHours = parseNumber(process.env.HEATPUMP_HISTORY_PAGE_HOURS, DEFAULT_PAGE_HOURS);
  const disabled = process.env.HEATPUMP_HISTORY_DISABLED === 'true';
  const url =
    normalizeEnvValue('HEATPUMP_HISTORY_URL', 'HEAT_PUMP_HISTORY_URL') || DEFAULT_URL;
  const apiKey = normalizeEnvValue('HEATPUMP_HISTORY_API_KEY', 'HEAT_PUMP_HISTORY_API_KEY');
  const configured = !disabled && Boolean(url && apiKey);
  const windowHours = Math.min(hours, maxRangeHours);
  if (hours > maxRangeHours) {
    console.warn(
      `Requested window ${hours}h exceeds max ${maxRangeHours}h; clamped to ${windowHours}h`
    );
  }
  const window = resolveWindow({ fromArg: args.from, toArg: args.to, hours: windowHours });

  console.log(
    JSON.stringify(
      {
        url,
        hasApiKey: Boolean(apiKey),
        disabled,
        timeoutMs,
        maxRangeHours,
        pageHours,
        mac,
        field,
        fieldMeta,
        window,
      },
      null,
      2
    )
  );

  const vendorPayload = {
    aggregation: 'raw',
    mode: 'live',
    from: window.from,
    to: window.to,
    fields: [{ field, ...fieldMeta }],
    mac,
  };

  const vendor = await callVendor({ url, apiKey, payload: vendorPayload, timeoutMs });
  formatSummary('Vendor', vendor);

  let exitCode = vendor.status === 200 ? 0 : 1;
  if (vendor.status !== 200) {
    console.error(`Vendor call failed (status ${vendor.status})`, vendor.raw);
  }

  const proxyDeviceId = args.deviceId || process.env.DEMO_DEVICE_ID;
  const proxyUrl =
    args['proxy-url'] ||
    process.env.HEATPUMP_HISTORY_PROXY_URL ||
    'http://localhost:4000/heat-pump-history';
  const proxyToken = args.token || process.env.HEATPUMP_HISTORY_BEARER_TOKEN;

  let proxy = null;
  if (proxyDeviceId) {
    proxy = await callProxy({
      url: proxyUrl,
      token: proxyToken,
      body: { ...vendorPayload, deviceId: proxyDeviceId },
      timeoutMs,
    });
    formatSummary('Backend proxy', proxy);

    if (proxy.status !== 200) {
      exitCode = 1;
      console.error(`Proxy call failed (status ${proxy.status})`);
    }
  } else {
    console.warn('Skipping backend proxy call (no deviceId provided and DEMO_DEVICE_ID missing).');
  }

  const isRecentWindow = (() => {
    const toTs = new Date(window.to).getTime();
    const now = Date.now();
    const durationHours = (new Date(window.to).getTime() - new Date(window.from).getTime()) / 3600000;
    return Math.abs(now - toTs) < 12 * 60 * 60 * 1000 && durationHours <= 6.5;
  })();

  if (configured && isRecentWindow && vendor.stats.pointsCount > 0 && proxy) {
    if (proxy.stats.pointsCount === 0) {
      exitCode = 1;
      console.error(
        'Proxy returned no points for a recent window while vendor returned data.'
      );
    }
  }

  if (proxy && vendor.stats.pointsCount >= 0) {
    const tolerance = Math.max(3, Math.ceil(vendor.stats.pointsCount * 0.1));
    const diff = Math.abs(vendor.stats.pointsCount - proxy.stats.pointsCount);
    if (diff > tolerance) {
      exitCode = 1;
      console.error(
        `Proxy points (${proxy.stats.pointsCount}) differ from vendor (${vendor.stats.pointsCount}) by more than tolerance (${tolerance}).`
      );
    }
  }

  // Allow time for logs to flush before exiting in CI.
  if (exitCode !== 0) {
    await delay(50);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Vendor history check failed', err);
  process.exit(1);
});
