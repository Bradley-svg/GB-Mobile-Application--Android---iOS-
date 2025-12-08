import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';

const DEFAULT_USER_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_USER_ID = '55555555-aaaa-bbbb-cccc-dddddddddddd';
const OTHER_ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const ATTACHMENT_PATH =
  'work-orders/11111111-1111-1111-1111-111111111111/55555555-5555-5555-5555-555555555555/pump-photo.jpg';
const DOCUMENT_PATH =
  'documents/11111111-1111-1111-1111-111111111111/site/22222222-2222-2222-2222-222222222222/manual.pdf';

let app: Express;
let token: string;
let otherOrgToken: string;
let storageRoot: string;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  storageRoot = process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');
  process.env.FILE_STORAGE_ROOT = storageRoot;

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
    insert into users (id, organisation_id, email, password_hash, name, role)
    values ($1, $2, 'other-org@example.com', '$2a$10$saltsaltsaltsaltsaltsal', 'Other Org User', 'facilities')
    on conflict (id) do nothing
  `,
    [OTHER_USER_ID, OTHER_ORG_ID]
  );

  const attachmentLocation = path.join(storageRoot, ATTACHMENT_PATH);
  const documentLocation = path.join(storageRoot, DOCUMENT_PATH);
  await fs.promises.mkdir(path.dirname(attachmentLocation), { recursive: true });
  await fs.promises.mkdir(path.dirname(documentLocation), { recursive: true });
  await fs.promises.writeFile(attachmentLocation, 'seeded attachment body');
  await fs.promises.writeFile(documentLocation, 'seeded document body');

  const mod = await import('../src/index');
  app = mod.default;

  token = jwt.sign({ sub: DEFAULT_USER_ID, type: 'access', role: 'facilities' }, process.env.JWT_SECRET);
  otherOrgToken = jwt.sign(
    { sub: OTHER_USER_ID, type: 'access', role: 'facilities' },
    process.env.JWT_SECRET
  );
});

describe('secured files API', () => {
  it('lets users download their own attachment', async () => {
    const res = await request(app)
      .get(`/files/${ATTACHMENT_PATH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.text).toBe('seeded attachment body');
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('lets users download their own document', async () => {
    const res = await request(app)
      .get(`/files/${DOCUMENT_PATH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.text).toBe('seeded document body');
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('hides files from other organisations', async () => {
    await request(app)
      .get(`/files/${ATTACHMENT_PATH}`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .expect(404);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app).get(`/files/${ATTACHMENT_PATH}`).expect(401);
  });
});
