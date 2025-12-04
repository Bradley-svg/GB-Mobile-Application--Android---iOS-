import { query } from '../config/db';

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
