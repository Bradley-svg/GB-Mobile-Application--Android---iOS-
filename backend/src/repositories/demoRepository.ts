import { query } from '../config/db';

export type DemoStatusRow = {
  is_demo_org: boolean;
  demo_seeded_at: Date | null;
  hero_device_id: string | null;
  hero_device_mac: string | null;
};

export async function getDemoMetadataForOrganisation(
  organisationId: string
): Promise<DemoStatusRow | null> {
  const res = await query<DemoStatusRow>(
    `
    select
      o.is_demo as is_demo_org,
      o.demo_seeded_at,
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

  return res.rows[0] ?? null;
}
