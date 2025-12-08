export type Document = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  url: string;
  originalName?: string;
  original_name?: string;
  mimeType?: string | null;
  mime_type?: string | null;
  sizeBytes?: number | null;
  size_bytes?: number | null;
  createdAt?: string;
  created_at?: string;
};
