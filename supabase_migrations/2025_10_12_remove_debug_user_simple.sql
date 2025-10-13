-- Simple migration: delete any debug-user rows
-- Safe and idempotent: runs DELETE and commits

BEGIN;

DELETE FROM public.user_credentials WHERE user_id = 'debug-user';

COMMIT;
