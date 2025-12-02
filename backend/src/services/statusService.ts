import { query } from '../db/pool';

export type StatusRecord<T = unknown> = {
  payload: T;
  updated_at: Date;
};

export async function upsertStatus<T extends object>(key: string, payload: T) {
  await query(
    `
    insert into system_status (key, payload, updated_at)
    values ($1, $2::jsonb, now())
    on conflict (key)
    do update set payload = excluded.payload,
                  updated_at = now()
  `,
    [key, JSON.stringify(payload)]
  );
}

export async function getStatus<T = unknown>(key: string): Promise<StatusRecord<T> | null> {
  const res = await query<{ payload: T; updated_at: Date }>(
    `
    select payload, updated_at
    from system_status
    where key = $1
  `,
    [key]
  );

  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return { payload: row.payload, updated_at: row.updated_at };
}
