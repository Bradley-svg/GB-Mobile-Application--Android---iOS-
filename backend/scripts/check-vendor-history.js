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
 *  --probe                (enables curated multi-field probing)
 *  --window 15m|1h|6h|24h (default 6h; --hours kept for legacy)
 *  --hours <n>            (legacy window hours)
 *  --short-window-sanity  (also run a 15m window before the requested one)
 *  --from <iso>           (optional)
 *  --to <iso>             (optional)
 *  --deviceId <id>        (optional; enables proxy check)
 *  --proxy-url <url>      (override proxy URL)
 *  --token <bearer>       (override bearer token for proxy)
 */
const { setTimeout: delay } = require('timers/promises');
const {
  summarizeSeriesCollection,
  findFirstNonZeroField,
} = require('./vendorHistorySummaries');

const DEFAULT_URL =
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
const DEFAULT_MAC = '38:18:2B:60:A9:94';
const DEFAULT_FIELD = 'metric_compCurrentA';
const FIELD_META = {
  metric_compCurrentA: {
    unit: 'A',
    decimals: 1,
    displayName: 'Compressor current',
    propertyName: '',
  },
  metric_compFreqHz: {
    unit: 'Hz',
    decimals: 1,
    displayName: 'Compressor freq',
    propertyName: '',
  },
  metric_powerW: {
    unit: 'W',
    decimals: 0,
    displayName: 'Power',
    propertyName: '',
  },
  metric_flowLpm: {
    unit: 'L/min',
    decimals: 1,
    displayName: 'Flow',
    propertyName: '',
  },
  metric_tankTempC: {
    unit: 'C',
    decimals: 1,
    displayName: 'Tank temp',
    propertyName: '',
  },
  metric_dhwTempC: {
    unit: 'C',
    decimals: 1,
    displayName: 'DHW temp',
    propertyName: '',
  },
  metric_ambientTempC: {
    unit: 'C',
    decimals: 1,
    displayName: 'Ambient temp',
    propertyName: '',
  },
  metric_supplyTempC: {
    unit: 'C',
    decimals: 1,
    displayName: 'Supply temp',
    propertyName: '',
  },
  metric_returnTempC: {
    unit: 'C',
    decimals: 1,
    displayName: 'Return temp',
    propertyName: '',
  },
};
const PROBE_FIELD_ORDER = [
  'metric_compCurrentA',
  'metric_compFreqHz',
  'metric_powerW',
  'metric_flowLpm',
  'metric_tankTempC',
  'metric_dhwTempC',
  'metric_ambientTempC',
  'metric_supplyTempC',
  'metric_returnTempC',
];
const WINDOW_PRESETS = {
  '15m': 0.25,
  '1h': 1,
  '6h': 6,
  '24h': 24,
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

function parseWindowArg(windowArg, hoursArg) {
  if (windowArg) {
    const normalized = String(windowArg).toLowerCase();
    if (WINDOW_PRESETS[normalized]) {
      return { label: normalized, hours: WINDOW_PRESETS[normalized] };
    }
    const match = normalized.match(/^(\d+(?:\.\d+)?)h$/);
    if (match) {
      const hours = Number(match[1]);
      if (Number.isFinite(hours) && hours > 0) return { label: `${hours}h`, hours };
    }
    const directHours = Number(normalized);
    if (Number.isFinite(directHours) && directHours > 0) {
      return { label: `${directHours}h`, hours: directHours };
    }
  }
  const hours = parseNumber(hoursArg, 6);
  return { label: `${hours}h`, hours };
}

function buildWindowSpecs({ args, maxRangeHours }) {
  if (args.from && args.to) {
    return [{ label: 'custom', hours: null, fromArg: args.from, toArg: args.to }];
  }
  const base = parseWindowArg(args.window, args.hours);
  const windows = [base];
  if (args['short-window-sanity']) {
    const short = { label: '15m', hours: WINDOW_PRESETS['15m'] };
    if (!windows.some((w) => w.label === short.label)) {
      windows.unshift(short);
    }
  }
  return windows.map((spec) => {
    const hours = spec.hours === null ? null : Math.min(spec.hours, maxRangeHours);
    const clampedLabel =
      spec.hours !== null && spec.hours > maxRangeHours
        ? `${spec.label} (clamped to ${hours}h)`
        : spec.label;
    return { ...spec, hours, label: clampedLabel };
  });
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
    numericValue = Number.isFinite(value) ? value : null;
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
    obj.points ??
    obj.values ??
    obj.data ??
    obj.items ??
    obj.readings ??
    obj.samples ??
    obj.series;

  if (!field) return null;

  const points = Array.isArray(rawPoints)
    ? rawPoints.map(normalizePoint).filter(Boolean)
    : [];

  return { field: String(field), points };
}

function normalizeResponse(raw) {
  const normalizeArray = (arr) => arr.map(normalizeEntry).filter(Boolean);

  if (raw && typeof raw === 'object') {
    const obj = raw;
    if (Array.isArray(obj.series)) {
      return { series: normalizeArray(obj.series) };
    }
    if (Array.isArray(obj.data)) {
      return { series: normalizeArray(obj.data) };
    }
    if (obj.data && typeof obj.data === 'object') {
      const dataObj = obj.data;
      if (Array.isArray(dataObj.series)) {
        return { series: normalizeArray(dataObj.series) };
      }
      if (Array.isArray(dataObj.data)) {
        return { series: normalizeArray(dataObj.data) };
      }
      const entries = Object.entries(dataObj).map(([field, points]) =>
        normalizeEntry({ field, points })
      );
      return { series: entries.filter(Boolean) };
    }
  }

  if (Array.isArray(raw)) {
    return { series: normalizeArray(raw) };
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw).map(([field, points]) =>
      normalizeEntry({ field, points })
    );
    return { series: entries.filter(Boolean) };
  }

  return { series: [] };
}

