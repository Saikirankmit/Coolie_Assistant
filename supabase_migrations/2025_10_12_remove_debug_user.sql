-- Migration: remove debug-user rows and ensure simple user_credentials schema
-- Date: 2025-10-12

BEGIN;

-- 1) Remove any debug-user rows
DELETE FROM public.user_credentials WHERE user_id = 'debug-user';

-- 2) Ensure table exists with the simple schema (idempotent)
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

-- 3) If an existing primary key constraint exists but is not on user_id,
--    replace it only when there are no duplicate user_id rows.
DO $$
DECLARE
  dup_count int;
  has_pkey bool;
BEGIN
  -- count duplicates by user_id
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id FROM public.user_credentials GROUP BY user_id HAVING COUNT(*) > 1
  ) s;

  -- detect whether a primary key constraint exists on this table
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'user_credentials' AND con.contype = 'p'
  ) INTO has_pkey;

  IF has_pkey THEN
    -- attempt to drop existing primary key constraint (named user_credentials_pkey)
    BEGIN
      EXECUTE 'ALTER TABLE public.user_credentials DROP CONSTRAINT IF EXISTS user_credentials_pkey';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop existing user_credentials_pkey: %', SQLERRM;
    END;
  END IF;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate user_id values; skipping primary key creation. Resolve duplicates before running PK migration.', dup_count;
  ELSE
    -- safe to (re)create primary key on user_id
    BEGIN
      EXECUTE 'ALTER TABLE public.user_credentials ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (user_id)';
      RAISE NOTICE 'Primary key user_credentials_pkey ensured on (user_id)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to add primary key: %', SQLERRM;
    END;
  END IF;
END$$;

COMMIT;
