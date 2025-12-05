import { NextFunction, Request, Response } from 'express';
import {
  getUserPreferencesForUser,
  updateUserPreferencesForUser,
  UserPreferencesValidationError,
} from '../services/userPreferencesService';

export async function getUserPreferencesHandler(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;

  try {
    const prefs = await getUserPreferencesForUser(userId);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
}

export async function updateUserPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user!.id;
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const input: { alertsEnabled?: boolean } = {};

  if ('alertsEnabled' in body) {
    if (typeof body.alertsEnabled !== 'boolean') {
      return res.status(400).json({ message: 'Invalid body' });
    }
    input.alertsEnabled = body.alertsEnabled;
  }

  try {
    const prefs = await updateUserPreferencesForUser(userId, input);
    res.json(prefs);
  } catch (err) {
    if (err instanceof UserPreferencesValidationError) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}
