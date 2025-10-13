-- Migration: normalize user_credentials table to support multiple integration types
-- Adds 'type' and 'data' (jsonb) columns and migrates existing gmail_* columns into data.
-- Adds a unique constraint on (user_id, type).

BEGIN;

-- add type and data columns if missing
ALTER TABLE IF EXISTS user_credentials
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'gmail',
  ADD COLUMN IF NOT EXISTS data jsonb;

-- populate data column for existing rows (only if data is NULL)
UPDATE user_credentials
SET data = jsonb_build_object(
  'gmail_client_id', gmail_client_id,
  'gmail_client_secret', gmail_client_secret,
  'gmail_access_token', gmail_access_token,
  'gmail_refresh_token', gmail_refresh_token,
  'token_expiry', to_char(token_expiry, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)
WHERE data IS NULL AND (gmail_client_id IS NOT NULL OR gmail_access_token IS NOT NULL OR gmail_refresh_token IS NOT NULL);

-- make sure there is a unique constraint on (user_id, type) so upsert with onConflict works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'u' AND t.relname = 'user_credentials' AND array_to_string(c.conkey, ',') LIKE '%'
  ) THEN
    -- add unique constraint if it doesn't exist
    BEGIN
      ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_user_id_type_unique UNIQUE (user_id, type);
    EXCEPTION WHEN duplicate_object THEN
      -- ignore if it was created concurrently
    END;
  ELSE
    -- ensure there's a constraint specifically on (user_id, type)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint pc
      JOIN pg_class cl ON pc.conrelid = cl.oid
      WHERE cl.relname = 'user_credentials' AND pc.contype = 'u' AND (
        (SELECT string_agg(att.attname, ',') FROM unnest(pc.conkey) WITH ORDINALITY AS uk(attnum, ord) JOIN pg_attribute att ON att.attnum = uk.attnum AND att.attrelid = cl.oid) = 'user_id,type'
      )
    ) THEN
      BEGIN
        ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_user_id_type_unique UNIQUE (user_id, type);
      EXCEPTION WHEN duplicate_object THEN
        -- ignore
      END;
    END IF;
  END IF;
END$$;

COMMIT;

-- NOTE:
-- After running this migration you can optionally drop the old gmail_* columns once you've verified stored data is correct.
-- e.g.
-- ALTER TABLE user_credentials DROP COLUMN IF EXISTS gmail_client_id, DROP COLUMN IF EXISTS gmail_client_secret, DROP COLUMN IF EXISTS gmail_access_token, DROP COLUMN IF EXISTS gmail_refresh_token, DROP COLUMN IF EXISTS token_expiry;

-- To apply:
-- 1) In Supabase Dashboard: SQL Editor -> paste this file and run.
-- 2) Or use psql against your Supabase DB connection string and run: psql <conn_string> -f 20251009_fix_user_credentials.sql
-- After applying, retry the OAuth flow; upsertUserCredentials should now succeed.
