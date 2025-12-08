import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/authService';
import type { UserRole } from '../repositories/usersRepository';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.slice(7);
  try {
    const { userId, role } = verifyAccessToken(token);
    req.user = { id: userId, role };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
