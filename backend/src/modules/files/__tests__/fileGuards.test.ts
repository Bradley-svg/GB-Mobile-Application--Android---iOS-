import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedFileUrlHandler, serveSignedFileHandler } from '../../../controllers/filesController';
import { uploadWorkOrderAttachmentHandler } from '../../../controllers/workOrdersController';

const scanFileMock = vi.fn<(filePath: string) => Promise<'clean' | 'infected' | 'scan_failed'>>();
const getWorkOrderMock = vi.fn();
const createWorkOrderAttachmentMock = vi.fn();
const verifyFileTokenMock = vi.fn();
const signFileTokenMock = vi.fn();
const findWorkOrderAttachmentByIdMock = vi.fn();
const findDocumentByIdMock = vi.fn();
const recordAuditEventMock = vi.fn();

vi.mock('../../../services/virusScanner', () => ({
  scanFile: (...args: unknown[]) => scanFileMock(...(args as [string])),
  getVirusScannerStatus: () => ({
    configured: true,
    enabled: true,
    target: null,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
  }),
}));

vi.mock('../../../services/workOrdersService', () => ({
  getWorkOrder: (...args: unknown[]) => getWorkOrderMock(...args),
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {},
  WorkOrderValidationError: class WorkOrderValidationError extends Error {},
  createFromAlert: vi.fn(),
  createWorkOrder: vi.fn(),
  getMaintenanceSummary: vi.fn(),
  listWorkOrders: vi.fn(),
  listWorkOrdersForAlert: vi.fn(),
  listWorkOrdersForDevice: vi.fn(),
  updateWorkOrderDetails: vi.fn(),
  updateWorkOrderTasks: vi.fn(),
}));

vi.mock('../../../repositories/workOrdersRepository', () => ({
  findWorkOrderAttachmentById: (...args: unknown[]) => findWorkOrderAttachmentByIdMock(...args),
  findWorkOrderAttachmentByRelativePath: vi.fn(),
  createWorkOrderAttachment: (...args: unknown[]) => createWorkOrderAttachmentMock(...args),
  deleteWorkOrderAttachment: vi.fn(),
  listWorkOrderAttachments: vi.fn(),
}));

vi.mock('../../../repositories/documentsRepository', () => ({
  findDocumentById: (...args: unknown[]) => findDocumentByIdMock(...args),
  findDocumentByRelativePath: vi.fn(),
}));

vi.mock('../../../services/fileUrlSigner', () => ({
  verifyFileToken: (...args: unknown[]) => verifyFileTokenMock(...args),
  signFileToken: (...args: unknown[]) => signFileTokenMock(...args),
  isFileSigningEnabled: () => true,
  getDefaultSignedUrlTtlSeconds: () => 300,
}));

vi.mock('../../../controllers/organisation', () => ({
  resolveOrganisationId: vi.fn(async () => 'org-123'),
}));

vi.mock('../../../config/storage', () => ({
  buildPublicUrl: (relativePath: string) => `/files/${relativePath}`,
  ensureDirExists: vi.fn(),
  getWorkOrderAttachmentPath: () => path.join(os.tmpdir(), 'mock-path'),
  getStorageRoot: () => os.tmpdir(),
  sanitizeSegment: (value: string) => value,
  toRelativePath: (value: string) => value,
}));

vi.mock('../../audit/auditService', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args),
}));

type MockResponse = {
  body?: unknown;
  statusCode?: number;
  headers: Record<string, string>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  res.send = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  res.setHeader = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
  });
  return res;
}

