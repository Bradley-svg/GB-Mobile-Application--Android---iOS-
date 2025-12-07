import { query } from '../config/db';

export type CommandStatus = 'pending' | 'success' | 'failed';

export type ControlCommandRow = {
  id: string;
  device_id: string;
  user_id: string;
  command_type: string;
  payload: any;
  requested_value: any | null;
  status: CommandStatus;
  requested_at: Date;
  completed_at: Date | null;
  error_message: string | null;
  failure_reason: string | null;
  failure_message: string | null;
  source: string | null;
};

export type ControlCommandWithActor = ControlCommandRow & {
  user_email: string | null;
  user_name: string | null;
};

export type InsertControlCommandInput = {
  deviceId: string;
  userId: string;
  commandType: string;
  payload: object;
  requestedValue?: unknown;
  status: CommandStatus;
  errorMessage?: string;
  failureReason?: string | null;
  failureMessage?: string | null;
  source?: string | null;
};

export type ControlCommand = ControlCommandRow;

export async function insertCommandRow(input: InsertControlCommandInput) {
  const res = await query<ControlCommandRow>(
    `
    insert into control_commands (
      device_id, user_id, command_type, payload, requested_value, status, completed_at,
      error_message, failure_reason, failure_message, source
    )
    values (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6,
      case when $6 = 'pending' then null else now() end,
      $7, $8, $9, $10
    )
    returning *
  `,
    [
      input.deviceId,
      input.userId,
      input.commandType,
      JSON.stringify(input.payload),
      input.requestedValue !== undefined ? JSON.stringify(input.requestedValue) : null,
      input.status,
      input.errorMessage || null,
      input.failureReason || null,
      input.failureMessage || null,
      input.source || 'unknown',
    ]
  );
  return res.rows[0];
}

export async function getLastCommandForDevice(
  deviceId: string
): Promise<ControlCommand | null> {
  const res = await query<ControlCommandRow>(
    `
    select *
    from control_commands
    where device_id = $1
    order by requested_at desc
    limit 1
  `,
    [deviceId]
  );

  return res.rows[0] ?? null;
}

export async function markCommandSuccess(commandId: string) {
  await query(
    `
    update control_commands
    set status = 'success',
        completed_at = now(),
        failure_reason = null,
        failure_message = null,
        error_message = null
    where id = $1
  `,
    [commandId]
  );
}

export async function markCommandFailure(
  commandId: string,
  failureMessage: string,
  failureReason?: string | null
) {
  await query(
    `
    update control_commands
    set status = 'failed',
        completed_at = now(),
        error_message = $2,
        failure_reason = $3,
        failure_message = $2
    where id = $1
  `,
    [commandId, failureMessage, failureReason || null]
  );
}

export async function getCommandsForDevice(
  deviceId: string,
  limit = 20,
  offset = 0
): Promise<ControlCommandWithActor[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  const res = await query<ControlCommandWithActor>(
    `
    select cc.*,
           u.email as user_email,
           u.name as user_name
    from control_commands cc
    left join users u on u.id = cc.user_id
    where cc.device_id = $1
    order by cc.requested_at desc
    limit ${cappedLimit}
    offset ${safeOffset}
  `,
    [deviceId]
  );

  return res.rows;
}
