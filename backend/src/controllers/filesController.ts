import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { resolveOrganisationId } from './organisation';
import { getStorageRoot } from '../config/storage';
import { findDocumentByRelativePath } from '../repositories/documentsRepository';
import { findWorkOrderAttachmentByRelativePath } from '../repositories/workOrdersRepository';
import { canViewFiles } from '../services/rbacService';

const pathParamsSchema = z.object({
  path: z.string().min(1).max(500),
});

type FileTarget = {
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

async function resolveFileTarget(relativePath: string): Promise<FileTarget | null> {
  const attachment = await findWorkOrderAttachmentByRelativePath(relativePath);
  if (attachment?.relative_path) {
    return {
      orgId: attachment.organisation_id,
      relativePath: attachment.relative_path,
      mimeType: attachment.mime_type,
      downloadName: attachment.original_name ?? attachment.filename ?? path.basename(relativePath),
    };
  }

  const document = await findDocumentByRelativePath(relativePath);
  if (document) {
    return {
      orgId: document.org_id,
      relativePath: document.relative_path,
      mimeType: document.mime_type,
      downloadName: document.original_name ?? document.filename ?? path.basename(relativePath),
    };
  }

  return null;
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

    const target = await resolveFileTarget(normalizedPath);
    if (!target || target.orgId !== organisationId) {
      return res.status(404).json({ message: 'Not found' });
    }

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

    const downloadName = encodeURIComponent(target.downloadName.replace(/["\r\n]/g, '') || path.basename(target.relativePath));
    res.setHeader('Content-Type', target.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    const stream = fs.createReadStream(absolutePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}
