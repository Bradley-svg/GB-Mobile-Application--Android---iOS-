import { Router } from 'express';
import {
  createWorkOrderFromAlertHandler,
  createWorkOrderHandler,
  getWorkOrderHandler,
  listWorkOrdersForAlertHandler,
  listWorkOrdersForDeviceHandler,
  listWorkOrdersForSiteHandler,
  listWorkOrdersHandler,
  maintenanceSummaryHandler,
  updateWorkOrderHandler,
  updateWorkOrderTasksHandler,
} from '../controllers/workOrdersController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/work-orders', requireAuth, listWorkOrdersHandler);
router.get('/work-orders/:id', requireAuth, getWorkOrderHandler);
router.post('/work-orders', requireAuth, createWorkOrderHandler);
router.post('/alerts/:id/work-orders', requireAuth, createWorkOrderFromAlertHandler);
router.get('/alerts/:id/work-orders', requireAuth, listWorkOrdersForAlertHandler);
router.patch('/work-orders/:id', requireAuth, updateWorkOrderHandler);
router.put('/work-orders/:id/tasks', requireAuth, updateWorkOrderTasksHandler);
router.get('/devices/:id/work-orders', requireAuth, listWorkOrdersForDeviceHandler);
router.get('/sites/:id/work-orders', requireAuth, listWorkOrdersForSiteHandler);
router.get('/maintenance/summary', requireAuth, maintenanceSummaryHandler);

export default router;
