import { query } from '../../config/db';

export type PushTokenRow = {
  id: string;
  user_id: string;
  org_id: string;
  expo_push_token: string;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export async function upsertPushToken(input: {
  userId: string;
  orgId: string;
  token: string;
  platform: string;
}): Promise<PushTokenRow> {
  const res = await query<PushTokenRow>(
    `
    insert into auth_device_push_tokens (
      user_id,
      org_id,
      expo_push_token,
      platform,
      is_active,
      created_at,
      updated_at,
      last_used_at
    )
    values ($1, $2, $3, $4, true, now(), now(), now())
    on conflict (expo_push_token)
    do update set
      user_id = excluded.user_id,
      org_id = excluded.org_id,
      platform = excluded.platform,
      is_active = true,
      updated_at = now(),
      last_used_at = now()
    returning *
  `,
    [input.userId, input.orgId, input.token, input.platform]
  );

  return res.rows[0];
}

export async function deactivatePushToken(input: { userId: string; token: string }) {
  await query(
    `
    update auth_device_push_tokens
    set is_active = false,
        updated_at = now()
    where user_id = $1
      and expo_push_token = $2
  `,
    [input.userId, input.token]
  );
}

export async function getActiveTokensForOrg(
  orgId: string,
  userIds?: string[]
): Promise<PushTokenRow[]> {
  const params: unknown[] = [orgId];
  let where = 'org_id = $1 and is_active = true';

  if (userIds && userIds.length > 0) {
    params.push(userIds);
    where += ` and user_id = ANY($${params.length}::uuid[])`;
  }

  const res = await query<PushTokenRow>(
    `
    select *
    from auth_device_push_tokens
    where ${where}
  `,
    params
  );

  return res.rows;
}

export async function getActiveTokensForUser(userId: string): Promise<PushTokenRow[]> {
  const res = await query<PushTokenRow>(
    `
    select *
    from auth_device_push_tokens
    where user_id = $1
      and is_active = true
  `,
    [userId]
  );

  return res.rows;
}

export async function getLatestActiveToken(): Promise<string | null> {
  const res = await query<{ expo_push_token: string }>(
    `
    select expo_push_token
    from auth_device_push_tokens
    where is_active = true
    order by coalesce(last_used_at, updated_at, created_at) desc
    limit 1
  `
  );

  return res.rows[0]?.expo_push_token ?? null;
}
