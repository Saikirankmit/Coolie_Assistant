-- Supabase initialization SQL for reminders table

-- Enable pgcrypto for gen_random_uuid (needed for gen_random_uuid())
create extension if not exists pgcrypto;

-- Create reminders table
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
    user_id text not null,
  type text check (type in ('whatsapp','gmail','general')) not null,
  datetime timestamptz not null,
  message text not null,
  user_phone text,
  user_email text,
  user_token text,
  status text default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz default now(),
  delivered_at timestamptz
);

-- Indexes
create index if not exists reminders_pending_due_idx on public.reminders(status, datetime);
create index if not exists reminders_user_idx on public.reminders(user_id);

-- User personalization/preferences table
create table if not exists public.user_preferences (
  user_id text primary key,
  tone text check (tone in ('professional','casual','friendly','formal')) not null default 'friendly',
  response_length text check (response_length in ('brief','moderate','detailed')) not null default 'moderate',
  formality text check (formality in ('low','medium','high')) not null default 'medium',
  include_emojis boolean not null default true,
  updated_at timestamptz default now()
);

create index if not exists user_preferences_user_idx on public.user_preferences(user_id);

-- Store per-user integration credentials (gmail/whatsapp)
create table if not exists public.user_credentials (
  user_id text not null,
  type text not null check (type in ('gmail','whatsapp')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

create index if not exists user_credentials_user_idx on public.user_credentials(user_id);