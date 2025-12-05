import { query } from '../config/db';
import { logger } from '../config/logger';

export interface UserPreferencesRow {
  user_id: string;
  alerts_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const log = logger.child({ module: 'userPreferencesRepository' });

export async function getUserPreferences(userId: string): Promise<UserPreferencesRow | null> {
  try {
    const res = await query<UserPreferencesRow>(
      `
      select user_id, alerts_enabled, created_at, updated_at
      from user_preferences
      where user_id = $1
    `,
      [userId]
    );

    return res.rows[0] ?? null;
  } catch (err) {
    log.error({ err, userId }, 'failed to fetch user preferences');
    throw err;
  }
}

export async function upsertUserPreferences(
  userId: string,
  updates: { alerts_enabled?: boolean }
): Promise<UserPreferencesRow> {
  const alertsEnabled =
    typeof updates.alerts_enabled === 'boolean' ? updates.alerts_enabled : null;

  try {
    const res = await query<UserPreferencesRow>(
      `
      insert into user_preferences (user_id, alerts_enabled)
      values ($1, coalesce($2, true))
      on conflict (user_id)
      do update set alerts_enabled = excluded.alerts_enabled, updated_at = now()
      returning user_id, alerts_enabled, created_at, updated_at
    `,
      [userId, alertsEnabled]
    );

    return res.rows[0];
  } catch (err) {
    log.error({ err, userId, updates }, 'failed to upsert user preferences');
    throw err;
  }
}
