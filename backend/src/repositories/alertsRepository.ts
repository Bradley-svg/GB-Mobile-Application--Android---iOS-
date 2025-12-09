import { query } from '../config/db';

export type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertStatus = 'active' | 'cleared';
export type AlertType = 'offline' | 'high_temp' | 'rule';

export type AlertRow = {
  id: string;
  site_id: string | null;
  device_id: string | null;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  status: AlertStatus;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
  rule_id: string | null;
};

export type AlertWithSite = AlertRow & { resolved_site_id: string | null };
export type AlertCountRow = { severity: AlertSeverity; count: number };

const baseSelect = `
  select id,
         site_id,
         device_id,
         severity,
         type,
         message,
         status,
         first_seen_at,
         last_seen_at,
         acknowledged_by,
         acknowledged_at,
         muted_until,
         rule_id
  from alerts
`;

type FindActiveAlertOptions = {
  deviceId?: string | null;
  siteId?: string | null;
  type: AlertType;
  ruleId?: string | null;
};

export async function findActiveAlert(options: FindActiveAlertOptions): Promise<AlertRow | null> {
  const where: string[] = [`type = $1`, `status = 'active'`];
  const params: Array<string | null> = [options.type];
  let idx = 2;

  if (options.deviceId !== undefined) {
    if (options.deviceId === null) {
      where.push('device_id is null');
    } else {
      where.push(`device_id = $${idx++}`);
      params.push(options.deviceId);
    }
  }

  if (options.siteId !== undefined) {
    if (options.siteId === null) {
      where.push('site_id is null');
    } else {
      where.push(`site_id = $${idx++}`);
      params.push(options.siteId);
    }
  }

  if (options.ruleId !== undefined) {
    if (options.ruleId === null) {
      where.push('rule_id is null');
    } else {
      where.push(`rule_id = $${idx++}`);
      params.push(options.ruleId);
    }
  }

  const existing = await query<AlertRow>(`${baseSelect} where ${where.join(' and ')} limit 1`, params);

  return existing.rows[0] ?? null;
}

export async function updateAlert(
  alertId: string,
  severity: AlertSeverity,
  message: string,
  now: Date
): Promise<AlertRow> {
  const result = await query<AlertRow>(
    `
    update alerts
    set severity = $1,
        message = $2,
        last_seen_at = $3
    where id = $4
    returning *
  `,
    [severity, message, now, alertId]
  );
  return result.rows[0];
}

export async function insertAlert(options: {
  siteId: string | null;
  deviceId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  ruleId?: string | null;
  now: Date;
}): Promise<AlertRow> {
  const { siteId, deviceId, type, severity, message, now, ruleId } = options;

  const insert = await query<AlertRow>(
    `
    insert into alerts (
      site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at, rule_id
    )
    values ($1, $2, $3, $4, $5, 'active', $6, $6, $7)
    returning *
  `,
    [siteId, deviceId, severity, type, message, now, ruleId ?? null]
  );

  return insert.rows[0];
}

export async function clearAlertIfExists(
  deviceId: string,
  type: AlertType,
  now: Date,
  ruleId?: string | null
) {
  const params: Array<string | Date | null> = [deviceId, type, now];
  const clauses: string[] = ['device_id = $1', 'type = $2', "status = 'active'"];
  let idx = 4;

  if (ruleId !== undefined) {
    if (ruleId === null) {
      clauses.push('rule_id is null');
    } else {
      clauses.push(`rule_id = $${idx++}`);
      params.push(ruleId);
    }
  }

  await query(
    `
    update alerts
    set status = 'cleared',
        last_seen_at = $3
    where ${clauses.join(' and ')}
  `,
    params
  );
}

export async function fetchAlerts(filters: {
  siteId?: string;
  severity?: string;
  status?: string;
  limit?: number;
  organisationId: string;
}) {
  const where: string[] = ['s.organisation_id = $1'];
  const params: Array<string | number> = [filters.organisationId];
  let idx = 2;

  if (filters.siteId) {
    where.push(`s.id = $${idx++}`);
    params.push(filters.siteId);
  }
  if (filters.severity) {
    where.push(`a.severity = $${idx++}`);
    params.push(filters.severity);
  }
  if (filters.status) {
    where.push(`a.status = $${idx++}`);
    params.push(filters.status);
  }

  const whereClause = `where ${where.join(' and ')}`;
  const limit = filters.limit ?? 100;

  const result = await query<AlertRow>(
    `
    select a.*, a.rule_id
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    ${whereClause}
    order by a.last_seen_at desc
    limit ${limit}
  `,
    params
  );

  return result.rows;
}

export async function fetchAlertsForDevice(deviceId: string, organisationId: string) {
  const result = await query<AlertRow>(
    `
    select a.*, a.rule_id
    from alerts a
    join devices d on a.device_id = d.id
    join sites s on d.site_id = s.id
    where a.device_id = $1
      and s.organisation_id = $2
    order by a.last_seen_at desc
    limit 50
  `,
    [deviceId, organisationId]
  );
  return result.rows;
}

export async function findAlertForOrganisation(alertId: string, organisationId: string) {
  const res = await query<AlertRow>(
    `
    select a.*, a.rule_id
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    where a.id = $1
      and s.organisation_id = $2
    limit 1
  `,
    [alertId, organisationId]
  );

  return res.rows[0] || null;
}

export async function acknowledgeAlert(alertId: string, userId: string) {
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

export async function muteAlert(alertId: string, minutes: number) {
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

export async function getOrganisationIdForAlert(alertId: string): Promise<string | null> {
  const res = await query<{ organisation_id: string | null }>(
    `
    select s.organisation_id
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    where a.id = $1
    limit 1
  `,
    [alertId]
  );

  return res.rows[0]?.organisation_id ?? null;
}

export async function getActiveAlertsForOrganisation(
  organisationId: string
): Promise<AlertWithSite[]> {
  const res = await query<AlertWithSite>(
    `
    select a.*,
           a.rule_id,
           coalesce(a.site_id, d.site_id) as resolved_site_id
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    where a.status = 'active'
      and s.organisation_id = $1
  `,
    [organisationId]
  );

  return res.rows;
}

export async function getActiveAlertCounts(
  organisationId?: string
): Promise<{ warning: number; critical: number }> {
  const params: string[] = [];
  let filter = "where a.status = 'active'";
  if (organisationId) {
    params.push(organisationId);
    filter = `
      where a.status = 'active'
        and s.organisation_id = $1
    `;
  }

  const res = await query<AlertCountRow>(
    `
    select a.severity as severity, count(*)::int as count
    from alerts a
    left join devices d on a.device_id = d.id
    left join sites s on coalesce(a.site_id, d.site_id) = s.id
    ${filter}
    group by a.severity
  `,
    params
  );

  const warning = res.rows.find((r) => r.severity === 'warning')?.count ?? 0;
  const critical = res.rows.find((r) => r.severity === 'critical')?.count ?? 0;
  return { warning, critical };
}
