import { NextFunction, Request, Response } from 'express';
import { getHealthPlus } from '../services/healthService';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../services/authService';
import { getUserContext } from '../services/userService';
import { getDemoStatusForOrg } from '../services/demoService';

export function health(_req: Request, res: Response) {
  res.json({ ok: true });
}

async function resolveDemoStatus(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const { userId } = verifyAccessToken(header.slice(7));
    const user = await getUserContext(userId);
    if (!user?.organisation_id) return null;
    return await getDemoStatusForOrg(user.organisation_id);
  } catch (err) {
    logger.warn({ module: 'health', err }, 'health-plus demo detection failed');
    return null;
  }
}

export async function healthPlus(req: Request, res: Response, _next: NextFunction) {
  try {
    const demoStatus = await resolveDemoStatus(req);
    const result = await getHealthPlus(new Date(), { demoStatus });
    if (result.error) {
      logger.error({ module: 'health', err: result.error }, 'health-plus error');
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ module: 'health', err }, 'health-plus handler failed');
    _next(err);
  }
}
