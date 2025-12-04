import { query } from '../config/db';

type CommandStatus = 'pending' | 'success' | 'failed';

export type ControlCommandRow = {
  id: string;
  device_id: string;
  user_id: string;
  command_type: string;
  payload: any;
  status: CommandStatus;
  requested_at: Date;
  completed_at: Date | null;
  error_message: string | null;
};

export async function insertCommandRow(
  deviceId: string,
  userId: string,
  commandType: string,
  payload: object,
  status: CommandStatus,
  errorMessage?: string
) {
  const res = await query<ControlCommandRow>(
    `
    insert into control_commands (device_id, user_id, command_type, payload, status, completed_at, error_message)
    values ($1, $2, $3, $4::jsonb, $5, case when $5 = 'pending' then null else now() end, $6)
    returning *
  `,
    [deviceId, userId, commandType, JSON.stringify(payload), status, errorMessage || null]
  );
  return res.rows[0];
}

export async function markCommandSuccess(commandId: string) {
  await query(
    `
    update control_commands
    set status = 'success',
        completed_at = now()
    where id = $1
  `,
    [commandId]
  );
}

export async function markCommandFailure(commandId: string, errorMessage: string) {
  await query(
    `
    update control_commands
    set status = 'failed',
        completed_at = now(),
        error_message = $2
    where id = $1
  `,
    [commandId, errorMessage]
  );
}
