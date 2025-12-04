import 'dotenv/config';

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

function resolveConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const url =
    process.env.HEATPUMP_HISTORY_URL?.trim() ||
    process.env.HEAT_PUMP_HISTORY_URL?.trim() ||
    DEFAULT_HEATPUMP_HISTORY_URL;
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

  if (!url && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_URL is required when NODE_ENV is not development');
  }

  if (!apiKey && nodeEnv !== 'development') {
    throw new Error('HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development');
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

  console.log(`\n[${label}] Sending payload:`);
  console.log(JSON.stringify(body, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await res.text().catch(() => '');
    console.log(`[${label}] Status: ${res.status} ${res.statusText ?? ''}`.trim());
    console.log(
      `[${label}] Response preview (first 500 chars): ${
        responseText ? responseText.slice(0, 500) : '<empty>'
      }`
    );
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error(`[${label}] Request aborted after ${requestTimeoutMs}ms`);
    } else {
      console.error(`[${label}] Error`, err);
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

  console.log('Debugging heat pump history payloads...', {
    url,
    hasApiKey: Boolean(apiKey),
    requestTimeoutMs,
  });

  for (const candidate of candidates) {
    await sendPayload(candidate.label, candidate.body);
  }

  console.log('\nDone probing payload shapes.');
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
