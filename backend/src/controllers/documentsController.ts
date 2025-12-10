import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { resolveOrganisationId } from './organisation';
import { getSiteById } from '../repositories/sitesRepository';
import { getDeviceById } from '../repositories/devicesRepository';
import {
  createDocument,
  listDocumentsForDevice,
  listDocumentsForSite,
} from '../repositories/documentsRepository';
import {
  buildPublicUrl,
  ensureDirExists,
  getDocumentPath,
  sanitizeSegment,
  toRelativePath,
} from '../config/storage';
import { canUploadDocuments } from '../services/rbacService';
import { scanFile } from '../services/virusScanner';
import { recordAuditEvent } from '../modules/audit/auditService';

const paramsSchema = z.object({ id: z.string().uuid() });
const documentBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(64).optional(),
  description: z.string().max(500).nullable().optional(),
});

const mapDocument = (doc: {
  id: string;
  title: string;
  category: string;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  relative_path: string;
  created_at: string;
  original_name: string;
}) => ({
  id: doc.id,
  title: doc.title,
  category: doc.category,
  description: doc.description,
  mimeType: doc.mime_type ?? undefined,
  sizeBytes: doc.size_bytes ?? undefined,
  url: buildPublicUrl(doc.relative_path),
  createdAt: doc.created_at,
  originalName: doc.original_name,
});

async function ensureCleanUpload(
  file: Express.Multer.File,
  res: Response,
  auditContext: { orgId: string; userId?: string | null; scope: 'site' | 'device'; scopeId: string }
) {
  const scanResult = await scanFile(file.path);
  if (scanResult !== 'clean') {
    await fs.promises.unlink(file.path).catch(() => {});
    await recordAuditEvent({
      orgId: auditContext.orgId,
      userId: auditContext.userId ?? null,
      action: 'file_upload_failure',
      entityType: 'document_upload',
      entityId: auditContext.scopeId,
      metadata: {
        scope: auditContext.scope,
        scanResult,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname,
      },
    });
    const status = scanResult === 'infected' ? 400 : 503;
    const message =
      scanResult === 'infected' ? 'File failed antivirus scan' : 'Antivirus scan unavailable';
    const code = scanResult === 'infected' ? 'ERR_FILE_INFECTED' : 'ERR_FILE_SCAN_FAILED';
    res.status(status).json({ message, code });
    return false;
  }
  return true;
}

async function persistDocumentFile(
  scope: 'site' | 'device',
  orgId: string,
  scopeId: string,
  file: Express.Multer.File
) {
  const originalName = file.originalname || 'document';
  const storedName = `${Date.now()}-${sanitizeSegment(originalName)}`;
  const destination = getDocumentPath(orgId, scope, scopeId, storedName);
  await ensureDirExists(path.dirname(destination));
  await fs.promises.rename(file.path, destination);
  const relativePath = toRelativePath(destination);

  return { storedName, originalName, relativePath, destination };
}

export async function listSiteDocumentsHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = paramsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    if (!canUploadDocuments(req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const site = await getSiteById(parsedParams.data.id, organisationId);
    if (!site) return res.status(404).json({ message: 'Not found' });

    const docs = await listDocumentsForSite(organisationId, parsedParams.data.id);
    res.json(docs.map((doc) => mapDocument(doc)));
  } catch (err) {
    next(err);
  }
}

export async function listDeviceDocumentsHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = paramsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    if (!canUploadDocuments(req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });

    const docs = await listDocumentsForDevice(organisationId, parsedParams.data.id);
    res.json(docs.map((doc) => mapDocument(doc)));
  } catch (err) {
    next(err);
  }
}

export async function uploadSiteDocumentHandler(req: Request, res: Response, next: NextFunction) {
  if (!canUploadDocuments(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsedParams = paramsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }
  const parsedBody = documentBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ message: 'File is required' });
  }

  let destinationPath: string | null = null;

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const site = await getSiteById(parsedParams.data.id, organisationId);
    if (!site) {
      await fs.promises.unlink(file.path).catch(() => {});
      return res.status(404).json({ message: 'Not found' });
    }

    const clean = await ensureCleanUpload(file, res, {
      orgId: organisationId,
      userId: req.user?.id ?? null,
      scope: 'site',
      scopeId: parsedParams.data.id,
    });
    if (!clean) return;

    const { storedName, originalName, relativePath, destination } = await persistDocumentFile(
      'site',
      organisationId,
      parsedParams.data.id,
      file
    );
    destinationPath = destination;

    const created = await createDocument({
      orgId: organisationId,
      siteId: parsedParams.data.id,
      title: parsedBody.data.title ?? originalName,
      category: parsedBody.data.category ?? 'other',
      description: parsedBody.data.description ?? null,
      filename: storedName,
      originalName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      relativePath,
      uploadedByUserId: req.user?.id ?? null,
      fileStatus: 'clean',
    });

    await recordAuditEvent({
      orgId: organisationId,
      userId: req.user?.id ?? null,
      action: 'file_upload_success',
      entityType: 'document',
      entityId: created.id,
      metadata: {
        scope: 'site',
        scopeId: parsedParams.data.id,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName,
        relativePath,
      },
    });

    res.status(201).json(mapDocument(created));
  } catch (err) {
    await fs.promises.unlink(file.path).catch(() => {});
    if (destinationPath) {
      await fs.promises.unlink(destinationPath).catch(() => {});
    }
    next(err);
  }
}

export async function uploadDeviceDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!canUploadDocuments(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsedParams = paramsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }
  const parsedBody = documentBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ message: 'File is required' });
  }

  let destinationPath: string | null = null;

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) {
      await fs.promises.unlink(file.path).catch(() => {});
      return res.status(404).json({ message: 'Not found' });
    }

    const clean = await ensureCleanUpload(file, res, {
      orgId: organisationId,
      userId: req.user?.id ?? null,
      scope: 'device',
      scopeId: parsedParams.data.id,
    });
    if (!clean) return;

    const { storedName, originalName, relativePath, destination } = await persistDocumentFile(
      'device',
      organisationId,
      parsedParams.data.id,
      file
    );
    destinationPath = destination;

    const created = await createDocument({
      orgId: organisationId,
      deviceId: parsedParams.data.id,
      title: parsedBody.data.title ?? originalName,
      category: parsedBody.data.category ?? 'other',
      description: parsedBody.data.description ?? null,
      filename: storedName,
      originalName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      relativePath,
      uploadedByUserId: req.user?.id ?? null,
      fileStatus: 'clean',
    });

    await recordAuditEvent({
      orgId: organisationId,
      userId: req.user?.id ?? null,
      action: 'file_upload_success',
      entityType: 'document',
      entityId: created.id,
      metadata: {
        scope: 'device',
        scopeId: parsedParams.data.id,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName,
        relativePath,
      },
    });

    res.status(201).json(mapDocument(created));
  } catch (err) {
    await fs.promises.unlink(file.path).catch(() => {});
    if (destinationPath) {
      await fs.promises.unlink(destinationPath).catch(() => {});
    }
    next(err);
  }
}