describe('file access guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanFileMock.mockReset();
    getWorkOrderMock.mockReset();
    createWorkOrderAttachmentMock.mockReset();
    verifyFileTokenMock.mockReset();
    signFileTokenMock.mockReset();
    findWorkOrderAttachmentByIdMock.mockReset();
    findDocumentByIdMock.mockReset();
    recordAuditEventMock.mockReset();
    process.env.FILE_SIGNING_SECRET = 'test-signing-secret';
    vi.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const stream = new Readable();
      stream._read = () => {};
      return stream as unknown as fs.ReadStream;
    });
  });

  afterEach(() => {
    delete process.env.FILE_SIGNING_SECRET;
    vi.restoreAllMocks();
  });

  it('returns 400 for infected attachment uploads and skips persistence', async () => {
    const tempFile = path.join(os.tmpdir(), `infected-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFile, 'evil');
    scanFileMock.mockResolvedValueOnce('infected');
    const workOrderId = '11111111-1111-1111-1111-111111111111';
    getWorkOrderMock.mockResolvedValue({ id: workOrderId, organisation_id: 'org-123' });

    const req = {
      params: { id: workOrderId },
      user: { id: 'user-1', role: 'admin' },
      file: {
        path: tempFile,
        originalname: 'bad.txt',
        mimetype: 'text/plain',
        size: 4,
      },
    } as unknown as Request;
    const res = createMockResponse();

    await uploadWorkOrderAttachmentHandler(req, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({ code: 'ERR_FILE_INFECTED' });
    expect(createWorkOrderAttachmentMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'file_upload_failure', entityType: 'work_order_attachment' })
    );
    await fs.promises.rm(tempFile, { force: true }).catch(() => {});
  });

  it('returns 503 for scanner failures and skips persistence', async () => {
    const tempFile = path.join(os.tmpdir(), `scanfail-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFile, 'corrupt');
    scanFileMock.mockResolvedValueOnce('scan_failed');
    const workOrderId = '11111111-1111-1111-1111-111111111111';
    getWorkOrderMock.mockResolvedValue({ id: workOrderId, organisation_id: 'org-123' });

    const req = {
      params: { id: workOrderId },
      user: { id: 'user-1', role: 'admin' },
      file: {
        path: tempFile,
        originalname: 'corrupt.txt',
        mimetype: 'text/plain',
        size: 6,
      },
    } as unknown as Request;
    const res = createMockResponse();

    await uploadWorkOrderAttachmentHandler(req, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body).toMatchObject({ code: 'ERR_FILE_SCAN_FAILED' });
    expect(createWorkOrderAttachmentMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'file_upload_failure' })
    );
    await fs.promises.rm(tempFile, { force: true }).catch(() => {});
  });

  it.each(['infected', 'scan_failed'] as const)(
    'refuses to serve %s files via signed URLs',
    async (fileStatus) => {
      verifyFileTokenMock.mockReturnValue({
        valid: true,
        expired: false,
        fileId: 'file-123',
        orgId: 'org-123',
        action: 'read',
      });
      findWorkOrderAttachmentByIdMock.mockResolvedValue({
        id: 'file-123',
        organisation_id: 'org-123',
        work_order_id: 'wo-1',
        relative_path: 'work-orders/org-123/wo-1/blocked.txt',
        mime_type: 'text/plain',
        original_name: 'blocked.txt',
        file_status: fileStatus,
      });
      findDocumentByIdMock.mockResolvedValue(null);

      const res = createMockResponse();
      await serveSignedFileHandler(
        { params: { token: 'test-token' }, ip: '127.0.0.1' } as unknown as Request,
        res as unknown as Response,
        vi.fn()
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(recordAuditEventMock).not.toHaveBeenCalled();
      expect(fs.createReadStream).not.toHaveBeenCalled();
    }
  );

  it('returns 410 for expired signed URLs', async () => {
    verifyFileTokenMock.mockReturnValue({ valid: false, expired: true });
    const res = createMockResponse();

    await serveSignedFileHandler(
      { params: { token: 'expired-token' }, ip: '127.0.0.1' } as unknown as Request,
      res as unknown as Response,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.body).toEqual({ message: 'Not found' });
  });

  it('enforces RBAC when issuing signed URLs', async () => {
    const res = createMockResponse();
    const req = {
      params: { id: 'file-123' },
      body: {},
      user: { id: 'user-1', role: 'contractor' },
    } as unknown as Request;

    await createSignedFileUrlHandler(req, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(signFileTokenMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });
});
