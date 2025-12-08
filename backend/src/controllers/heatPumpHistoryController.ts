import { NextFunction, Request, Response } from 'express';
import {
  HeatPumpHistoryDeviceNotFoundError,
  HeatPumpHistoryFeatureDisabledError,
  HeatPumpHistoryMissingMacError,
  HeatPumpHistoryValidationError,
  getHistoryForRequest,
} from '../services/heatPumpHistoryService';
import { resolveOrganisationId } from './organisation';

export async function postHeatPumpHistory(req: Request, res: Response, next: NextFunction) {
  const organisationId = await resolveOrganisationId(req.user!.id, res);
  if (!organisationId) return;

  try {
    const result = await getHistoryForRequest(
      { userId: req.user!.id, organisationId },
      req.body
    );

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

    if (err instanceof HeatPumpHistoryFeatureDisabledError) {
      return res.status(503).json({
        error: 'heat_pump_history_disabled',
        message: err.message,
      });
    }

    if (err instanceof HeatPumpHistoryDeviceNotFoundError) {
      return res.status(404).json({ message: err.message });
    }

    if (err instanceof HeatPumpHistoryMissingMacError) {
      return res.status(400).json({ message: err.message });
    }

    next(err);
  }
}
