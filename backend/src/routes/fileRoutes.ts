import { Router } from 'express';
import { serveFileHandler } from '../controllers/filesController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/:path(*)', requireAuth, serveFileHandler);

export default router;
