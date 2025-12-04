import { Response } from 'express';
import { getUserContext, requireOrganisationId } from '../services/userService';

export async function resolveOrganisationId(userId: string, res: Response): Promise<string | null> {
  const user = await getUserContext(userId);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  try {
    return requireOrganisationId(user);
  } catch {
    res.status(403).json({ message: 'User not assigned to an organisation' });
    return null;
  }
}
