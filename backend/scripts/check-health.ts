const DEFAULT_BASE_URL = 'http://localhost:4000';

type HealthResponse = {
  ok?: boolean;
  env?: string;
  version?: string;
  db?: string;
  mqtt?: Record<string, unknown>;
  control?: Record<string, unknown>;
  heatPumpHistory?: Record<string, unknown>;
  alertsWorker?: Record<string, unknown>;
  push?: Record<string, unknown>;
};

type SubsystemSummary = {
  configured?: unknown;
  healthy?: unknown;
  lastSuccessAt?: unknown;
  lastError?: unknown;
};

function summarizeSubsystem(block?: Record<string, unknown>): SubsystemSummary | undefined {
  if (!block) {
    return undefined;
  }

  const lastSuccessAt =
    block.lastSuccessAt ??
    block.lastIngestAt ??
    block.lastHeartbeatAt ??
    block.lastCommandAt ??
    undefined;

  return {
    configured: block.configured,
    healthy: block.healthy,
    lastSuccessAt,
    lastError: block.lastError,
  };
}

async function main() {
  const baseUrl = (process.env.HEALTH_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = `${baseUrl}/health-plus`;

  try {
    const response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
    const bodyText = await response.text();

    if (!response.ok) {
      console.error(`Health check failed with HTTP ${response.status} for ${url}`);
      if (bodyText) {
        console.error(bodyText);
      }
      process.exit(1);
    }

    let payload: HealthResponse;
    try {
      payload = bodyText ? (JSON.parse(bodyText) as HealthResponse) : {};
    } catch (error) {
      console.error(`Unable to parse JSON from ${url}: ${(error as Error).message}`);
      console.error(bodyText);
      process.exit(1);
    }

    if (payload.ok !== true) {
      console.error('Health check returned ok !== true');
      console.error(JSON.stringify(payload, null, 2));
      process.exit(1);
    }

    const summary = {
      target: url,
      env: payload.env,
      version: payload.version,
      db: payload.db,
      mqtt: summarizeSubsystem(payload.mqtt),
      control: summarizeSubsystem(payload.control),
      heatPumpHistory: summarizeSubsystem(payload.heatPumpHistory),
      alertsWorker: summarizeSubsystem(payload.alertsWorker),
      push: summarizeSubsystem(payload.push),
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Health check failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
