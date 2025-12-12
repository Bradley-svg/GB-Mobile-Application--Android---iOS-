/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('demo_tenants', {
    org_id: { type: 'uuid', notNull: true, primaryKey: true, references: 'organisations' },
    enabled: { type: 'boolean', notNull: true, default: false },
    hero_device_id: { type: 'uuid', references: 'devices' },
    hero_device_mac: { type: 'text' },
    seeded_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('demo_tenants', 'org_id', { unique: true });

  pgm.sql(`
    insert into demo_tenants (org_id, enabled, hero_device_id, hero_device_mac, seeded_at, created_at, updated_at)
    select
      o.id,
      o.is_demo,
      hero.id,
      hero.mac,
      o.demo_seeded_at,
      now(),
      now()
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
    where o.is_demo = true
    on conflict (org_id) do update
      set enabled = excluded.enabled,
          hero_device_id = coalesce(excluded.hero_device_id, demo_tenants.hero_device_id),
          hero_device_mac = coalesce(excluded.hero_device_mac, demo_tenants.hero_device_mac),
          seeded_at = coalesce(excluded.seeded_at, demo_tenants.seeded_at),
          updated_at = now()
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('demo_tenants');
};
