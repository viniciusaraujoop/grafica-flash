-- ORÇALY - WHATSAPP PARA PEDIDOS E STATUS
-- Idempotente: pode rodar mais de uma vez.
-- Objetivo:
-- 1) avisar o dono/usuário quando chegar pedido novo
-- 2) avisar o cliente quando o status mudar

create extension if not exists "pgcrypto";

-- Configuração por empresa
create table if not exists public.company_whatsapp_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique,
  enabled boolean not null default false,
  ai_enabled boolean not null default false,

  notify_owner_new_order boolean not null default true,
  notify_client_new_order boolean not null default true,
  notify_client_order_status boolean not null default true,
  notify_client_proposal boolean not null default true,
  notify_owner_proposal boolean not null default true,

  owner_phone text,
  phone_number_id text,
  business_account_id text,

  ai_prompt text,
  fallback_message text default 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',

  template_order_created text,
  template_order_status text,
  template_proposal_update text,
  template_payment_update text,
  template_language text default 'pt_BR',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.company_whatsapp_settings add column if not exists enabled boolean not null default false;
alter table public.company_whatsapp_settings add column if not exists ai_enabled boolean not null default false;
alter table public.company_whatsapp_settings add column if not exists notify_owner_new_order boolean not null default true;
alter table public.company_whatsapp_settings add column if not exists notify_client_new_order boolean not null default true;
alter table public.company_whatsapp_settings add column if not exists notify_client_order_status boolean not null default true;
alter table public.company_whatsapp_settings add column if not exists notify_client_proposal boolean not null default true;
alter table public.company_whatsapp_settings add column if not exists notify_owner_proposal boolean not null default true;
alter table public.company_whatsapp_settings add column if not exists owner_phone text;
alter table public.company_whatsapp_settings add column if not exists phone_number_id text;
alter table public.company_whatsapp_settings add column if not exists business_account_id text;
alter table public.company_whatsapp_settings add column if not exists ai_prompt text;
alter table public.company_whatsapp_settings add column if not exists fallback_message text default 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.';
alter table public.company_whatsapp_settings add column if not exists template_order_created text;
alter table public.company_whatsapp_settings add column if not exists template_order_status text;
alter table public.company_whatsapp_settings add column if not exists template_proposal_update text;
alter table public.company_whatsapp_settings add column if not exists template_payment_update text;
alter table public.company_whatsapp_settings add column if not exists template_language text default 'pt_BR';
alter table public.company_whatsapp_settings add column if not exists created_at timestamp with time zone not null default now();
alter table public.company_whatsapp_settings add column if not exists updated_at timestamp with time zone not null default now();

-- Logs de envio/recebimento
create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  order_id uuid,
  proposal_id uuid,
  direction text not null default 'outbound',
  event_type text,
  to_phone text,
  from_phone text,
  message_type text default 'text',
  content text,
  status text not null default 'pending',
  meta_message_id text,
  raw_payload jsonb,
  raw_response jsonb,
  error text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_whatsapp_message_logs_company_id
  on public.whatsapp_message_logs(company_id, created_at desc);

create index if not exists idx_whatsapp_message_logs_order_id
  on public.whatsapp_message_logs(order_id, created_at desc);

-- Conversas do WhatsApp, usada pelo webhook/IA
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  phone text not null,
  customer_name text,
  last_inbound_at timestamp with time zone,
  last_outbound_at timestamp with time zone,
  last_message text,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  unique(company_id, phone)
);

-- Controle no pedido
alter table public.orders add column if not exists whatsapp_owner_notified_at timestamp with time zone;
alter table public.orders add column if not exists whatsapp_client_created_notified_at timestamp with time zone;
alter table public.orders add column if not exists whatsapp_last_status_notified text;
alter table public.orders add column if not exists whatsapp_last_status_notified_at timestamp with time zone;
alter table public.orders add column if not exists visualizado_em timestamp with time zone;
alter table public.orders add column if not exists notificado_em timestamp with time zone;

-- Permissões básicas
grant select, insert, update on public.company_whatsapp_settings to authenticated;
grant select, insert, update on public.whatsapp_message_logs to authenticated;
grant select, insert, update on public.whatsapp_conversations to authenticated;
grant select, update on public.orders to authenticated;
