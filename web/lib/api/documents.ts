import { api } from "./httpClient";
import { requestSignedFileUrl } from "./files";
import type { Document, DocumentScope, FileStatus } from "@/lib/types/documents";

const normalizeDocument = (doc: Document, scope?: { siteId?: string | null; deviceId?: string | null; scopeType?: DocumentScope }): Document => {
  const originalName = doc.originalName ?? doc.original_name ?? doc.title;
  const mimeType = doc.mimeType ?? doc.mime_type ?? null;
  const sizeBytes = doc.sizeBytes ?? doc.size_bytes ?? null;
  const createdAt = doc.createdAt ?? doc.created_at ?? doc.uploadedAt ?? doc.uploaded_at ?? null;
  const siteId = doc.siteId ?? doc.site_id ?? scope?.siteId ?? null;
  const deviceId = doc.deviceId ?? doc.device_id ?? scope?.deviceId ?? null;
  const fileStatus = (doc.fileStatus ?? doc.file_status ?? "clean") as FileStatus;
  const scopeType: DocumentScope =
    scope?.scopeType ??
    (deviceId ? "device" : siteId ? "site" : "org");

  return {
    ...doc,
    originalName,
    original_name: originalName,
    mimeType,
    mime_type: mimeType,
    sizeBytes,
    size_bytes: sizeBytes,
    createdAt,
    created_at: createdAt ?? undefined,
    uploadedAt: createdAt,
    uploaded_at: createdAt ?? undefined,
    siteId,
    site_id: siteId ?? undefined,
    deviceId,
    device_id: deviceId ?? undefined,
    scopeType,
    fileStatus,
    file_status: fileStatus,
  };
};

export async function listSiteDocuments(siteId: string, orgId?: string | null): Promise<Document[]> {
  const res = await api.get<Document[]>(`/sites/${siteId}/documents`, {
    params: { orgId: orgId ?? undefined },
  });
  return (res.data ?? []).map((doc) => normalizeDocument(doc, { siteId, scopeType: "site" }));
}

export async function listDeviceDocuments(deviceId: string, orgId?: string | null): Promise<Document[]> {
  const res = await api.get<Document[]>(`/devices/${deviceId}/documents`, {
    params: { orgId: orgId ?? undefined },
  });
  return (res.data ?? []).map((doc) => normalizeDocument(doc, { deviceId, scopeType: "device" }));
}

export async function getDocumentDownloadUrl(document: Document): Promise<string> {
  const status = (document.fileStatus ?? document.file_status ?? "clean") as FileStatus;
  if (status === "infected") {
    throw new Error("Document blocked by antivirus");
  }
  if (status === "scan_failed") {
    throw new Error("Document scan failed");
  }
  const signed = await requestSignedFileUrl(document.id);
  return signed || document.url;
}
