-- ORCALY_WHATSAPP_CLOUD_API_V1
-- Infraestrutura multiempresa para Meta WhatsApp Cloud API.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  provider text not null default 'meta_cloud_api',
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  waba_id text,
  phone_number_id text unique,
  display_phone_number text,
  business_name text,
  access_token_ciphertext text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_connections enable row level security;
revoke all on table public.whatsapp_connections from anon, authenticated;

create index if not exists idx_whatsapp_connections_phone_number_id
  on public.whatsapp_connections(phone_number_id)
  where phone_number_id is not null;

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  event_key text not null unique,
  event_type text not null,
  payload_hash text,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

alter table public.whatsapp_webhook_events enable row level security;
revoke all on table public.whatsapp_webhook_events from anon, authenticated;

create index if not exists idx_whatsapp_webhook_events_company_received
  on public.whatsapp_webhook_events(company_id, received_at desc);

alter table public.whatsapp_message_logs
  add column if not exists conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  add column if not exists provider_timestamp timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ux_whatsapp_message_logs_inbound_meta_id
  on public.whatsapp_message_logs(company_id, meta_message_id)
  where direction = 'inbound' and meta_message_id is not null;

create index if not exists idx_whatsapp_message_logs_conversation
  on public.whatsapp_message_logs(conversation_id, created_at asc)
  where conversation_id is not null;

create unique index if not exists ux_whatsapp_conversations_company_phone
  on public.whatsapp_conversations(company_id, phone)
  where company_id is not null;

revoke insert, update, delete on table public.whatsapp_message_logs from anon, authenticated;
revoke all on table public.whatsapp_message_logs from anon;
grant select on table public.whatsapp_message_logs to authenticated;
