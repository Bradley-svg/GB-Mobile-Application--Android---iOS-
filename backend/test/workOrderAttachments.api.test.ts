import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/db';

const scanFileMock = vi.fn<[string], Promise<'clean' | 'infected' | 'error'>>();

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

const WORK_ORDER_ID = '55555555-5555-5555-5555-555555555555';
const DEFAULT_USER_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_ORG_ID = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
const OTHER_USER_ID = 'cccccccc-1111-2222-3333-dddddddddddd';

let app: Express;
let token: string;
let otherOrgToken: string;
let lastScannedPath: string | null = null;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.FILE_STORAGE_ROOT =
    process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');

  await query(
    `
    insert into organisations (id, name)
    values ($1, 'Other Org')
    on conflict (id) do nothing
  `,
    [OTHER_ORG_ID]
  );
  await query(
    `
    insert into users (id, organisation_id, email, password_hash, name)
    values ($1, $2, 'other@example.com', '$2a$10$saltsaltsaltsaltsaltsal', 'Other User')
    on conflict (id) do nothing
  `,
    [OTHER_USER_ID, OTHER_ORG_ID]
  );

  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: DEFAULT_USER_ID, type: 'access' }, process.env.JWT_SECRET);
  otherOrgToken = jwt.sign({ sub: OTHER_USER_ID, type: 'access' }, process.env.JWT_SECRET);
});

beforeEach(() => {
  lastScannedPath = null;
  scanFileMock.mockReset();
  scanFileMock.mockImplementation(async (filePath: string) => {
    lastScannedPath = filePath;
    return 'clean';
  });
});

afterAll(async () => {
  const storageRoot = process.env.FILE_STORAGE_ROOT;
  if (storageRoot) {
    await fs.promises.rm(storageRoot, { recursive: true, force: true }).catch(() => {});
  }
});

describe('work order attachments API', () => {
  it('uploads and lists attachments', async () => {
    const uploadRes = await request(app)
      .post(`/work-orders/${WORK_ORDER_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), { filename: 'note.txt', contentType: 'text/plain' })
      .expect(201);

    expect(uploadRes.body.id).toBeDefined();
    expect(uploadRes.body.originalName).toBe('note.txt');
    expect(uploadRes.body.url).toContain('/files/');

    const listRes = await request(app)
      .get(`/work-orders/${WORK_ORDER_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const found = (listRes.body as Array<{ id: string }>).find(
      (att) => att.id === uploadRes.body.id
    );
    expect(found).toBeDefined();
  });

  it('rejects infected uploads and does not persist attachments', async () => {
    const beforeCountRes = await query<{ count: string }>(
      'select count(*) as count from work_order_attachments where work_order_id = $1',
      [WORK_ORDER_ID]
    );
    const beforeCount = Number(beforeCountRes.rows[0]?.count ?? 0);

    scanFileMock.mockImplementationOnce(async (filePath: string) => {
      lastScannedPath = filePath;
      return 'infected';
    });

    const uploadRes = await request(app)
      .post(`/work-orders/${WORK_ORDER_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('evil'), {
        filename: 'bad.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(uploadRes.body.code).toBe('ERR_FILE_INFECTED');

    const afterCountRes = await query<{ count: string }>(
      'select count(*) as count from work_order_attachments where work_order_id = $1',
      [WORK_ORDER_ID]
    );
    const afterCount = Number(afterCountRes.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount);
    expect(lastScannedPath).toBeTruthy();
    expect(fs.existsSync(lastScannedPath!)).toBe(false);
  });

  it('returns 503 on scanner errors without persisting attachments', async () => {
    const beforeCountRes = await query<{ count: string }>(
      'select count(*) as count from work_order_attachments where work_order_id = $1',
      [WORK_ORDER_ID]
    );
    const beforeCount = Number(beforeCountRes.rows[0]?.count ?? 0);

    scanFileMock.mockImplementationOnce(async (filePath: string) => {
      lastScannedPath = filePath;
      return 'error';
    });

    const uploadRes = await request(app)
      .post(`/work-orders/${WORK_ORDER_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('broken'), {
        filename: 'scan-error.txt',
        contentType: 'text/plain',
      })
      .expect(503);

    expect(uploadRes.body.code).toBe('ERR_FILE_SCAN_FAILED');

    const afterCountRes = await query<{ count: string }>(
      'select count(*) as count from work_order_attachments where work_order_id = $1',
      [WORK_ORDER_ID]
    );
    const afterCount = Number(afterCountRes.rows[0]?.count ?? 0);
    expect(afterCount).toBe(beforeCount);
    expect(lastScannedPath).toBeTruthy();
    expect(fs.existsSync(lastScannedPath!)).toBe(false);
  });

  it('enforces organisation scoping', async () => {
    await request(app)
      .get(`/work-orders/${WORK_ORDER_ID}/attachments`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .expect(404);
  });
});
