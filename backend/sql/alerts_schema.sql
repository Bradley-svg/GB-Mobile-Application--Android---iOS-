create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),

  site_id uuid references sites(id),
  device_id uuid references devices(id),

  severity text not null,  -- e.g. 'info' | 'warning' | 'critical'
  type text not null,      -- e.g. 'offline' | 'high_temp'
  message text not null,

  status text not null,    -- 'active' | 'cleared'
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,

  acknowledged_by uuid references users(id),
  acknowledged_at timestamptz,
  muted_until timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists alerts_device_status_idx
  on alerts (device_id, status);

create index if not exists alerts_site_status_idx
  on alerts (site_id, status);

create index if not exists alerts_status_severity_idx
  on alerts (status, severity);
