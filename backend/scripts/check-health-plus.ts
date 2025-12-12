import type { HealthPlusPayload } from '../src/services/healthService';

const DEFAULT_BASE_URL = 'http://localhost:4000';

type SubsystemSummary = {
  ok: boolean;
  detail?: string | null;
};

type HealthPlusSummary = {
  target: string;
  httpOk: boolean;
  ok: boolean;
  env?: string;
  version?: string | null;
  failed: string[];
  latencies: {
    db?: number | null;
    storage?: number | null;
    antivirus?: number | null;
  };
  vendorFlags?: HealthPlusPayload['vendorFlags'];
  perfHints?: HealthPlusPayload['perfHints'];
  subsystems: Record<string, SubsystemSummary>;
};

export function normalizeTarget(input?: string) {
  const base = (input || DEFAULT_BASE_URL).replace(/\/$/, '');
  return base.endsWith('/health-plus') ? base : `${base}/health-plus`;
}

export function summarizeHealthPlus(body: HealthPlusPayload, target: string): HealthPlusSummary {
  const subsystems: Record<string, SubsystemSummary> = {
    db: { ok: body.db === 'ok' },
    storage: { ok: body.storage?.writable !== false, detail: body.storage?.root },
    antivirus: {
      ok:
        body.antivirus?.enabled === false ||
        body.antivirus?.lastResult === 'clean' ||
        !body.antivirus?.lastResult,
      detail: body.antivirus?.lastResult,
    },
    control: {
      ok: body.control?.disabled || body.control?.healthy !== false,
      detail: body.control?.lastError,
    },
    mqtt: {
      ok: body.mqtt?.disabled || body.mqtt?.healthy !== false,
      detail: body.mqtt?.lastError,
    },
    heatPumpHistory: {
      ok: body.heatPumpHistory?.disabled || body.heatPumpHistory?.healthy !== false,
      detail: body.heatPumpHistory?.lastError,
    },
    alertsWorker: { ok: body.alertsWorker?.healthy !== false, detail: body.alertsWorker?.lastHeartbeatAt },
    push: { ok: body.push?.enabled !== true || !body.push?.lastError, detail: body.push?.lastError },
  };

  const failed = Object.entries(subsystems)
    .filter(([, value]) => !value.ok)
    .map(([key]) => key);

  const ok = body.ok && failed.length === 0;

  return {
    target,
    httpOk: true,
    ok,
    env: body.env,
    version: body.version,
    failed,
    latencies: {
      db: body.dbLatencyMs,
      storage: body.storage?.latencyMs,
      antivirus: body.antivirus?.latencyMs,
    },
    vendorFlags: body.vendorFlags,
    perfHints: body.perfHints,
    subsystems,
  };
}

async function main() {
  const targetArg = process.argv[2];
  const target = normalizeTarget(targetArg ?? process.env.HEALTH_BASE_URL ?? process.env.BASE_URL);

  try {
    const response = await fetch(target, { method: 'GET', headers: { accept: 'application/json' } });
    const bodyText = await response.text();
    let payload: HealthPlusPayload;
    try {
      payload = bodyText ? (JSON.parse(bodyText) as HealthPlusPayload) : ({} as HealthPlusPayload);
    } catch (err) {
      console.error(`Unable to parse JSON from ${target}: ${(err as Error).message}`);
      console.error(bodyText);
      process.exit(1);
      return;
    }

    const summary = summarizeHealthPlus(payload, target);
    summary.httpOk = response.ok;

    const shouldFail = !response.ok || !summary.ok;
    console.log(JSON.stringify(summary, null, 2));
    process.exit(shouldFail ? 1 : 0);
  } catch (error) {
    console.error(`Health-plus check failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
