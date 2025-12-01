import { query } from '../db/pool';

export async function getSitesForOrganisation(organisationId: string) {
  const result = await query('select * from sites where organisation_id = $1 order by name', [
    organisationId,
  ]);
  return result.rows;
}

export async function getSiteById(id: string, organisationId: string) {
  const result = await query('select * from sites where id = $1 and organisation_id = $2', [
    id,
    organisationId,
  ]);
  return result.rows[0] || null;
}

export async function getDevicesForSite(siteId: string, organisationId: string) {
  const result = await query(
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
