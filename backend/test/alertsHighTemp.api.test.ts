import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const sendAlertNotificationMock = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/services/pushService', () => ({
  sendAlertNotification: (...args: unknown[]) =>
    sendAlertNotificationMock(...(args as [any])),
}));

let app: Express;
let evaluateHighTempAlerts: typeof import('../src/workers/alertsWorker').evaluateHighTempAlerts;
let token: string;
let alertsTable: any[] = [];

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';

  const workerMod = await import('../src/workers/alertsWorker');
  evaluateHighTempAlerts = workerMod.evaluateHighTempAlerts;

  const appMod = await import('../src/index');
  app = appMod.default;
  token = jwt.sign({ sub: 'user-123', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  queryMock.mockReset();
  sendAlertNotificationMock.mockReset();
  alertsTable = [];

  queryMock.mockImplementation(async (text: string, params?: any[]) => {
    if (text.includes("s.data->'raw'->'sensor'->>'supply_temperature_c'")) {
      return {
        rows: [{ id: 'device-1', site_id: 'site-1', supply_temp: 74.2 }],
        rowCount: 1,
      };
    }

    if (text.includes('from alerts') && text.includes("status = 'active'") && text.includes('limit 1')) {
      const [deviceId, type] = params ?? [];
      const existing = alertsTable.find(
        (a) => a.device_id === deviceId && a.type === type && a.status === 'active'
      );
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    }

    if (text.startsWith('\n    insert into alerts')) {
      const [siteId, deviceId, severity, type, message, now] = params ?? [];
      const timestamp = now instanceof Date ? now.toISOString() : now;
      const alert = {
        id: `alert-${alertsTable.length + 1}`,
        site_id: siteId,
        device_id: deviceId,
        severity,
        type,
        message,
        status: 'active',
        first_seen_at: timestamp,
        last_seen_at: timestamp,
        acknowledged_by: null,
        acknowledged_at: null,
        muted_until: null,
      };
      alertsTable.push(alert);
      return { rows: [alert], rowCount: 1 };
    }

    if (text.startsWith('\n    update alerts\n    set severity')) {
      const [severity, message, lastSeen, alertId] = params ?? [];
      const alert = alertsTable.find((a) => a.id === alertId);
      if (alert) {
        alert.severity = severity;
        alert.message = message;
        alert.last_seen_at =
          lastSeen instanceof Date ? lastSeen.toISOString() : (lastSeen as string);
        return { rows: [alert], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (text.includes("set status = 'cleared'")) {
      const [deviceId, type, now] = params ?? [];
      const timestamp = now instanceof Date ? now.toISOString() : now;
      alertsTable = alertsTable.map((a) =>
        a.device_id === deviceId && a.type === type
          ? { ...a, status: 'cleared', last_seen_at: timestamp }
          : a
      );
      return { rows: [], rowCount: 0 };
    }

    if (text.includes('select *') && text.includes('from alerts') && text.includes('order by')) {
      let rows = [...alertsTable];
      if (params && params.length) {
        const statusParam = params.find((p) => p === 'active' || p === 'cleared');
        if (statusParam) {
          rows = rows.filter((a) => a.status === statusParam);
        }
      }
      return { rows, rowCount: rows.length };
    }

    throw new Error(`Unexpected query: ${text}`);
  });
});

describe('high temp alerts API', () => {
  it('creates a critical alert from raw snapshot data and exposes it via /alerts', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    await evaluateHighTempAlerts(now);

    expect(queryMock).toHaveBeenCalled();
    expect(queryMock.mock.calls[0][0]).toContain(
      "s.data->'raw'->'sensor'->>'supply_temperature_c'"
    );
    expect(alertsTable).toHaveLength(1);

    const res = await request(app)
      .get('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        type: 'high_temp',
        severity: 'critical',
        device_id: 'device-1',
        site_id: 'site-1',
      }),
    ]);
  });
});
