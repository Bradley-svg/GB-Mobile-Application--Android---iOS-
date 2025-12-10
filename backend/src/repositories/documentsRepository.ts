import { query } from '../config/db';
import type { FileStatus } from '../types/files';

export type DocumentRow = {
  id: string;
  org_id: string;
  site_id: string | null;
  device_id: string | null;
  title: string;
  category: string;
  description: string | null;
  filename: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  relative_path: string;
  uploaded_by_user_id: string | null;
  created_at: string;
  file_status: FileStatus;
};

export type CreateDocumentInput = {
  orgId: string;
  siteId?: string | null;
  deviceId?: string | null;
  title: string;
  category?: string | null;
  description?: string | null;
  filename: string;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  relativePath: string;
  uploadedByUserId?: string | null;
  fileStatus?: FileStatus;
};

export async function listDocumentsForSite(
  orgId: string,
  siteId: string
): Promise<DocumentRow[]> {
  const res = await query<DocumentRow>(
    `
    select *
    from documents
    where org_id = $1
      and site_id = $2
      and file_status = 'clean'
    order by created_at desc
  `,
    [orgId, siteId]
  );
  return res.rows;
}

export async function listDocumentsForDevice(
  orgId: string,
  deviceId: string
): Promise<DocumentRow[]> {
  const res = await query<DocumentRow>(
    `
    select *
    from documents
    where org_id = $1
      and device_id = $2
      and file_status = 'clean'
    order by created_at desc
  `,
    [orgId, deviceId]
  );
  return res.rows;
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentRow> {
  const res = await query<DocumentRow>(
    `
    insert into documents (
      org_id,
      site_id,
      device_id,
      title,
      category,
      description,
      filename,
      original_name,
      mime_type,
      size_bytes,
      relative_path,
      uploaded_by_user_id,
      file_status,
      created_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
    returning *
  `,
    [
      input.orgId,
      input.siteId ?? null,
      input.deviceId ?? null,
      input.title,
      input.category ?? 'other',
      input.description ?? null,
      input.filename,
      input.originalName,
      input.mimeType ?? null,
      input.sizeBytes ?? null,
      input.relativePath,
      input.uploadedByUserId ?? null,
      input.fileStatus ?? 'clean',
    ]
  );

  return res.rows[0];
}

export async function findDocumentByRelativePath(
  relativePath: string
): Promise<DocumentRow | null> {
  const res = await query<DocumentRow>(
    `
    select *
    from documents
    where relative_path = $1
    limit 1
  `,
    [relativePath]
  );

  return res.rows[0] ?? null;
}

export async function findDocumentById(documentId: string): Promise<DocumentRow | null> {
  const res = await query<DocumentRow>(
    `
    select *
    from documents
    where id = $1
    limit 1
  `,
    [documentId]
  );

  return res.rows[0] ?? null;
}

export async function deleteDocument(orgId: string, documentId: string): Promise<DocumentRow | null> {
  const res = await query<DocumentRow>(
    `
    delete from documents
    where id = $1
      and org_id = $2
    returning *
  `,
    [documentId, orgId]
  );

  return res.rows[0] ?? null;
}
