import { describe, expect, it } from 'vitest';
import { summarizeHealthPlus, normalizeTarget } from '../scripts/check-health-plus';
import type { HealthPlusPayload } from '../src/services/healthService';

const basePayload: HealthPlusPayload = {
  ok: false,
  env: 'test',
  version: '0.8.0',
  db: 'error',
  dbLatencyMs: 42,
  vendorFlags: {
    prodLike: false,
    disabled: [],
    mqttDisabled: false,
    controlDisabled: false,
    heatPumpHistoryDisabled: false,
    pushNotificationsDisabled: false,
  },
  mqtt: {
    configured: true,
    disabled: false,
    lastIngestAt: null,
    lastErrorAt: null,
    lastError: 'mqtt failed',
    healthy: false,
  },
  control: {
    configured: true,
    disabled: false,
    lastCommandAt: null,
    lastErrorAt: null,
    lastError: null,
    healthy: true,
  },
  heatPumpHistory: {
    configured: true,
    disabled: false,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    lastCheckAt: null,
    healthy: true,
    lastRequestSummary: null,
  },
  alertsWorker: {
    healthy: true,
    lastHeartbeatAt: null,
  },
  push: {
    enabled: true,
    disabled: false,
    lastSampleAt: null,
    lastError: 'push error',
  },
  antivirus: {
    configured: true,
    enabled: true,
    target: 'command',
    lastRunAt: null,
    lastResult: 'clean',
    lastError: null,
    latencyMs: 5,
  },
  storage: {
    root: '/tmp/storage',
    writable: false,
    latencyMs: 12,
  },
  alertsEngine: {
    lastRunAt: null,
    lastDurationMs: null,
    rulesLoaded: null,
    activeAlertsTotal: null,
    activeWarning: null,
    activeCritical: null,
    activeInfo: null,
    evaluated: null,
    triggered: null,
  },
};

describe('check-health-plus script helpers', () => {
  it('normalises targets', () => {
    expect(normalizeTarget('http://localhost:4000')).toBe('http://localhost:4000/health-plus');
    expect(normalizeTarget('http://localhost:4000/health-plus')).toBe('http://localhost:4000/health-plus');
  });

  it('summarises subsystems and failures', () => {
    const summary = summarizeHealthPlus(basePayload, 'http://api.test/health-plus');
    expect(summary.target).toBe('http://api.test/health-plus');
    expect(summary.httpOk).toBe(true);
    expect(summary.ok).toBe(false);
    expect(summary.latencies.db).toBe(42);
    expect(summary.latencies.storage).toBe(12);
    expect(summary.latencies.antivirus).toBe(5);
    expect(summary.failed).toEqual(expect.arrayContaining(['db', 'mqtt', 'storage', 'push']));
    expect(summary.subsystems.db.ok).toBe(false);
    expect(summary.subsystems.push.ok).toBe(false);
  });
});
