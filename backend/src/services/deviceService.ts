import { query } from '../db/pool';

export async function getDeviceById(id: string, organisationId?: string) {
  const baseSql = `
    select d.*
    from devices d
    ${organisationId ? 'join sites s on d.site_id = s.id' : ''}
    where d.id = $1
    ${organisationId ? 'and s.organisation_id = $2' : ''}
  `;

  const params = organisationId ? [id, organisationId] : [id];
  const result = await query(baseSql, params);
  return result.rows[0] || null;
}
