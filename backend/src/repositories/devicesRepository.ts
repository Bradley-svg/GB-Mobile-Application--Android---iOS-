import { query } from '../config/db';

export type DeviceRow = {
  id: string;
  site_id: string;
  name?: string;
  type?: string;
  external_id?: string | null;
  mac?: string | null;
  status?: string | null;
  last_seen_at?: Date | null;
  controller?: string | null;
  firmware_version?: string | null;
  connectivity_status?: string | null;
};

export type OfflineDeviceRow = {
  id: string;
  site_id: string;
  last_seen_at: Date;
  muted_until: Date | null;
};

export type DeviceSnapshotRow = {
  id: string;
  site_id: string;
  supply_temp: number | null;
};

export type DeviceLastSeenRow = {
  id: string;
  site_id: string;
  last_seen_at: Date;
  data: unknown;
};

export async function getDeviceById(id: string, organisationId?: string) {
  const baseSql = `
    select d.id,
           d.site_id,
           d.name,
           d.type,
           d.external_id,
           d.mac,
           d.status,
           coalesce(ds.last_seen_at, d.last_seen_at) as last_seen_at,
           d.controller,
           d.firmware_version,
           d.connectivity_status
    from devices d
    left join device_snapshots ds on ds.device_id = d.id
    ${organisationId ? 'join sites s on d.site_id = s.id' : ''}
    where d.id = $1
    ${organisationId ? 'and s.organisation_id = $2' : ''}
  `;

  const params = organisationId ? [id, organisationId] : [id];
  const result = await query<DeviceRow>(baseSql, params);
  return result.rows[0] || null;
}

export async function getDevicesForSite(siteId: string, organisationId: string) {
  const result = await query<DeviceRow>(
    `
    select d.id,
           d.site_id,
           d.name,
           d.type,
           d.external_id,
           d.mac,
           d.status,
           coalesce(ds.last_seen_at, d.last_seen_at) as last_seen_at,
           d.controller,
           d.firmware_version,
           d.connectivity_status
    from devices d
    left join device_snapshots ds on ds.device_id = d.id
    join sites s on d.site_id = s.id
    where d.site_id = $1
      and s.organisation_id = $2
  `,
    [siteId, organisationId]
  );
  return result.rows;
}

export async function getDeviceByExternalId(externalId: string): Promise<{ id: string; site_external_id: string | null } | null> {
  const res = await query<{ id: string; site_external_id: string | null }>(
    `
    select d.id, s.external_id as site_external_id
    from devices d
    left join sites s on d.site_id = s.id
    where d.external_id = $1
  `,
    [externalId]
  );
  return res.rows[0] || null;
}

export async function findOfflineDevices(thresholdMinutes: number): Promise<OfflineDeviceRow[]> {
  const offline = await query<OfflineDeviceRow>(
    `
    select d.id, d.site_id, s.last_seen_at
         , max(a.muted_until) as muted_until
    from devices d
    join device_snapshots s on d.id = s.device_id
    left join alerts a on a.device_id = d.id and a.type = 'offline'
    where s.last_seen_at < now() - ($1 || ' minutes')::interval
    group by d.id, d.site_id, s.last_seen_at
  `,
    [thresholdMinutes]
  );

  return offline.rows;
}

export async function findOnlineDevices(thresholdMinutes: number) {
  const online = await query<{ id: string; site_id: string; last_seen_at: Date }>(
    `
    select d.id, d.site_id, s.last_seen_at
    from devices d
    join device_snapshots s on d.id = s.device_id
    where s.last_seen_at >= now() - ($1 || ' minutes')::interval
  `,
    [thresholdMinutes]
  );

  return online.rows;
}

export async function getDeviceSnapshotTemperatures() {
  const res = await query<DeviceSnapshotRow>(
    `
    select d.id, d.site_id,
           coalesce(
             (s.data->'metrics'->>'supply_temp')::double precision,
             (s.data->'raw'->'sensor'->>'supply_temperature_c')::double precision
           ) as supply_temp
    from devices d
    join device_snapshots s on d.id = s.device_id
  `
  );

  return res.rows;
}

export async function getDeviceLastSeen(deviceIds?: string[]) {
  const params: Array<string[] | string> = [];
  let filterClause = '';
  if (deviceIds && deviceIds.length > 0) {
    params.push(deviceIds);
    filterClause = 'where d.id = ANY($1)';
  }

  const res = await query<DeviceLastSeenRow>(
    `
    select d.id, d.site_id, s.last_seen_at, s.data
    from devices d
    join device_snapshots s on d.id = s.device_id
    ${filterClause}
  `,
    params
  );

  return res.rows;
}

export type DeviceSearchRow = DeviceRow & {
  site_name: string;
  site_city: string | null;
};

export type DeviceSummaryRow = {
  id: string;
  site_id: string;
  name: string | null;
  site_name: string | null;
  status: string | null;
  mac: string | null;
  last_seen_at: Date | null;
};

export async function searchDevices(options: {
  organisationId: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: string[] = ['s.organisation_id = $1'];
  const params: Array<string | number> = [options.organisationId];
  let idx = 2;

  if (options.search) {
    where.push('(d.name ilike $' + idx + ' or s.name ilike $' + idx + ' or s.city ilike $' + idx + ')');
    params.push(`%${options.search}%`);
    idx += 1;
  }

  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const res = await query<DeviceSearchRow>(
    `
    select d.id,
           d.site_id,
           d.name,
           d.type,
           d.external_id,
           d.mac,
           d.status,
           coalesce(ds.last_seen_at, d.last_seen_at) as last_seen_at,
           d.controller,
           d.firmware_version,
           d.connectivity_status,
           s.name as site_name,
           s.city as site_city
    from devices d
    join sites s on d.site_id = s.id
    left join device_snapshots ds on ds.device_id = d.id
    where ${where.join(' and ')}
    order by d.name asc
    limit ${limit}
    offset ${offset}
  `,
    params
  );

  return res.rows;
}

export async function findDeviceSummaryById(
  id: string,
  organisationId: string
): Promise<DeviceSummaryRow | null> {
  const res = await query<DeviceSummaryRow>(
    `
    select d.id,
           d.site_id,
           d.name,
           s.name as site_name,
           d.status,
           d.mac,
           coalesce(ds.last_seen_at, d.last_seen_at) as last_seen_at
    from devices d
    join sites s on d.site_id = s.id
    left join device_snapshots ds on ds.device_id = d.id
    where d.id = $1
      and s.organisation_id = $2
    limit 1
  `,
    [id, organisationId]
  );

  return res.rows[0] ?? null;
}

export async function findDeviceByMac(
  mac: string,
  organisationId: string
): Promise<DeviceSummaryRow | null> {
  const res = await query<DeviceSummaryRow>(
    `
    select d.id,
           d.site_id,
           d.name,
           s.name as site_name,
           d.status,
           d.mac,
           coalesce(ds.last_seen_at, d.last_seen_at) as last_seen_at
    from devices d
    join sites s on d.site_id = s.id
    left join device_snapshots ds on ds.device_id = d.id
    where lower(d.mac) = lower($1)
      and s.organisation_id = $2
    limit 1
  `,
    [mac, organisationId]
  );

  return res.rows[0] ?? null;
}
