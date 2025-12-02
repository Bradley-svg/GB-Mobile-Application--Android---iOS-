create table if not exists system_status (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
