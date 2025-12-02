import { query } from '../db/pool';

export type StatusRecord<T = unknown> = {
  payload: T;
  updated_at: Date;
};

const STATUS_ROW_KEY = 'global';
const STATUS_COLUMNS = [
  'mqtt_last_ingest_at',
  'mqtt_last_error_at',
  'mqtt_last_error',
  'control_last_command_at',
  'control_last_error_at',
  'control_last_error',
  'alerts_worker_last_heartbeat_at',
  'push_last_sample_at',
  'push_last_error',
] as const;

export type SystemStatus = {
  key: string;
  payload: Record<string, unknown>;
  mqtt_last_ingest_at: Date | null;
  mqtt_last_error_at: Date | null;
  mqtt_last_error: string | null;
  control_last_command_at: Date | null;
  control_last_error_at: Date | null;
  control_last_error: string | null;
  alerts_worker_last_heartbeat_at: Date | null;
  push_last_sample_at: Date | null;
  push_last_error: string | null;
  updated_at: Date;
};

type StatusPatch = Partial<Omit<SystemStatus, 'key' | 'payload' | 'updated_at'>>;

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

async function ensureGlobalRow() {
  await query(
    `
    insert into system_status (key, payload)
    values ($1, '{}'::jsonb)
    on conflict (key) do nothing
  `,
    [STATUS_ROW_KEY]
  );
}

const MAX_ERROR_LENGTH = 200;
function normalizeError(err: unknown): string | null {
  if (err == null) return null;
  if (err instanceof Error) {
    return err.message.slice(0, MAX_ERROR_LENGTH);
  }
  if (typeof err === 'string') {
    return err.slice(0, MAX_ERROR_LENGTH);
  }
  try {
    const encoded = JSON.stringify(err);
    return encoded ? encoded.slice(0, MAX_ERROR_LENGTH) : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

export async function getSystemStatus(): Promise<SystemStatus | null> {
  await ensureGlobalRow();

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
    [STATUS_ROW_KEY]
  );

  if (res.rowCount === 0) return null;
  return res.rows[0];
}

export async function updateStatusPatch(patch: StatusPatch): Promise<void> {
  await ensureGlobalRow();
  const allowedColumns = new Set<string>(STATUS_COLUMNS as readonly string[]);

  const entries = Object.entries(patch).filter(
    ([col, value]) => allowedColumns.has(col) && value !== undefined
  );
  if (entries.length === 0) return;

  const setFragments: string[] = [];
  const values: Array<string | Date | null> = [];

  entries.forEach(([col, value], idx) => {
    setFragments.push(`${col} = $${idx + 1}`);
    values.push(value as string | Date | null);
  });

  setFragments.push(`updated_at = now()`);
  values.push(STATUS_ROW_KEY);

  await query(
    `
    update system_status
    set ${setFragments.join(', ')}
    where key = $${values.length}
  `,
    values
  );
}

export async function markAlertsWorkerHeartbeat(now: Date = new Date()) {
  await updateStatusPatch({ alerts_worker_last_heartbeat_at: now });
}

export async function markMqttIngestSuccess(now: Date = new Date()) {
  await updateStatusPatch({ mqtt_last_ingest_at: now });
}

export async function markMqttIngestError(now: Date = new Date(), err: unknown) {
  await updateStatusPatch({
    mqtt_last_error_at: now,
    mqtt_last_error: normalizeError(err),
  });
}

export async function markControlCommandSuccess(now: Date = new Date()) {
  await updateStatusPatch({ control_last_command_at: now });
}

export async function markControlCommandError(now: Date = new Date(), err: unknown) {
  await updateStatusPatch({
    control_last_error_at: now,
    control_last_error: normalizeError(err),
  });
}

export async function markPushSampleResult(now: Date = new Date(), err: unknown) {
  await updateStatusPatch({
    push_last_sample_at: now,
    push_last_error: normalizeError(err),
  });
}
