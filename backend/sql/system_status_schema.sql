create table if not exists system_status (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  mqtt_last_ingest_at timestamptz null,
  mqtt_last_error_at timestamptz null,
  mqtt_last_error text null,
  control_last_command_at timestamptz null,
  control_last_error_at timestamptz null,
  control_last_error text null,
  alerts_worker_last_heartbeat_at timestamptz null,
  push_last_sample_at timestamptz null,
  push_last_error text null,
  updated_at timestamptz not null default now()
);

alter table system_status
  alter column payload set default '{}'::jsonb;

alter table system_status
  add column if not exists mqtt_last_ingest_at timestamptz null,
  add column if not exists mqtt_last_error_at timestamptz null,
  add column if not exists mqtt_last_error text null,
  add column if not exists control_last_command_at timestamptz null,
  add column if not exists control_last_error_at timestamptz null,
  add column if not exists control_last_error text null,
  add column if not exists alerts_worker_last_heartbeat_at timestamptz null,
  add column if not exists push_last_sample_at timestamptz null,
  add column if not exists push_last_error text null;