function resolveFieldMeta(field, args) {
  const defaults = FIELD_META[field] || {};
  const unit = args.unit ?? defaults.unit ?? '';
  const decimals = parseNonNegativeNumber(
    args.decimals,
    defaults.decimals !== undefined ? defaults.decimals : 1
  );
  const displayName = args.displayName ?? defaults.displayName ?? field;
  const propertyName = args.propertyName ?? defaults.propertyName ?? '';
  return { unit, decimals, displayName, propertyName };
}

function resolveFields(args) {
  const baseField = (args.field || DEFAULT_FIELD).trim();
  const probe = Boolean(args.probe);
  const order = probe ? [baseField, ...PROBE_FIELD_ORDER] : [baseField];
  const seen = new Set();
  const fields = order.filter((f) => {
    const normalized = f.trim();
    if (!normalized) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  return fields.map((field) => ({ field, ...resolveFieldMeta(field, args) }));
}

function resolveWindow({ fromArg, toArg, hours }) {
  if (fromArg && toArg) return { from: fromArg, to: toArg };
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatSample(summary) {
  if (!summary.sample.length) return 'sample=[]';
  const pairs = summary.sample
    .slice(0, 3)
    .map((point) => `${point.timestamp}:${point.value ?? 'null'}`)
    .join(' | ');
  return `sample=[${pairs}]`;
}

function formatSummary(label, payload, windowLabel) {
  const lines = [];
  const agg = payload.summary.aggregate;
  lines.push(
    `${label} [${windowLabel}] status=${payload.status} points=${agg.pointsCount} nonZero=${agg.nonZeroCount} min=${agg.min ?? 'n/a'} max=${agg.max ?? 'n/a'} first=${agg.firstTimestamp || 'n/a'} last=${agg.lastTimestamp || 'n/a'} elapsedMs=${payload.elapsedMs ?? 'n/a'}`
  );
  if (payload.summary.byField.length > 0) {
    const fieldSummaries = payload.summary.byField
      .map(
        (entry) =>
          `${entry.field}{points=${entry.pointsCount},nonZero=${entry.nonZeroCount},min=${entry.min ?? 'n/a'},max=${entry.max ?? 'n/a'},first=${entry.firstTimestamp || 'n/a'},last=${entry.lastTimestamp || 'n/a'},${formatSample(entry)}}`
      )
      .join('; ');
    lines.push(`  fields ${fieldSummaries}`);
  }
  console.log(lines.join('\n'));
}

async function callVendor({ url, apiKey, payload, timeoutMs }) {
  const started = Date.now();
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        accept: 'text/plain',
        'content-type': 'application/json-patch+json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text || {};
  }
  const normalized = normalizeResponse(parsed);
  const summary = summarizeSeriesCollection(normalized.series);
  return { status: res.status, elapsedMs, summary, series: normalized.series, raw: parsed };
}

async function callProxy({ url, token, body, timeoutMs }) {
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
  const summary = summarizeSeriesCollection(normalized.series);
  return { status: res.status, elapsedMs, summary, series: normalized.series, raw: parsed };
}

function isRecentWindow(windowRange) {
  const toTs = new Date(windowRange.to).getTime();
  const now = Date.now();
  const durationHours =
    (new Date(windowRange.to).getTime() - new Date(windowRange.from).getTime()) / 3600000;
  return Math.abs(now - toTs) < 12 * 60 * 60 * 1000 && durationHours <= 6.5;
}

function determineOutcome({ vendor, proxy, fieldsOrder, windowLabel }) {
  const vendorHit =
    vendor.status === 200 ? findFirstNonZeroField(vendor.summary.byField, fieldsOrder) : null;
  const proxyHit =
    proxy && proxy.status === 200 ? findFirstNonZeroField(proxy.summary.byField, fieldsOrder) : null;

  if (vendorHit || proxyHit) {
    const winner = vendorHit || proxyHit;
    const source = vendorHit ? 'vendor' : 'proxy';
    return {
      verdict: 'non-zero',
      field: winner.field,
      source,
      windowLabel,
    };
  }

  const vendorPoints = vendor.summary.aggregate.pointsCount;
  const proxyPoints = proxy?.summary.aggregate.pointsCount ?? 0;
  const missingFields = fieldsOrder.filter(
    (field) => !vendor.summary.byField.some((entry) => entry.field === field)
  );

  if (vendorPoints === 0 && (!proxy || proxyPoints === 0)) {
    return {
      verdict: 'mismatch',
      reason: `0 points for fields [${fieldsOrder.join(', ')}]${
        missingFields.length ? `; missing fields: ${missingFields.join(', ')}` : ''
      }`,
      windowLabel,
    };
  }

  return {
    verdict: 'none',
    reason: `Tried fields [${fieldsOrder.join(', ')}]; all numeric values were zero across ${vendorPoints} vendor points${
      proxy ? ` and ${proxyPoints} proxy points` : ''
    }`,
    windowLabel,
  };
}

function buildOutcomeLine(outcome) {
  if (outcome.verdict === 'non-zero') {
    return `✅ NON-ZERO CONFIRMED via ${outcome.source} field ${outcome.field} (${outcome.windowLabel})`;
  }
  if (outcome.verdict === 'mismatch') {
    return `⚠️ FIELD/MAC MISMATCH SUSPECTED (${outcome.windowLabel}): ${outcome.reason}`;
  }
  return `❌ NO NON-ZERO DATA FOUND (${outcome.windowLabel}): ${outcome.reason}`;
}

function reportShortWindowMismatch(results) {
  const short = results.find((r) => r.windowLabel.startsWith('15m'));
  const long = results.find((r) => !r.windowLabel.startsWith('15m'));
  if (short && long && short.outcome.verdict === 'non-zero' && long.outcome.verdict !== 'non-zero') {
    console.log(
      `⚠️ Short window sanity: 15m was non-zero on ${short.outcome.field} via ${short.outcome.source}, but ${long.windowLabel} remained zero-only`
    );
  }
}

function formatSanitizedPayload({ url, apiKey, payload, proxyUrl, proxyToken, fields }) {
  console.log(
    JSON.stringify(
      {
        vendorUrl: url,
        hasApiKey: Boolean(apiKey),
        proxyUrl,
        hasProxyToken: Boolean(proxyToken),
        mac: payload.mac,
        window: { from: payload.from, to: payload.to },
        fields,
        aggregation: payload.aggregation,
        mode: payload.mode,
      },
      null,
      2
    )
  );
}

async function runForWindow({
  windowSpec,
  args,
  url,
  apiKey,
  timeoutMs,
  proxyUrl,
  proxyToken,
  proxyDeviceId,
}) {
  const fields = resolveFields(args);
  const windowRange =
    windowSpec.fromArg && windowSpec.toArg
      ? { from: windowSpec.fromArg, to: windowSpec.toArg }
      : resolveWindow({
          fromArg: args.from,
          toArg: args.to,
          hours: windowSpec.hours ?? parseNumber(args.hours, 6),
        });

  const vendorPayload = {
    aggregation: 'raw',
    mode: 'live',
    from: windowRange.from,
    to: windowRange.to,
    fields,
    mac: (args.mac || process.env.DEMO_DEVICE_MAC || DEFAULT_MAC).trim(),
  };

  formatSanitizedPayload({
    url,
    apiKey,
    payload: vendorPayload,
    proxyUrl,
    proxyToken,
    fields: vendorPayload.fields,
  });

  const vendor = await callVendor({ url, apiKey, payload: vendorPayload, timeoutMs });
  formatSummary('Vendor', vendor, windowSpec.label);

  let exitCode = vendor.status === 200 ? 0 : 1;
  if (vendor.status !== 200) {
    console.error(`Vendor call failed (status ${vendor.status})`, vendor.raw);
  }

  let proxy = null;
  if (proxyDeviceId) {
    proxy = await callProxy({
      url: proxyUrl,
      token: proxyToken,
      body: { ...vendorPayload, deviceId: proxyDeviceId },
      timeoutMs,
    });
    formatSummary('Backend proxy', proxy, windowSpec.label);

    if (proxy.status !== 200) {
      exitCode = 1;
      console.error(`Proxy call failed (status ${proxy.status})`);
    }
  } else {
    console.warn('Skipping backend proxy call (no deviceId provided and DEMO_DEVICE_ID missing).');
  }

  if (proxy && vendor.status === 200) {
    const vendorPoints = vendor.summary.aggregate.pointsCount;
    const proxyPoints = proxy.summary.aggregate.pointsCount;
    const tolerance = Math.max(3, Math.ceil(vendorPoints * 0.1));
    const diff = Math.abs(vendorPoints - proxyPoints);
    if (diff > tolerance) {
      exitCode = 1;
      console.error(
        `Proxy points (${proxyPoints}) differ from vendor (${vendorPoints}) by more than tolerance (${tolerance}).`
      );
    }
  }

  if (proxy && vendor.status === 200 && vendor.summary.aggregate.pointsCount > 0) {
    if (isRecentWindow(windowRange) && proxy.summary.aggregate.pointsCount === 0) {
      exitCode = 1;
      console.error(
        'Proxy returned no points for a recent window while vendor returned data.'
      );
    }
  }

  const outcome = determineOutcome({
    vendor,
    proxy,
    fieldsOrder: fields.map((f) => f.field),
    windowLabel: windowSpec.label,
  });
  console.log(buildOutcomeLine(outcome));

  return { outcome, vendor, proxy, exitCode, windowRange, fieldsOrder: fields.map((f) => f.field) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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

  const proxyDeviceId = args.deviceId || process.env.DEMO_DEVICE_ID;
  const proxyUrl =
    args['proxy-url'] ||
    process.env.HEATPUMP_HISTORY_PROXY_URL ||
    'http://localhost:4000/heat-pump-history';
  const proxyToken = args.token || process.env.HEATPUMP_HISTORY_BEARER_TOKEN;

  console.log(
    JSON.stringify(
      {
        url,
        hasApiKey: Boolean(apiKey),
        disabled,
        timeoutMs,
        maxRangeHours,
        pageHours,
        mac: (args.mac || process.env.DEMO_DEVICE_MAC || DEFAULT_MAC).trim(),
        field: (args.field || DEFAULT_FIELD).trim(),
        probe: Boolean(args.probe),
        window: args.window || `${parseNumber(args.hours, 6)}h`,
      },
      null,
      2
    )
  );

  const windows = buildWindowSpecs({ args, maxRangeHours });
  const results = [];
  let exitCode = 0;

  for (const windowSpec of windows) {
    const result = await runForWindow({
      windowSpec,
      args,
      url,
      apiKey,
      timeoutMs,
      proxyUrl,
      proxyToken,
      proxyDeviceId,
    });
    results.push(result);
    if (result.exitCode !== 0) {
      exitCode = result.exitCode;
    }
  }

  if (args['short-window-sanity']) {
    reportShortWindowMismatch(results);
  }

  if (configured && exitCode !== 0) {
    await delay(50);
  }

  process.exit(exitCode);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Vendor history check failed', err);
    process.exit(1);
  });
}

module.exports = {
  buildWindowSpecs,
  determineOutcome,
  normalizeResponse,
  resolveFieldMeta,
  resolveFields,
};
