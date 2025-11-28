create table if not exists push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  expo_token text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists push_tokens_user_token_uidx
  on push_tokens(user_id, expo_token);
