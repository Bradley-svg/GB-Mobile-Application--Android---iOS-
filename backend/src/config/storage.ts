import fs from 'fs';
import path from 'path';

const defaultRoot = process.env.FILE_STORAGE_ROOT
  ? path.resolve(process.env.FILE_STORAGE_ROOT)
  : path.resolve(__dirname, '../../uploads');

const baseUrl = process.env.FILE_STORAGE_BASE_URL || '';

export function getStorageRoot() {
  return defaultRoot;
}

export function getStorageBaseUrl() {
  return baseUrl;
}

function normalizeRoot(): string {
  const normalized = path.resolve(defaultRoot);
  return normalized.endsWith(path.sep) ? normalized : `${normalized}${path.sep}`;
}

export function sanitizeSegment(segment: string) {
  return path.basename(segment).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureWithinRoot(targetPath: string) {
  const normalizedRoot = normalizeRoot();
  const normalizedTarget = path.resolve(targetPath);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('Invalid storage path');
  }
  return normalizedTarget;
}

export async function ensureDirExists(dirPath: string) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export function toRelativePath(fullPath: string) {
  const relative = path.relative(getStorageRoot(), fullPath);
  return relative.split(path.sep).join('/');
}

export function buildPublicUrl(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}/${normalized}`;
  }
  return `/files/${normalized}`;
}

export function getWorkOrderAttachmentPath(orgId: string, workOrderId: string, filename: string) {
  const safeName = sanitizeSegment(filename);
  const safeOrg = sanitizeSegment(orgId);
  const safeWorkOrder = sanitizeSegment(workOrderId);
  return ensureWithinRoot(
    path.join(getStorageRoot(), 'work-orders', safeOrg, safeWorkOrder, safeName)
  );
}

export function getDocumentPath(orgId: string, scope: string, scopeId: string, filename: string) {
  const safeName = sanitizeSegment(filename);
  const safeOrg = sanitizeSegment(orgId);
  const safeScope = sanitizeSegment(scope);
  const safeScopeId = sanitizeSegment(scopeId);
  return ensureWithinRoot(
    path.join(getStorageRoot(), 'documents', safeOrg, safeScope, safeScopeId, safeName)
  );
}
