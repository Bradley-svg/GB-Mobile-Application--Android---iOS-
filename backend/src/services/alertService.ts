import { query } from '../db/pool';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'cleared';

export type AlertType = 'offline' | 'high_temp';

export type AlertRow = {
  id: string;
  site_id: string | null;
  device_id: string | null;
  severity: string;
  type: string;
  message: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
};

export async function upsertActiveAlert(options: {
  siteId: string | null;
  deviceId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  now: Date;
}): Promise<AlertRow> {
  const { siteId, deviceId, type, severity, message, now } = options;

  const existing = await query<AlertRow>(
    `
    select *
    from alerts
    where device_id = $1
      and type = $2
      and status = 'active'
    limit 1
  `,
    [deviceId, type]
  );

  if (existing.rowCount > 0) {
    const alert = existing.rows[0];
    const result = await query<AlertRow>(
      `
      update alerts
      set severity = $1,
          message = $2,
          last_seen_at = $3
      where id = $4
      returning *
    `,
      [severity, message, now, alert.id]
    );
    return result.rows[0];
  }

  const insert = await query<AlertRow>(
    `
    insert into alerts (
      site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at
    )
    values ($1, $2, $3, $4, $5, 'active', $6, $6)
    returning *
  `,
    [siteId, deviceId, severity, type, message, now]
  );

  return insert.rows[0];
}

export async function clearAlertIfExists(deviceId: string, type: AlertType, now: Date) {
  await query(
    `
    update alerts
    set status = 'cleared',
        last_seen_at = $3
    where device_id = $1
      and type = $2
      and status = 'active'
  `,
    [deviceId, type, now]
  );
}

export async function getAlerts(filters: {
  siteId?: string;
  severity?: string;
  status?: string;
  limit?: number;
}) {
  const where: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.siteId) {
    where.push(`site_id = $${idx++}`);
    params.push(filters.siteId);
  }
  if (filters.severity) {
    where.push(`severity = $${idx++}`);
    params.push(filters.severity);
  }
  if (filters.status) {
    where.push(`status = $${idx++}`);
    params.push(filters.status);
  }

  const whereClause = where.length ? `where ${where.join(' and ')}` : '';
  const limit = filters.limit ?? 100;

  const result = await query<AlertRow>(
    `
    select *
    from alerts
    ${whereClause}
    order by last_seen_at desc
    limit ${limit}
  `,
    params
  );

  return result.rows;
}

export async function getAlertsForDevice(deviceId: string) {
  const result = await query<AlertRow>(
    `
    select *
    from alerts
    where device_id = $1
    order by last_seen_at desc
    limit 50
  `,
    [deviceId]
  );
  return result.rows;
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<AlertRow | null> {
  const res = await query<AlertRow>(
    `
    update alerts
    set acknowledged_by = $1,
        acknowledged_at = now()
    where id = $2
    returning *
  `,
    [userId, alertId]
  );
  return res.rows[0] || null;
}

export async function muteAlert(alertId: string, minutes: number): Promise<AlertRow | null> {
  const res = await query<AlertRow>(
    `
    update alerts
    set muted_until = now() + ($2 || ' minutes')::interval
    where id = $1
    returning *
  `,
    [alertId, minutes]
  );
  return res.rows[0] || null;
}
