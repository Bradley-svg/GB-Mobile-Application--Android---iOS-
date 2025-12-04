import { query } from '../config/db';

export async function getPushTokensForOrganisation(organisationId: string): Promise<string[]> {
  const res = await query<{ expo_token: string }>(
    `
    select distinct pt.expo_token
    from push_tokens pt
    join users u on pt.user_id = u.id
    where u.organisation_id = $1
  `,
    [organisationId]
  );

  return res.rows.map((r: { expo_token: string }) => r.expo_token);
}

export async function getLatestPushToken(): Promise<string | null> {
  const res = await query<{ expo_token: string }>(
    `
    select expo_token
    from push_tokens
    order by coalesce(last_used_at, created_at) desc
    limit 1
  `
  );

  return res.rows[0]?.expo_token ?? null;
}

export async function getExistingUserPushToken(userId: string, token: string) {
  const existing = await query<{ last_used_at: Date | null }>(
    `
    select last_used_at
    from push_tokens
    where user_id = $1 and expo_token = $2
  `,
    [userId, token]
  );

  return existing.rows[0] ?? null;
}

export async function upsertUserPushToken(userId: string, token: string) {
  await query(
    `
    insert into push_tokens (user_id, expo_token, created_at, last_used_at)
    values ($1, $2, now(), null)
    on conflict (user_id, expo_token)
    do update set last_used_at = now()
    returning *
  `,
    [userId, token]
  );
}
