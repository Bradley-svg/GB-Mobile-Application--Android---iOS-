import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { resolveOrganisationId } from './organisation';
import { getStorageRoot } from '../config/storage';
import { findDocumentById, findDocumentByRelativePath } from '../repositories/documentsRepository';
import {
  findWorkOrderAttachmentById,
  findWorkOrderAttachmentByRelativePath,
} from '../repositories/workOrdersRepository';
import { canViewFiles } from '../services/rbacService';
import { isFileSigningEnabled, signFileToken, verifyFileToken } from '../services/fileUrlSigner';

const pathParamsSchema = z.object({
  path: z.string().min(1).max(500),
});
const signedUrlParamsSchema = z.object({
  id: z.string().uuid(),
});
const signedUrlBodySchema = z.object({
  ttlSeconds: z.number().int().min(1).max(86_400).optional(),
});

type FileTarget = {
  id?: string;
  orgId: string;
  relativePath: string;
  mimeType: string | null;
  downloadName: string;
};

function sanitizeRelativePath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return null;
  }
  return normalized;
}

async function resolveFileTargetByRelativePath(relativePath: string): Promise<FileTarget | null> {
  const attachment = await findWorkOrderAttachmentByRelativePath(relativePath);
  if (attachment?.relative_path) {
    return {
      id: attachment.id,
      orgId: attachment.organisation_id,
      relativePath: attachment.relative_path,
      mimeType: attachment.mime_type,
      downloadName: attachment.original_name ?? attachment.filename ?? path.basename(relativePath),
    };
  }

  const document = await findDocumentByRelativePath(relativePath);
  if (document?.relative_path) {
    return {
      id: document.id,
      orgId: document.org_id,
      relativePath: document.relative_path,
      mimeType: document.mime_type,
      downloadName: document.original_name ?? document.filename ?? path.basename(relativePath),
    };
  }

  return null;
}

async function resolveFileTargetById(fileId: string): Promise<FileTarget | null> {
  const attachment = await findWorkOrderAttachmentById(fileId);
  if (attachment?.relative_path) {
    return {
      id: attachment.id,
      orgId: attachment.organisation_id,
      relativePath: attachment.relative_path,
      mimeType: attachment.mime_type,
      downloadName: attachment.original_name ?? attachment.filename ?? path.basename(attachment.relative_path),
    };
  }

  const document = await findDocumentById(fileId);
  if (document?.relative_path) {
    return {
      id: document.id,
      orgId: document.org_id,
      relativePath: document.relative_path,
      mimeType: document.mime_type,
      downloadName: document.original_name ?? document.filename ?? path.basename(document.relative_path),
    };
  }

  return null;
}

async function streamFile(target: FileTarget, res: Response, next: NextFunction) {
  const storageRoot = path.resolve(getStorageRoot());
  const absolutePath = path.resolve(storageRoot, target.relativePath);
  const relativeToRoot = path.relative(storageRoot, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const stats = await fs.promises.stat(absolutePath).catch(() => null);
  if (!stats?.isFile()) {
    return res.status(404).json({ message: 'Not found' });
  }

  const downloadName = encodeURIComponent(
    target.downloadName.replace(/["\r\n]/g, '') || path.basename(target.relativePath)
  );
  res.setHeader('Content-Type', target.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', stats.size.toString());
  res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
  res.setHeader('Cache-Control', 'private, no-store');

  const stream = fs.createReadStream(absolutePath);
  stream.on('error', next);
  stream.pipe(res);
}

export async function serveFileHandler(req: Request, res: Response, next: NextFunction) {
  if (!canViewFiles(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsedPath = pathParamsSchema.safeParse({
    path:
      (req.params as Record<string, string>).path ??
      (req.params as Record<string, string>)[0],
  });
  if (!parsedPath.success) {
    return res.status(404).json({ message: 'Not found' });
  }

  const normalizedPath = sanitizeRelativePath(parsedPath.data.path);
  if (!normalizedPath) {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const target = await resolveFileTargetByRelativePath(normalizedPath);
    if (!target || target.orgId !== organisationId) {
      return res.status(404).json({ message: 'Not found' });
    }

    await streamFile(target, res, next);
  } catch (err) {
    next(err);
  }
}

export async function createSignedFileUrlHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!canViewFiles(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsedParams = signedUrlParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid file id' });
  }

  const parsedBody = signedUrlBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  if (!isFileSigningEnabled()) {
    return res
      .status(503)
      .json({ message: 'File signing disabled', code: 'ERR_FILE_SIGNING_DISABLED' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const target = await resolveFileTargetById(parsedParams.data.id);
    if (!target) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (target.orgId !== organisationId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const ttl = parsedBody.data.ttlSeconds ?? 3600;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const token = signFileToken(target.id ?? parsedParams.data.id, expiresAt);

    res.json({ url: `/files/signed/${token}` });
  } catch (err) {
    next(err);
  }
}

export async function serveSignedFileHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = (req.params as { token?: string }).token;
  if (!token) {
    return res.status(404).json({ message: 'Not found' });
  }

  const verification = verifyFileToken(token);
  if (!verification.valid || !verification.fileId) {
    return res
      .status(verification.expired ? 410 : 404)
      .json({ message: 'Not found' });
  }

  try {
    const target = await resolveFileTargetById(verification.fileId);
    if (!target) {
      return res.status(404).json({ message: 'Not found' });
    }

    await streamFile(target, res, next);
  } catch (err) {
    next(err);
  }
}
