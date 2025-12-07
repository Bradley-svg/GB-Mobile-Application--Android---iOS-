import { query } from '../config/db';

export type DeviceScheduleRow = {
  id: string;
  device_id: string;
  name: string;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  target_setpoint: number;
  target_mode: string;
  created_at: string;
  updated_at: string;
};

export type UpsertDeviceScheduleInput = {
  deviceId: string;
  name?: string;
  enabled?: boolean;
  startHour: number;
  endHour: number;
  targetSetpoint: number;
  targetMode: string;
};

export async function getScheduleForDevice(deviceId: string): Promise<DeviceScheduleRow | null> {
  const res = await query<DeviceScheduleRow>(
    `
    select *
    from device_schedules
    where device_id = $1
    limit 1
  `,
    [deviceId]
  );

  return res.rows[0] ?? null;
}

export async function upsertScheduleForDevice(
  input: UpsertDeviceScheduleInput
): Promise<DeviceScheduleRow> {
  const res = await query<DeviceScheduleRow>(
    `
    insert into device_schedules (
      device_id,
      name,
      enabled,
      start_hour,
      end_hour,
      target_setpoint,
      target_mode,
      created_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, now(), now())
    on conflict (device_id)
    do update set
      name = excluded.name,
      enabled = excluded.enabled,
      start_hour = excluded.start_hour,
      end_hour = excluded.end_hour,
      target_setpoint = excluded.target_setpoint,
      target_mode = excluded.target_mode,
      updated_at = now()
    returning *
  `,
    [
      input.deviceId,
      input.name ?? 'Daily schedule',
      input.enabled ?? true,
      input.startHour,
      input.endHour,
      input.targetSetpoint,
      input.targetMode,
    ]
  );

  return res.rows[0];
}
