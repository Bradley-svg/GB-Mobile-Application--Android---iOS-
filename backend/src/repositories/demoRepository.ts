import { query } from '../config/db';

export type DemoStatusRow = {
  enabled: boolean;
  seeded_at: Date | null;
  hero_device_id: string | null;
  hero_device_mac: string | null;
};

export async function getDemoMetadataForOrganisation(
  organisationId: string
): Promise<DemoStatusRow | null> {
  let row: DemoStatusRow | undefined;
  try {
    const res = await query<DemoStatusRow>(
      `
      select
        dt.enabled,
        dt.seeded_at,
        coalesce(dt.hero_device_id, hero.id) as hero_device_id,
        coalesce(dt.hero_device_mac, hero.mac) as hero_device_mac
      from demo_tenants dt
      left join lateral (
        select d.id, d.mac
        from devices d
        join sites s on d.site_id = s.id
        where s.organisation_id = dt.org_id
          and d.is_demo = true
        order by d.is_demo_hero desc, d.created_at desc
        limit 1
      ) hero on true
      where dt.org_id = $1
      limit 1
    `,
      [organisationId]
    );
    row = res.rows[0];
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError?.code !== '42P01') {
      throw err;
    }
  }

  if (row) {
    return row;
  }

  const legacy = await query<DemoStatusRow>(
    `
    select
      o.is_demo as enabled,
      o.demo_seeded_at as seeded_at,
      hero.id as hero_device_id,
      hero.mac as hero_device_mac
    from organisations o
    left join lateral (
      select d.id, d.mac
      from devices d
      join sites s on d.site_id = s.id
      where s.organisation_id = o.id
        and d.is_demo = true
      order by d.is_demo_hero desc, d.created_at desc
      limit 1
    ) hero on true
    where o.id = $1
    limit 1
  `,
    [organisationId]
  );

  return legacy.rows[0] ?? null;
}
