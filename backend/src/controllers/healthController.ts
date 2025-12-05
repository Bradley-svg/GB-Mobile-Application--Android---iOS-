import { NextFunction, Request, Response } from 'express';
import { getHealthPlus } from '../services/healthService';
import { logger } from '../config/logger';

export function health(_req: Request, res: Response) {
  res.json({ ok: true });
}

export async function healthPlus(_req: Request, res: Response, _next: NextFunction) {
  try {
    const result = await getHealthPlus();
    if (result.error) {
      logger.error({ module: 'health', err: result.error }, 'health-plus error');
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ module: 'health', err }, 'health-plus handler failed');
    _next(err);
  }
}
