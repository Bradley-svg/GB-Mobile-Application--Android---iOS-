import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { runWithRequestContext } from '../config/requestContext';

const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers[REQUEST_ID_HEADER];
  const providedId = Array.isArray(provided) ? provided[0] : provided;
  const requestId = (providedId ?? '').toString().trim() || randomUUID();
  const startedAt = process.hrtime.bigint();

  runWithRequestContext({ requestId }, () => {
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const log = logger.child({ module: 'http', requestId });
    log.info({ method: req.method, path: req.originalUrl }, 'request.start');

    let finished = false;
    const markFinished = (err?: unknown) => {
      if (finished) return;
      finished = true;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const payload = {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      };

      if (err) {
        log.error({ ...payload, err }, 'request.fail');
      } else {
        log.info(payload, 'request.complete');
      }
    };

    res.on('finish', () => markFinished());
    res.on('close', () => markFinished());
    res.on('error', (err) => markFinished(err));

    next();
  });
}
