import { NextFunction, Request, Response } from 'express';
import { HeatPumpHistoryValidationError, getHistoryForRequest } from '../services/heatPumpHistoryService';

export async function postHeatPumpHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getHistoryForRequest({ userId: req.user?.id ?? null }, req.body);

    if (result.ok) {
      return res.json({ series: result.series });
    }

    if (result.kind === 'CIRCUIT_OPEN') {
      return res
        .status(503)
        .json({ error: 'history_temporarily_unavailable', message: result.message });
    }

    return res
      .status(502)
      .json({ error: 'upstream_history_error', message: result.message });
  } catch (err) {
    if (err instanceof HeatPumpHistoryValidationError) {
      return res.status(400).json({ message: err.message });
    }

    next(err);
  }
}
