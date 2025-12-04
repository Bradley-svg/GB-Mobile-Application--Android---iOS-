import { NextFunction, Request, Response } from 'express';
import { getHealthPlus } from '../services/healthService';

export function health(_req: Request, res: Response) {
  res.json({ ok: true });
}

export async function healthPlus(_req: Request, res: Response, _next: NextFunction) {
  try {
    const result = await getHealthPlus();
    if (result.error) {
      console.error('health-plus error', result.error);
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    _next(err);
  }
}
