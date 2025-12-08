import { Router } from 'express';
import {
  createSignedFileUrlHandler,
  serveFileHandler,
  serveSignedFileHandler,
} from '../controllers/filesController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/:id/signed-url', requireAuth, createSignedFileUrlHandler);
router.get('/signed/:token', serveSignedFileHandler);
router.get('/:path(*)', requireAuth, serveFileHandler);

export default router;
