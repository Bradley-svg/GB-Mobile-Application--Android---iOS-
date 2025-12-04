import { query } from '../config/db';

export type DeviceRow = {
  id: string;
  site_id: string;
  name?: string;
  type?: string;
  external_id?: string | null;
  mac?: string | null;
  status?: string | null;
  last_seen_at?: Date;
  controller?: string | null;
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

export async function getDeviceById(id: string, organisationId?: string) {
  const baseSql = `
    select d.*
    from devices d
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
    select d.*
    from devices d
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
