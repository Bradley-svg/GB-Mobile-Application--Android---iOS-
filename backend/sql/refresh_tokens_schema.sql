create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  revoked boolean not null default false,
  revoked_reason text,
  revoked_at timestamptz,
  replaced_by uuid references refresh_tokens(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_user_idx
  on refresh_tokens(user_id, created_at desc);
