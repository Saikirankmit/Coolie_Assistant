create table public.whatsapp_users (
  id text not null,
  user_id text null,
  phone_number text null,
  verified boolean null default false,
  token text null,
  verification_code text null,
  created_at timestamp with time zone null default now(),
  verification_code_hash text null,
  verification_expires_at timestamp with time zone null,
  verification_attempts integer null default 0,
  token_expires_at timestamp with time zone null,
  token_last_rotated_at timestamp with time zone null,
  last_verified_at timestamp with time zone null,
  updated_at timestamp with time zone null default now(),
  whatsapp_phone_number_id text null,
  whatsapp_business_account_id text null,
  access_token_encrypted text null,
  is_active boolean null default true,
  constraint whatsapp_users_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_phone_number_id on public.whatsapp_users using btree (whatsapp_phone_number_id) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_user_id on public.whatsapp_users using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_phone on public.whatsapp_users using btree (phone_number) TABLESPACE pg_default;

create unique INDEX IF not exists uq_whatsapp_users_phone on public.whatsapp_users using btree (phone_number) TABLESPACE pg_default
where
  (phone_number is not null);

create unique INDEX IF not exists uq_whatsapp_users_user on public.whatsapp_users using btree (user_id) TABLESPACE pg_default
where
  (user_id is not null);

create index IF not exists idx_whatsapp_users_verification_expires_at on public.whatsapp_users using btree (verification_expires_at) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_token_expires_at on public.whatsapp_users using btree (token_expires_at) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_last_verified_at on public.whatsapp_users using btree (last_verified_at) TABLESPACE pg_default;

create index IF not exists idx_whatsapp_users_verified_phone on public.whatsapp_users using btree (phone_number) TABLESPACE pg_default
where
  (verified is true);

create index IF not exists idx_whatsapp_users_active on public.whatsapp_users using btree (user_id, is_active) TABLESPACE pg_default
where
  (is_active = true);