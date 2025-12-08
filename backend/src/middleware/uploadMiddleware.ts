import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getStorageRoot, sanitizeSegment } from '../config/storage';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const isAllowedMimeType = (mimeType?: string | null) => {
  if (!mimeType) return false;
  if (mimeType.startsWith('image/')) return true;
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];
  return allowed.includes(mimeType);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmpDir = path.join(getStorageRoot(), 'tmp');
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      cb(null, tmpDir);
    } catch (err) {
      cb(err as Error, tmpDir);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${sanitizeSegment(file.originalname || 'upload')}`;
    cb(null, safeName);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (isAllowedMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  }
};

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

export const uploadSingleAttachment = uploader.single('file');
