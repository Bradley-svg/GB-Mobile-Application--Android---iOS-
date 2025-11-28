-- Telemetry tables for storing heat pump metrics

create table if not exists telemetry_points (
  id bigserial primary key,
  device_id uuid not null references devices(id) on delete cascade,
  metric text not null,
  ts timestamptz not null,
  value double precision not null,
  quality text,
  created_at timestamptz not null default now()
);

create index if not exists telemetry_points_device_metric_ts_idx
  on telemetry_points (device_id, metric, ts desc);

create table if not exists device_snapshots (
  device_id uuid primary key references devices(id) on delete cascade,
  last_seen_at timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
