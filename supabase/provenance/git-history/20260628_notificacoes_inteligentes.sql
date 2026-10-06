-- ORÇALY NOTIFICAÇÕES INTELIGENTES
-- Alertas automáticos para pedidos, tarefas, CRM, propostas, cupons, produtos, site e assinatura.
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

-- Garante tabela base de notificações, caso algum ambiente ainda não tenha.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid,
  tipo text not null default 'info',
  titulo text not null,
  mensagem text,
  link_url text,
  status text not null default 'unread',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_app_notifications_company_id on public.app_notifications(company_id);
create index if not exists idx_app_notifications_status on public.app_notifications(company_id, status);
create index if not exists idx_app_notifications_created on public.app_notifications(company_id, created_at desc);

-- Evita duplicar alertas iguais.
create table if not exists public.smart_notification_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  event_key text not null,
  event_type text not null,
  entity text,
  entity_id text,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  unique(company_id, event_key)
);

create index if not exists idx_smart_notification_events_company_id
  on public.smart_notification_events(company_id);

create index if not exists idx_smart_notification_events_type
  on public.smart_notification_events(company_id, event_type);

-- Configurações por empresa.
create table if not exists public.smart_notification_settings (
  company_id uuid primary key,
  new_order_enabled boolean not null default true,
  order_stuck_enabled boolean not null default true,
  order_stuck_days integer not null default 3,
  task_due_today_enabled boolean not null default true,
  lead_idle_enabled boolean not null default true,
  lead_idle_days integer not null default 3,
  proposal_idle_enabled boolean not null default true,
  proposal_idle_days integer not null default 3,
  coupon_expiring_enabled boolean not null default true,
  coupon_expiring_days integer not null default 3,
  product_without_image_enabled boolean not null default true,
  site_without_logo_enabled boolean not null default true,
  subscription_expiring_enabled boolean not null default true,
  subscription_expiring_days integer not null default 7,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Garante campos usados pelos scanners, se pacotes anteriores ainda não foram aplicados.
alter table public.orders add column if not exists updated_at timestamp with time zone default now();
alter table public.orders add column if not exists prazo_entrega timestamp with time zone;
alter table public.orders add column if not exists prioridade text default 'normal';

alter table public.products add column if not exists image_urls text[];
alter table public.products add column if not exists imagem_url text;
alter table public.products add column if not exists foto_url text;
alter table public.products add column if not exists ativo boolean default true;
alter table public.products add column if not exists arquivado boolean default false;
alter table public.products add column if not exists oculto boolean default false;

alter table public.companies add column if not exists assinatura_expira_em timestamp with time zone;
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists site_publico_ativo boolean default true;

-- Garante tabelas dos módulos, se ainda não existirem.
create table if not exists public.internal_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  titulo text not null,
  descricao text,
  status text not null default 'pendente',
  prioridade text not null default 'media',
  due_at timestamp with time zone,
  responsavel_id uuid,
  created_by uuid,
  crm_lead_id uuid,
  order_id uuid,
  proposal_id uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  nome text not null,
  telefone text,
  email text,
  origem text default 'manual',
  etapa text not null default 'novo_lead',
  status text not null default 'ativo',
  valor_estimado numeric default 0,
  proximo_contato_em timestamp with time zone,
  observacoes text,
  tags text[],
  order_id uuid,
  proposal_id uuid,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.marketplace_coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  codigo text not null,
  codigo_normalizado text not null,
  descricao text,
  tipo text not null default 'percentual',
  valor numeric not null default 0,
  valor_minimo_pedido numeric not null default 0,
  valor_maximo_desconto numeric,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  usage_limit integer,
  used_count integer not null default 0,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

grant select, insert, update on public.app_notifications to authenticated;
grant select, insert, update on public.smart_notification_events to authenticated;
grant select, insert, update on public.smart_notification_settings to authenticated;
grant select, update on public.orders to authenticated;
grant select, update on public.products to authenticated;
grant select, update on public.companies to authenticated;
grant select, insert, update on public.internal_tasks to authenticated;
grant select, insert, update on public.crm_leads to authenticated;
grant select, insert, update on public.marketplace_coupons to authenticated;
