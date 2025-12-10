import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDeviceCode, DeviceCodeParseError } from '../deviceCodeParser';
import { lookupDeviceByCode, DeviceQrLookupError } from '../qrLookupService';

const findDeviceSummaryByIdMock = vi.fn();
const findDeviceByMacMock = vi.fn();
const recordAuditEventMock = vi.fn();
const resolveOrganisationIdMock = vi.fn();

vi.mock('../../../repositories/devicesRepository', () => ({
  findDeviceSummaryById: (...args: unknown[]) => findDeviceSummaryByIdMock(...args),
  findDeviceByMac: (...args: unknown[]) => findDeviceByMacMock(...args),
}));

vi.mock('../../audit/auditService', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args),
}));

vi.mock('../../../controllers/organisation', () => ({
  resolveOrganisationId: (...args: unknown[]) => resolveOrganisationIdMock(...args),
}));

// Prevent accidental DB access when importing the app in route tests.
vi.mock('../../../config/db', () => ({
  query: () => Promise.resolve({ rows: [], rowCount: 0 }),
}));

describe('deviceCodeParser', () => {
  it('parses device:<uuid> codes', () => {
    const result = parseDeviceCode('device:33333333-3333-3333-3333-333333333333');
    expect(result).toEqual({ kind: 'deviceId', deviceId: '33333333-3333-3333-3333-333333333333' });
  });

  it('parses mac:<mac> codes and normalises formatting', () => {
    const result = parseDeviceCode('mac:38-18-2b-60-a9-94');
    expect(result).toEqual({ kind: 'mac', mac: '38:18:2B:60:A9:94' });
  });

  it('throws on malformed codes', () => {
    expect(() => parseDeviceCode('device:not-a-uuid')).toThrow(DeviceCodeParseError);
    expect(() => parseDeviceCode('')).toThrow(DeviceCodeParseError);
  });
});

describe('lookupDeviceByCode service', () => {
  const device = {
    id: '33333333-3333-3333-3333-333333333333',
    site_id: '22222222-2222-2222-2222-222222222222',
    name: 'Demo Heat Pump',
    site_name: 'Demo Site',
    status: 'online',
    mac: '38:18:2B:60:A9:94',
    last_seen_at: new Date('2025-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    findDeviceSummaryByIdMock.mockReset();
    findDeviceByMacMock.mockReset();
    recordAuditEventMock.mockReset();
    resolveOrganisationIdMock.mockReset();

    findDeviceSummaryByIdMock.mockResolvedValue(device);
    findDeviceByMacMock.mockResolvedValue(device);
    recordAuditEventMock.mockResolvedValue(undefined);
  });

  it('looks up devices by id for allowed roles', async () => {
    const result = await lookupDeviceByCode({
      code: `device:${device.id}`,
      orgId: 'org-1',
      userId: 'user-1',
      userRole: 'owner',
    });

    expect(result).toEqual(device);
    expect(findDeviceSummaryByIdMock).toHaveBeenCalledWith(device.id, 'org-1');
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'device_qr_lookup',
        orgId: 'org-1',
        userId: 'user-1',
        entityId: device.id,
        metadata: expect.objectContaining({ result: 'found', codeKind: 'deviceId' }),
      })
    );
  });

  it('rejects contractor roles', async () => {
    await expect(
      lookupDeviceByCode({
        code: `device:${device.id}`,
        orgId: 'org-1',
        userId: 'user-contract',
        userRole: 'contractor',
      })
    ).rejects.toMatchObject({ reason: 'FORBIDDEN' as DeviceQrLookupError['reason'] });

    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ result: 'forbidden', role: 'contractor' }),
      })
    );
    expect(findDeviceSummaryByIdMock).not.toHaveBeenCalled();
  });

  it('returns not found when no matching device exists', async () => {
    findDeviceSummaryByIdMock.mockResolvedValueOnce(null);

    await expect(
      lookupDeviceByCode({
        code: 'device:44444444-4444-4444-4444-444444444444',
        orgId: 'org-1',
        userId: 'user-1',
        userRole: 'admin',
      })
    ).rejects.toMatchObject({ reason: 'NOT_FOUND' as DeviceQrLookupError['reason'] });

    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ result: 'not_found', codeKind: 'deviceId' }),
      })
    );
  });
});

describe('POST /devices/lookup-by-code route', () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    const mod = await import('../../../index');
    app = mod.default;
    token = jwt.sign({ sub: 'user-1', type: 'access', role: 'owner' }, process.env.JWT_SECRET!);
  });

  beforeEach(() => {
    findDeviceSummaryByIdMock.mockReset();
    findDeviceByMacMock.mockReset();
    recordAuditEventMock.mockReset();
    resolveOrganisationIdMock.mockReset();

    findDeviceSummaryByIdMock.mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      site_id: '22222222-2222-2222-2222-222222222222',
      name: 'Demo Heat Pump',
      site_name: 'Demo Site',
      status: 'online',
      mac: '38:18:2B:60:A9:94',
      last_seen_at: new Date('2025-01-01T00:00:00.000Z'),
    });
    findDeviceByMacMock.mockResolvedValue(null);
    recordAuditEventMock.mockResolvedValue(undefined);
    resolveOrganisationIdMock.mockResolvedValue('org-1');
  });

  it('returns device summaries on success', async () => {
    const res = await request(app)
      .post('/devices/lookup-by-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'device:33333333-3333-3333-3333-333333333333' })
      .expect(200);

    expect(res.body.navigateTo).toBe('deviceDetail');
    expect(res.body.device).toMatchObject({
      id: '33333333-3333-3333-3333-333333333333',
      site_id: '22222222-2222-2222-2222-222222222222',
      site_name: 'Demo Site',
    });
  });

  it('returns 400 for malformed codes', async () => {
    const res = await request(app)
      .post('/devices/lookup-by-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'device:not-a-uuid' })
      .expect(400);

    expect(res.body.code).toBe('ERR_INVALID_DEVICE_CODE');
  });

  it('returns 403 for contractor roles', async () => {
    const contractorToken = jwt.sign(
      { sub: 'user-2', type: 'access', role: 'contractor' },
      process.env.JWT_SECRET!
    );

    await request(app)
      .post('/devices/lookup-by-code')
      .set('Authorization', `Bearer ${contractorToken}`)
      .send({ code: 'device:33333333-3333-3333-3333-333333333333' })
      .expect(403);
  });

  it('returns 404 when the service cannot find a device for the code', async () => {
    findDeviceSummaryByIdMock.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/devices/lookup-by-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'device:44444444-4444-4444-4444-444444444444' })
      .expect(404);

    expect(res.body.code).toBe('ERR_DEVICE_CODE_NOT_FOUND');
  });
});
