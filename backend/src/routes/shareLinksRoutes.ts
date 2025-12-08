import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  createDeviceShareLink,
  createSiteShareLink,
  listDeviceShareLinks,
  listSiteShareLinks,
  resolvePublicShare,
  revokeShareLinkHandler,
} from '../controllers/shareLinksController';

const router = Router();

router.post('/sites/:id/share-links', requireAuth, createSiteShareLink);
router.get('/sites/:id/share-links', requireAuth, listSiteShareLinks);
router.post('/devices/:id/share-links', requireAuth, createDeviceShareLink);
router.get('/devices/:id/share-links', requireAuth, listDeviceShareLinks);
router.delete('/share-links/:id', requireAuth, revokeShareLinkHandler);
router.get('/public/share/:token', resolvePublicShare);

export default router;
