import 'dotenv/config';
import { logger } from '../config/logger';

/**
 * Debug helper to probe Azure's heat pump history API payload shape.
 * Not used in tests or CI; run manually with ts-node/ts-node-dev.
 */
const DEFAULT_HEATPUMP_HISTORY_URL =
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

type CandidatePayload = {
  label: string;
  body: unknown;
};

const log = logger.child({ module: 'debugHeatPumpHistory' });

function resolveConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const rawUrl =
    process.env.HEATPUMP_HISTORY_URL?.trim() || process.env.HEAT_PUMP_HISTORY_URL?.trim();
  const apiKey =
    process.env.HEATPUMP_HISTORY_API_KEY?.trim() ||
    process.env.HEAT_PUMP_HISTORY_API_KEY?.trim();
  const timeoutEnv =
    process.env.HEATPUMP_HISTORY_TIMEOUT_MS || process.env.HEAT_PUMP_HISTORY_TIMEOUT_MS;
  const parsedTimeout = timeoutEnv ? Number(timeoutEnv) : DEFAULT_REQUEST_TIMEOUT_MS;
  const requestTimeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const url = rawUrl || (nodeEnv === 'development' ? DEFAULT_HEATPUMP_HISTORY_URL : undefined);

  if (nodeEnv !== 'development') {
    if (!rawUrl) {
      throw new Error('HEATPUMP_HISTORY_URL is required when NODE_ENV is not development');
    }
    if (!apiKey) {
      throw new Error('HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development');
    }
  }

  if (!url) {
    throw new Error('HEATPUMP_HISTORY_URL is required');
  }

  return { url, apiKey, requestTimeoutMs };
}

function buildCandidatePayloads(from: string, to: string): CandidatePayload[] {
  const base = {
    aggregation: 'raw',
    from,
    to,
    mode: 'live',
    fields: [
      {
        field: 'metric_compCurrentA',
        unit: 'A',
        decimals: 1,
        displayName: 'Current',
        propertyName: '',
      },
    ],
    mac: '38:18:2B:60:A9:94',
  };

  // Working as of 2025-12-04: variant A succeeds (HTTP 200) against Azure; B/C/D return 400 validation errors.
  return [
    {
      label: 'A: vendor sample (aggregation as string, top-level)',
      body: base,
    },
    {
      label: 'B: nested under query (string aggregation inside query)',
      body: { query: base },
    },
    {
      label: 'C: numeric aggregation top-level, rest inside query',
      body: {
        aggregation: 0,
        query: {
          from,
          to,
          mode: 'live',
          fields: base.fields,
          mac: base.mac,
        },
      },
    },
    {
      label: 'D: numeric aggregation with query as JSON string of vendor sample',
      body: {
        aggregation: 0,
        query: JSON.stringify(base),
      },
    },
  ];
}

async function sendPayload(label: string, body: unknown) {
  const { url, apiKey, requestTimeoutMs } = resolveConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  const headers: Record<string, string> = {
    accept: 'application/json,text/plain',
    'content-type': 'application/json-patch+json',
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  log.info({ label, payload: body }, 'sending payload to heat pump history');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await res.text().catch(() => '');
    log.info(
      {
        label,
        status: res.status,
        statusText: res.statusText ?? '',
        bodyPreview: responseText ? responseText.slice(0, 500) : '<empty>',
      },
      'received response'
    );
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log.error({ label, err, requestTimeoutMs }, 'request aborted');
    } else {
      log.error({ label, err }, 'request failed');
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function run() {
  const from = '2025-12-03T08:12:46.503Z';
  const to = '2025-12-03T14:12:46.503Z';

  const candidates = buildCandidatePayloads(from, to);
  const { url, apiKey, requestTimeoutMs } = resolveConfig();

  log.info({ url, hasApiKey: Boolean(apiKey), requestTimeoutMs }, 'debugging heat pump history payloads');

  for (const candidate of candidates) {
    await sendPayload(candidate.label, candidate.body);
  }

  log.info('done probing payload shapes');
}

if (require.main === module) {
  run().catch((err) => {
    log.error({ err }, 'debug heat pump history script failed');
    process.exit(1);
  });
}
