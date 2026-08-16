-- ORÇALY - PRÉ-VALIDAÇÃO / BASE SEGURA
-- Idempotente: pode rodar mais de uma vez.
-- Objetivo: garantir colunas/tabelas usadas pelos módulos atuais antes de validar com empresas reais.

create extension if not exists "pgcrypto";

-- =========================
-- COMPANIES: base, site, onboarding e assinatura
-- =========================

alter table public.companies add column if not exists nome text;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists telefone text;
alter table public.companies add column if not exists whatsapp text;
alter table public.companies add column if not exists slug text;
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists banner_url text;
alter table public.companies add column if not exists segmento text;
alter table public.companies add column if not exists modelo_negocio text;
alter table public.companies add column if not exists updated_at timestamp with time zone default now();

alter table public.companies add column if not exists site_publico_ativo boolean default true;
alter table public.companies add column if not exists site_template text default 'grafica';
alter table public.companies add column if not exists site_headline text;
alter table public.companies add column if not exists site_updated_at timestamp with time zone default now();

alter table public.companies add column if not exists assinatura_status text default 'pendente';
alter table public.companies add column if not exists assinatura_plano text;
alter table public.companies add column if not exists assinatura_expira_em timestamp with time zone;

alter table public.companies add column if not exists onboarding_current_step integer default 1;
alter table public.companies add column if not exists onboarding_completed boolean default false;
alter table public.companies add column if not exists onboarding_completed_at timestamp with time zone;
alter table public.companies add column if not exists onboarding_dismissed boolean default false;
alter table public.companies add column if not exists onboarding_updated_at timestamp with time zone default now();

-- =========================
-- CUPONS
-- =========================

create table if not exists public.marketplace_coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  codigo text not null,
  codigo_normalizado text not null,
  descricao text,
  tipo text not null default 'percentual' check (tipo in ('percentual', 'fixo')),
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

create unique index if not exists idx_marketplace_coupons_company_code
  on public.marketplace_coupons(company_id, codigo_normalizado);

create index if not exists idx_marketplace_coupons_company_id
  on public.marketplace_coupons(company_id);

-- =========================
-- PEDIDOS PRO
-- =========================

alter table public.orders add column if not exists company_id uuid;
alter table public.orders add column if not exists prioridade text default 'normal';
alter table public.orders add column if not exists prazo_entrega timestamp with time zone;
alter table public.orders add column if not exists responsavel_id uuid;
alter table public.orders add column if not exists responsavel_nome text;
alter table public.orders add column if not exists canal_origem text default 'site';
alter table public.orders add column if not exists endereco_entrega text;
alter table public.orders add column if not exists forma_pagamento text;
alter table public.orders add column if not exists observacoes_internas text;
alter table public.orders add column if not exists aprovado_em timestamp with time zone;
alter table public.orders add column if not exists entregue_em timestamp with time zone;
alter table public.orders add column if not exists cancelado_em timestamp with time zone;
alter table public.orders add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  old_status text,
  new_status text not null,
  changed_by uuid,
  changed_by_email text,
  note text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_order_status_history_order_id
  on public.order_status_history(order_id, created_at desc);

create table if not exists public.order_internal_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  user_id uuid,
  user_email text,
  comentario text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_order_internal_comments_order_id
  on public.order_internal_comments(order_id, created_at desc);

-- =========================
-- CRM, TAREFAS, NOTIFICAÇÕES
-- =========================

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

-- =========================
-- PRODUTOS
-- =========================

alter table public.products add column if not exists company_id uuid;
alter table public.products add column if not exists tipo text default 'produto';
alter table public.products add column if not exists categoria text;
alter table public.products add column if not exists subcategoria text;
alter table public.products add column if not exists descricao_curta text;
alter table public.products add column if not exists descricao_detalhada text;
alter table public.products add column if not exists preco_sob_consulta boolean default false;
alter table public.products add column if not exists unidade_preco text default 'unidade';
alter table public.products add column if not exists estoque integer;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists promocao_ativa boolean default false;
alter table public.products add column if not exists preco_promocional numeric;
alter table public.products add column if not exists destaque boolean default false;
alter table public.products add column if not exists oculto boolean default false;
alter table public.products add column if not exists arquivado boolean default false;
alter table public.products add column if not exists video_url text;
alter table public.products add column if not exists image_urls text[];
alter table public.products add column if not exists imagem_url text;
alter table public.products add column if not exists foto_url text;
alter table public.products add column if not exists adicionais jsonb default '[]'::jsonb;
alter table public.products add column if not exists variacoes jsonb default '[]'::jsonb;
alter table public.products add column if not exists campos_orcamento jsonb default '[]'::jsonb;
alter table public.products add column if not exists configuracoes jsonb default '{}'::jsonb;
alter table public.products add column if not exists updated_at timestamp with time zone default now();

-- =========================
-- VIEW SEGURA DE MEMBROS
-- =========================

drop view if exists public.company_members_public;

create view public.company_members_public as
select
  cm.id,
  cm.company_id,
  cm.user_id,
  cm.cargo,
  cm.status,
  cm.created_at,
  coalesce(u.email, cm.email) as email,
  coalesce(cm.nome, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name') as nome
from public.company_members cm
left join auth.users u on u.id = cm.user_id;

grant select on public.company_members_public to authenticated;

-- =========================
-- GRANTS
-- =========================

grant select, update on public.companies to authenticated;
grant select, update on public.orders to authenticated;
grant select, insert on public.order_status_history to authenticated;
grant select, insert on public.order_internal_comments to authenticated;
grant select, insert, update on public.internal_tasks to authenticated;
grant select, insert, update on public.crm_leads to authenticated;
grant select, insert, update on public.app_notifications to authenticated;
grant select, insert, update on public.smart_notification_events to authenticated;
grant select, insert, update on public.smart_notification_settings to authenticated;
grant select, insert, update on public.marketplace_coupons to authenticated;
grant select, update on public.products to authenticated;
