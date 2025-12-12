import type { HealthPlusPayload } from '../src/services/healthService';
import { normalizeTarget, summarizeHealthPlus } from './check-health-plus';

const DEFAULT_TARGET = 'https://staging.api.greenbro.co.za/health-plus';

function deriveHeatPumpStatus(body: HealthPlusPayload) {
  const disabled = body.heatPumpHistory?.disabled === true;
  if (disabled) return 'disabled';
  if (body.heatPumpHistory?.healthy) return 'ok';
  return 'unhealthy';
}

async function main() {
  const target = normalizeTarget(process.env.STAGING_HEALTH_URL ?? DEFAULT_TARGET);

  const response = await fetch(target, { headers: { accept: 'application/json' } });
  const body = (await response.json()) as HealthPlusPayload;
  const summary = summarizeHealthPlus(body, target);
  const heatPumpStatus = deriveHeatPumpStatus(body);

  const failures: string[] = [];
  if (!response.ok || !body.ok) failures.push('ok flag false');
  if (heatPumpStatus !== 'ok') failures.push(`heatPumpHistory.status=${heatPumpStatus}`);

  const payload = {
    target,
    ok: failures.length === 0,
    httpOk: response.ok,
    heatPumpHistory: {
      status: heatPumpStatus,
      disabled: body.heatPumpHistory?.disabled === true,
      healthy: body.heatPumpHistory?.healthy ?? null,
    },
    vendorFlags: body.vendorFlags,
    failed: failures,
    summary,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Staging health check failed', err);
  process.exit(1);
});
