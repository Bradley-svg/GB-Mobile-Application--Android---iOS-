import { SystemStatus } from '../domain/status';
import {
  ensureStatusRow,
  getSystemStatus as loadSystemStatus,
  updateStatusColumns,
  upsertStatusPayload,
} from '../repositories/statusRepository';

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

type StatusPatch = Partial<Omit<SystemStatus, 'key' | 'payload' | 'updated_at'>>;

export async function upsertStatus<T extends object>(key: string, payload: T) {
  await upsertStatusPayload(key, payload);
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
  await ensureStatusRow(STATUS_ROW_KEY);
  return loadSystemStatus(STATUS_ROW_KEY);
}

export async function updateStatusPatch(patch: StatusPatch): Promise<void> {
  await ensureStatusRow(STATUS_ROW_KEY);
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

  await updateStatusColumns(STATUS_ROW_KEY, setFragments, values);
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
