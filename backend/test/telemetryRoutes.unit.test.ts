import { describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

async function loadTelemetryRoutes() {
  vi.resetModules();
  return import('../src/routes/telemetryRoutes');
}

describe('telemetryRoutes configuration', () => {
  it('disables HTTP ingest when no API key is set', async () => {
    delete process.env.TELEMETRY_API_KEY;
    const mod = await loadTelemetryRoutes();
    expect(mod.TELEMETRY_HTTP_ENABLED).toBe(false);
  });

  it('enables HTTP ingest when API key is configured', async () => {
    process.env.TELEMETRY_API_KEY = 'secret-key';
    const mod = await loadTelemetryRoutes();
    expect(mod.TELEMETRY_HTTP_ENABLED).toBe(true);
    expect(mod.TELEMETRY_HTTP_KEY).toBe('secret-key');
  });
});
