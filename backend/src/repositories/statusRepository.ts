import { query } from '../config/db';
import { SystemStatus } from '../domain/status';

export async function ensureStatusRow(key: string) {
  await query(
    `
    insert into system_status (key, payload)
    values ($1, '{}'::jsonb)
    on conflict (key) do nothing
  `,
    [key]
  );
}

export async function upsertStatusPayload<T extends object>(key: string, payload: T) {
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

export async function getSystemStatus(key: string): Promise<SystemStatus | null> {
  const res = await query<SystemStatus>(
    `
    select key, payload,
           mqtt_last_ingest_at,
           mqtt_last_error_at,
           mqtt_last_error,
           control_last_command_at,
           control_last_error_at,
           control_last_error,
           alerts_worker_last_heartbeat_at,
           push_last_sample_at,
           push_last_error,
           updated_at
    from system_status
    where key = $1
  `,
    [key]
  );

  if (res.rowCount === 0) return null;
  return res.rows[0];
}

export async function updateStatusColumns(
  key: string,
  setFragments: string[],
  values: Array<string | Date | null>
) {
  const fragments = [...setFragments, 'updated_at = now()'];
  const params = [...values, key];

  await query(
    `
    update system_status
    set ${fragments.join(', ')}
    where key = $${params.length}
  `,
    params
  );
}
