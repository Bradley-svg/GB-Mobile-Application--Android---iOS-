import { query } from '../db/pool';

export async function getSitesForUser(userId: string) {
  const result = await query('select * from sites order by name');
  return result.rows;
}

export async function getSiteById(id: string) {
  const result = await query('select * from sites where id = $1', [id]);
  return result.rows[0] || null;
}

export async function getDevicesForSite(siteId: string) {
  const result = await query('select * from devices where site_id = $1', [siteId]);
  return result.rows;
}
