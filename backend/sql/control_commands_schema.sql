create table if not exists control_commands (
  id uuid primary key default uuid_generate_v4(),

  device_id uuid not null references devices(id) on delete cascade,
  user_id uuid not null references users(id),
  command_type text not null,
  payload jsonb not null,
  status text not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create index if not exists control_commands_device_idx
  on control_commands (device_id, requested_at desc);
