import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/db';

const scanFileMock = vi.fn<[string], Promise<'clean' | 'infected' | 'scan_failed'>>();

vi.mock('../src/services/virusScanner', () => ({
  scanFile: (...args: unknown[]) => scanFileMock(...(args as [string])),
  getVirusScannerStatus: () => ({
    configured: false,
    enabled: false,
    target: null,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
  }),
}));

const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';

let app: Express;
let token: string;
let contractorToken: string;
let lastScannedPath: string | null = null;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.FILE_STORAGE_ROOT =
    process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');

  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: USER_ID, type: 'access' }, process.env.JWT_SECRET);
  contractorToken = jwt.sign({ sub: USER_ID, type: 'access', role: 'contractor' }, process.env.JWT_SECRET);
});

beforeEach(async () => {
  lastScannedPath = null;
  scanFileMock.mockReset();
  scanFileMock.mockImplementation(async (filePath: string) => {
    lastScannedPath = filePath;
    return 'clean';
  });

  await query('delete from audit_events');
});

afterAll(async () => {
  const storageRoot = process.env.FILE_STORAGE_ROOT;
  if (storageRoot) {
    await fs.promises.rm(storageRoot, { recursive: true, force: true }).catch(() => {});
  }
});

describe('documents API', () => {
  it('lists documents for a site and device', async () => {
    const siteRes = await request(app)
      .get(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(siteRes.body)).toBe(true);
    expect(siteRes.body[0]).toHaveProperty('title');
    expect(siteRes.body[0]).toHaveProperty('url');

    const deviceRes = await request(app)
      .get(`/devices/${DEVICE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(deviceRes.body)).toBe(true);
  });

  it('accepts uploads for a site', async () => {
    const uploadRes = await request(app)
      .post(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Upload test')
      .field('category', 'manual')
      .attach('file', Buffer.from('doc body'), { filename: 'upload.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(uploadRes.body.title).toBe('Upload test');
    expect(uploadRes.body.url).toContain('/files/');
    const auditEvents = await query<{ action: string; entity_type: string }>(
      'select action, entity_type from audit_events order by created_at asc'
    );
    expect(auditEvents.rows.map((row) => row.action)).toEqual(['file_upload_success']);
    expect(auditEvents.rows[0]?.entity_type).toBe('document');
  });

  it('rejects infected uploads and does not persist documents', async () => {
    const beforeCountRes = await query<{ count: string }>(
      'select count(*) as count from documents where site_id = $1',
      [SITE_ID]
    );
    const beforeCount = Number(beforeCountRes.rows[0]?.count ?? 0);

    scanFileMock.mockImplementationOnce(async (filePath: string) => {
      lastScannedPath = filePath;
      return 'infected';
    });

    const res = await request(app)
      .post(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('infected body'), {
        filename: 'virus.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(res.body.code).toBe('ERR_FILE_INFECTED');

    const afterCountRes = await query<{ count: string }>(
      'select count(*) as count from documents where site_id = $1',
      [SITE_ID]
    );
    const afterCount = Number(afterCountRes.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount);
    expect(lastScannedPath).toBeTruthy();
    expect(fs.existsSync(lastScannedPath!)).toBe(false);

    const auditEvents = await query<{ action: string }>(
      'select action from audit_events order by created_at asc'
    );
    expect(auditEvents.rows.map((row) => row.action)).toEqual(['file_upload_failure']);
  });

  it('returns 503 and discards files when the scanner errors', async () => {
    const beforeCountRes = await query<{ count: string }>(
      'select count(*) as count from documents where site_id = $1',
      [SITE_ID]
    );
    const beforeCount = Number(beforeCountRes.rows[0]?.count ?? 0);

    scanFileMock.mockImplementationOnce(async (filePath: string) => {
      lastScannedPath = filePath;
      return 'scan_failed';
    });

    const res = await request(app)
      .post(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('unscannable'), {
        filename: 'scan-error.pdf',
        contentType: 'application/pdf',
      })
      .expect(503);

    expect(res.body.code).toBe('ERR_FILE_SCAN_FAILED');

    const afterCountRes = await query<{ count: string }>(
      'select count(*) as count from documents where site_id = $1',
      [SITE_ID]
    );
    const afterCount = Number(afterCountRes.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount);
    expect(lastScannedPath).toBeTruthy();
    expect(fs.existsSync(lastScannedPath!)).toBe(false);

    const auditEvents = await query<{ action: string }>(
      'select action from audit_events order by created_at asc'
    );
    expect(auditEvents.rows.map((row) => row.action)).toEqual(['file_upload_failure']);
  });

  it('blocks contractors from listing or uploading documents', async () => {
    await request(app)
      .get(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${contractorToken}`)
      .expect(403);

    await request(app)
      .post(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${contractorToken}`)
      .attach('file', Buffer.from('denied'), {
        filename: 'denied.txt',
        contentType: 'text/plain',
      })
      .expect(403);

    const audits = await query<{ count: string }>('select count(*) as count from audit_events');
    expect(Number(audits.rows[0]?.count ?? 0)).toBe(0);
  });
});
