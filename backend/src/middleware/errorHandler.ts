import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(
    { err, module: 'http', path: req.path, method: req.method },
    'unhandled error'
  );

  if (res.headersSent) {
    return;
  }

  res.status(500).json({ message: 'Internal server error' });
}
