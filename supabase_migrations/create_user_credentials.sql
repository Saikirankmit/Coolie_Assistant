-- Supabase migration: create user_credentials table (simpler schema)
-- This version uses user_id as the single primary key (one row per user).

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id text PRIMARY KEY,
  gmail_client_id text,
  gmail_client_secret text,
  gmail_access_token text,
  gmail_refresh_token text,
  token_expiry timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  data jsonb
);

-- Notes:
-- 1) This schema enforces at most one credentials row per user (user_id PK).
-- 2) If you previously had multiple rows per user (e.g., different 'type' values),
--    you'll need to deduplicate before applying the PK change (see migration steps).
