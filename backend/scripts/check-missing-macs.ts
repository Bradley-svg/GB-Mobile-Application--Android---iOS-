import 'dotenv/config';
/* eslint-disable no-console */
import { query, closePool } from '../src/config/db';

type MissingMacRow = {
  id: string;
  site_id: string;
  organisation_id: string;
  name: string | null;
  external_id: string | null;
};

async function main() {
  const res = await query<MissingMacRow>(
    `
    select d.id,
           d.site_id,
           s.organisation_id,
           d.name,
           d.external_id
    from devices d
    join sites s on s.id = d.site_id
    where trim(coalesce(d.mac, '')) = ''
    order by s.organisation_id, d.site_id, d.name nulls last, d.id
  `
  );

  if (res.rowCount === 0) {
    console.log('✅ All devices have MAC addresses.');
    return;
  }

  console.log(`⚠️  ${res.rowCount} devices are missing MAC addresses:\n`);
  res.rows.forEach((row, idx) => {
    console.log(
      `${idx + 1}. org=${row.organisation_id} site=${row.site_id} device=${row.id}` +
        (row.name ? ` name="${row.name}"` : '') +
        (row.external_id ? ` externalId="${row.external_id}"` : '')
    );
  });
}

main()
  .catch((err) => {
    console.error('Failed to check devices for missing MAC addresses:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
