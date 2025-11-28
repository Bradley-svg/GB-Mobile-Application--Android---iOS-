import { query } from '../db/pool';

export async function getDeviceById(id: string) {
  const result = await query('select * from devices where id = $1', [id]);
  return result.rows[0] || null;
}
