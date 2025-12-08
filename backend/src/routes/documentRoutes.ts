import { Router } from 'express';
import {
  listDeviceDocumentsHandler,
  listSiteDocumentsHandler,
  uploadDeviceDocumentHandler,
  uploadSiteDocumentHandler,
} from '../controllers/documentsController';
import { requireAuth } from '../middleware/requireAuth';
import { uploadSingleAttachment } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/sites/:id/documents', requireAuth, listSiteDocumentsHandler);
router.post('/sites/:id/documents', requireAuth, uploadSingleAttachment, uploadSiteDocumentHandler);
router.get('/devices/:id/documents', requireAuth, listDeviceDocumentsHandler);
router.post(
  '/devices/:id/documents',
  requireAuth,
  uploadSingleAttachment,
  uploadDeviceDocumentHandler
);

export default router;
