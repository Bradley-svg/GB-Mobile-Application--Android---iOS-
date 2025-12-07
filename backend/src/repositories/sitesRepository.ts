import { query } from '../config/db';

export type SiteRow = {
  id: string;
  organisation_id: string;
  name: string;
  city?: string | null;
  status?: string | null;
  last_seen_at?: Date | null;
  online_devices?: number | null;
  device_count_online?: number | null;
  external_id?: string | null;
};

export type SiteWithStatsRow = SiteRow & {
  latest_device_seen_at: Date | null;
  device_count: number;
};

export async function getSitesForOrganisation(
  organisationId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
) {
  const where: string[] = ['s.organisation_id = $1'];
  const params: Array<string | number> = [organisationId];
  let idx = 2;

  if (options.search) {
    where.push(
      '(s.name ilike $' +
        idx +
        ' or s.city ilike $' +
        idx +
        ' or exists (select 1 from devices d2 where d2.site_id = s.id and d2.name ilike $' +
        idx +
        '))'
    );
    params.push(`%${options.search}%`);
    idx += 1;
  }

  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const result = await query<SiteWithStatsRow>(
    `
    select s.id,
           s.organisation_id,
           s.name,
           s.city,
           s.status,
           s.last_seen_at,
           s.online_devices,
           s.device_count_online,
           s.external_id,
           coalesce(max(ds.last_seen_at), max(d.last_seen_at)) as latest_device_seen_at,
           count(d.id) as device_count
    from sites s
    left join devices d on d.site_id = s.id
    left join device_snapshots ds on ds.device_id = d.id
    where ${where.join(' and ')}
    group by s.id
    order by s.name asc
    limit ${limit}
    offset ${offset}
  `,
    params
  );
  return result.rows;
}

export async function getSiteById(id: string, organisationId: string) {
  const result = await query<SiteWithStatsRow>(
    `
    select s.id,
           s.organisation_id,
           s.name,
           s.city,
           s.status,
           s.last_seen_at,
           s.online_devices,
           s.device_count_online,
           s.external_id,
           coalesce(max(ds.last_seen_at), max(d.last_seen_at)) as latest_device_seen_at,
           count(d.id) as device_count
    from sites s
    left join devices d on d.site_id = s.id
    left join device_snapshots ds on ds.device_id = d.id
    where s.id = $1
      and s.organisation_id = $2
    group by s.id
  `,
    [id, organisationId]
  );
  return result.rows[0] || null;
}
