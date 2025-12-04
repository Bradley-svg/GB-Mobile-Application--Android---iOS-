import { NextFunction, Request, Response } from 'express';
import { HeatPumpHistoryValidationError, getHistoryForRequest } from '../services/heatPumpHistoryService';

export async function postHeatPumpHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getHistoryForRequest({ userId: req.user?.id ?? null }, req.body);
    res.json(data);
  } catch (err) {
    if (err instanceof HeatPumpHistoryValidationError) {
      return res.status(400).json({ message: err.message });
    }

    next(err);
  }
}
