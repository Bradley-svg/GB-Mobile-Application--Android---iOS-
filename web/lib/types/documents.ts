export type FileStatus = "clean" | "infected" | "scan_failed";

export type DocumentScope = "org" | "site" | "device";

export type Document = {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  url: string;
  originalName?: string | null;
  original_name?: string | null;
  mimeType?: string | null;
  mime_type?: string | null;
  sizeBytes?: number | null;
  size_bytes?: number | null;
  createdAt?: string | null;
  created_at?: string | null;
  uploadedAt?: string | null;
  uploaded_at?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdBy?: { name?: string | null; email?: string | null } | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  siteId?: string | null;
  site_id?: string | null;
  deviceId?: string | null;
  device_id?: string | null;
  scopeType?: DocumentScope;
  fileStatus?: FileStatus | null;
  file_status?: FileStatus | null;
};
