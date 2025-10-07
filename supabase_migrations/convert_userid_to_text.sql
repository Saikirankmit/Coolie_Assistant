-- Migration: convert user_id columns from uuid to text
-- Run in Supabase SQL editor. This migration is destructive if your user_id data relies on UUID type constraints.

BEGIN;

-- reminders: create a temporary column, copy as text, drop old, rename
ALTER TABLE public.reminders ADD COLUMN user_id_text text;
UPDATE public.reminders SET user_id_text = user_id::text;
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_pkey;
ALTER TABLE public.reminders DROP COLUMN user_id;
ALTER TABLE public.reminders RENAME COLUMN user_id_text TO user_id;
-- re-add primary key if needed; the table uses id as primary key already

-- user_preferences: similar migration
ALTER TABLE public.user_preferences ADD COLUMN user_id_text text;
UPDATE public.user_preferences SET user_id_text = user_id::text;
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_pkey;
ALTER TABLE public.user_preferences DROP COLUMN user_id;
ALTER TABLE public.user_preferences RENAME COLUMN user_id_text TO user_id;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS reminders_user_idx ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS user_preferences_user_idx ON public.user_preferences(user_id);

COMMIT;

-- NOTE: if your app writes UUIDs as strings (Firebase UID is not a UUID) you should use text.
-- Always backup data or test in a staging DB before running migrations on production.
