import { Router } from 'express';
import {
  createWorkOrderFromAlertHandler,
  createWorkOrderHandler,
  deleteWorkOrderAttachmentHandler,
  getWorkOrderHandler,
  listWorkOrderAttachmentsHandler,
  listWorkOrdersForAlertHandler,
  listWorkOrdersForDeviceHandler,
  listWorkOrdersForSiteHandler,
  listWorkOrdersHandler,
  maintenanceSummaryHandler,
  updateWorkOrderHandler,
  updateWorkOrderTasksHandler,
  uploadWorkOrderAttachmentHandler,
} from '../controllers/workOrdersController';
import { requireAuth } from '../middleware/requireAuth';
import { uploadSingleAttachment } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/work-orders', requireAuth, listWorkOrdersHandler);
router.get('/work-orders/:id', requireAuth, getWorkOrderHandler);
router.post('/work-orders', requireAuth, createWorkOrderHandler);
router.post('/alerts/:id/work-orders', requireAuth, createWorkOrderFromAlertHandler);
router.get('/alerts/:id/work-orders', requireAuth, listWorkOrdersForAlertHandler);
router.patch('/work-orders/:id', requireAuth, updateWorkOrderHandler);
router.put('/work-orders/:id/tasks', requireAuth, updateWorkOrderTasksHandler);
router.get('/work-orders/:id/attachments', requireAuth, listWorkOrderAttachmentsHandler);
router.post(
  '/work-orders/:id/attachments',
  requireAuth,
  uploadSingleAttachment,
  uploadWorkOrderAttachmentHandler
);
router.delete(
  '/work-orders/:id/attachments/:attachmentId',
  requireAuth,
  deleteWorkOrderAttachmentHandler
);
router.get('/devices/:id/work-orders', requireAuth, listWorkOrdersForDeviceHandler);
router.get('/sites/:id/work-orders', requireAuth, listWorkOrdersForSiteHandler);
router.get('/maintenance/summary', requireAuth, maintenanceSummaryHandler);

export default router;
