-- Supabase migration: create user_credentials table

create table if not exists user_credentials (
  user_id text primary key,
  gmail_client_id text,
  gmail_client_secret text,
  gmail_access_token text,
  gmail_refresh_token text,
  token_expiry timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure user_id references Firebase UID (string). If you're syncing users into a users table, add a foreign key.
-- alter table user_credentials add constraint fk_user foreign key (user_id) references users(id);

-- Example insert (replace values):
-- insert into user_credentials (user_id, gmail_client_id, gmail_client_secret, gmail_access_token, gmail_refresh_token, token_expiry)
-- values ('firebase-uid-123', 'your-client-id', 'redacted-secret', 'ya29.a0Af...', '1//0g...', now() + interval '1 hour');
