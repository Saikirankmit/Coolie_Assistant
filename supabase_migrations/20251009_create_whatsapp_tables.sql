-- Create tables for WhatsApp integration

create table if not exists whatsapp_users (
  id text primary key,
  user_id text,
  phone_number text,
  verified boolean default false,
  token text,
  verification_code text,
  created_at timestamptz default now()
);

create table if not exists whatsapp_messages (
  id text primary key,
  user_id text,
  "from" text,
  "to" text,
  message text,
  timestamp timestamptz default now()
);

-- indexes
create index if not exists idx_whatsapp_users_user_id on whatsapp_users(user_id);
create index if not exists idx_whatsapp_users_phone on whatsapp_users(phone_number);
create index if not exists idx_whatsapp_messages_user_id on whatsapp_messages(user_id);
