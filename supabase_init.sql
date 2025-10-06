-- Supabase initialization SQL for reminders table

-- Enable pgcrypto for gen_random_uuid (needed for gen_random_uuid())
create extension if not exists pgcrypto;

-- Create reminders table
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
