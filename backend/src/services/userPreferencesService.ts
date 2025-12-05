import { logger } from '../config/logger';
import {
  getUserPreferences,
  upsertUserPreferences,
  type UserPreferencesRow,
} from '../repositories/userPreferencesRepository';

export interface UserPreferences {
  alertsEnabled: boolean;
}

export class UserPreferencesValidationError extends Error {
  constructor(message = 'Invalid preferences') {
    super(message);
    this.name = 'UserPreferencesValidationError';
  }
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  alertsEnabled: true,
};

const log = logger.child({ module: 'userPreferencesService' });

function mapRowToPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    alertsEnabled: row.alerts_enabled,
  };
}

export async function getUserPreferencesForUser(userId: string): Promise<UserPreferences> {
  try {
    const row = await getUserPreferences(userId);
    if (!row) {
      return DEFAULT_USER_PREFERENCES;
    }

    return mapRowToPreferences(row);
  } catch (err) {
    log.error({ err, userId }, 'failed to load user preferences');
    throw err;
  }
}

export async function updateUserPreferencesForUser(
  userId: string,
  input: Partial<UserPreferences>
): Promise<UserPreferences> {
  const updates: { alerts_enabled?: boolean } = {};

  if (typeof input.alertsEnabled === 'boolean') {
    updates.alerts_enabled = input.alertsEnabled;
  }

  if (Object.keys(updates).length === 0) {
    throw new UserPreferencesValidationError('No preferences provided');
  }

  try {
    const row = await upsertUserPreferences(userId, updates);
    const prefs = mapRowToPreferences(row);

    log.info({ userId, preferences: prefs }, 'user preferences updated');
    return prefs;
  } catch (err) {
    log.error({ err, userId, input }, 'failed to update user preferences');
    throw err;
  }
}
