import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import { signFileToken } from '../src/services/fileUrlSigner';

const DEFAULT_USER_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_USER_ID = '55555555-aaaa-bbbb-cccc-dddddddddddd';
const OTHER_ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER_ORG_SITE_ID = '99999999-9999-9999-9999-999999999999';

const ATTACHMENT_PATH =
  'work-orders/11111111-1111-1111-1111-111111111111/55555555-5555-5555-5555-555555555555/pump-photo.jpg';
const ATTACHMENT_ID = '99999999-aaaa-bbbb-cccc-000000000001';
const DOCUMENT_PATH =
  'documents/11111111-1111-1111-1111-111111111111/site/22222222-2222-2222-2222-222222222222/manual.pdf';
const DOCUMENT_ID = 'dddddddd-1111-2222-3333-444444444444';
const OTHER_ORG_DOCUMENT_PATH =
  `documents/${OTHER_ORG_ID}/site/${OTHER_ORG_SITE_ID}/other-manual.pdf`;
const OTHER_ORG_DOCUMENT_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';

let app: Express;
let token: string;
let otherOrgToken: string;
let storageRoot: string;
let originalSigningSecret: string | undefined;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  storageRoot = process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');
  process.env.FILE_STORAGE_ROOT = storageRoot;
  originalSigningSecret = process.env.FILE_SIGNING_SECRET;
  process.env.FILE_SIGNING_SECRET = process.env.FILE_SIGNING_SECRET || 'test-signing-secret';

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
    insert into sites (id, organisation_id, name, city, status, last_seen_at, external_id)
    values ($1, $2, 'Other Org Site', 'Cape Town', 'healthy', now(), 'other-site-1')
    on conflict (id) do nothing
  `,
    [OTHER_ORG_SITE_ID, OTHER_ORG_ID]
  );

  await query(
    `
    insert into users (id, organisation_id, email, password_hash, name, role)
    values ($1, $2, 'other-org@example.com', '$2a$10$saltsaltsaltsaltsaltsal', 'Other Org User', 'facilities')
    on conflict (id) do nothing
  `,
    [OTHER_USER_ID, OTHER_ORG_ID]
  );
  await query(
    `
    insert into documents (
      id, org_id, site_id, device_id, title, category, description,
      filename, original_name, mime_type, size_bytes, relative_path, uploaded_by_user_id, created_at
    )
    values (
      '99999999-aaaa-bbbb-cccc-dddddddddddd',
      $1,
      $4,
      null,
      'Other org manual',
      'manual',
      null,
      'other-manual.pdf',
      'other-manual.pdf',
      'application/pdf',
      10,
      $2,
      $3,
      now()
    )
    on conflict (id) do nothing
  `,
    [OTHER_ORG_ID, OTHER_ORG_DOCUMENT_PATH, OTHER_USER_ID, OTHER_ORG_SITE_ID]
  );

  const attachmentLocation = path.join(storageRoot, ATTACHMENT_PATH);
  const documentLocation = path.join(storageRoot, DOCUMENT_PATH);
  const otherOrgDocumentLocation = path.join(storageRoot, OTHER_ORG_DOCUMENT_PATH);
  await fs.promises.mkdir(path.dirname(attachmentLocation), { recursive: true });
  await fs.promises.mkdir(path.dirname(documentLocation), { recursive: true });
  await fs.promises.mkdir(path.dirname(otherOrgDocumentLocation), { recursive: true });
  await fs.promises.writeFile(attachmentLocation, 'seeded attachment body');
  await fs.promises.writeFile(documentLocation, 'seeded document body');
  await fs.promises.writeFile(otherOrgDocumentLocation, 'other org document body');

  const mod = await import('../src/index');
  app = mod.default;

  token = jwt.sign({ sub: DEFAULT_USER_ID, type: 'access', role: 'facilities' }, process.env.JWT_SECRET);
  otherOrgToken = jwt.sign(
    { sub: OTHER_USER_ID, type: 'access', role: 'facilities' },
    process.env.JWT_SECRET
  );
});

afterAll(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.FILE_SIGNING_SECRET;
  } else {
    process.env.FILE_SIGNING_SECRET = originalSigningSecret;
  }
});

describe('secured files API', () => {
  it('lets users download their own attachment', async () => {
    const res = await request(app)
      .get(`/files/${ATTACHMENT_PATH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.text ?? res.body?.toString();
    expect(body).toBe('seeded attachment body');
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('lets users download their own document', async () => {
    const res = await request(app)
      .get(`/files/${DOCUMENT_PATH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.text ?? res.body?.toString();
    expect(body).toBe('seeded document body');
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('hides files from other organisations', async () => {
    await request(app)
      .get(`/files/${ATTACHMENT_PATH}`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .expect(404);
  });

  it('hides other-organisation documents from the current user', async () => {
    await request(app)
      .get(`/files/${OTHER_ORG_DOCUMENT_PATH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app).get(`/files/${ATTACHMENT_PATH}`).expect(401);
  });
});

describe('signed files API', () => {
  it('issues signed URLs for org users and serves files without auth', async () => {
    const res = await request(app)
      .post(`/files/${ATTACHMENT_ID}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(res.body.url).toMatch(/\/files\/signed\//);
    const url = res.body.url as string;

    const download = await request(app).get(url).expect(200);
    const body = download.text ?? download.body?.toString();
    expect(body).toBe('seeded attachment body');
    expect(download.headers['content-type']).toContain('image/jpeg');
  });

  it('rejects other-organisation users when issuing signed URLs', async () => {
    await request(app)
      .post(`/files/${DOCUMENT_ID}/signed-url`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send({})
      .expect(403);
  });

  it('fails with 503 when file signing is disabled', async () => {
    delete process.env.FILE_SIGNING_SECRET;
    const res = await request(app)
      .post(`/files/${DOCUMENT_ID}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);

    expect(res.body.code).toBe('ERR_FILE_SIGNING_DISABLED');
    process.env.FILE_SIGNING_SECRET = 'test-signing-secret';
  });

  it('returns 410 for expired tokens and 404 for invalid tokens', async () => {
    process.env.FILE_SIGNING_SECRET =
      process.env.FILE_SIGNING_SECRET || 'test-signing-secret';
    const expiredToken = signFileToken(DOCUMENT_ID, new Date(Date.now() - 5_000));
    await request(app).get(`/files/signed/${expiredToken}`).expect(410);
    await request(app).get(`/files/signed/not-a-token`).expect(404);
  });
});
