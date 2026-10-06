-- ORÇALY MIGRAÇÃO CONSOLIDADA
-- Arquivo idempotente. Pode rodar mais de uma vez sem destruir dados.
-- Objetivo: documentar e garantir a base criada durante os updates recentes.

create extension if not exists "pgcrypto";

-- =========================
-- COMPANIES: assinatura
-- =========================

alter table public.companies add column if not exists assinatura_status text default 'pendente';
alter table public.companies add column if not exists assinatura_plano text;
alter table public.companies add column if not exists assinatura_inicio timestamp with time zone;
alter table public.companies add column if not exists assinatura_expira_em timestamp with time zone;
alter table public.companies add column if not exists assinatura_ultimo_pagamento timestamp with time zone;
alter table public.companies add column if not exists assinatura_checkout_url text;

-- =========================
-- COMPANIES: site builder
-- =========================

alter table public.companies add column if not exists site_publico_ativo boolean default true;
alter table public.companies add column if not exists site_template text default 'grafica';
alter table public.companies add column if not exists site_layout text default 'moderno';
alter table public.companies add column if not exists site_art_style text default 'profissional';
alter table public.companies add column if not exists site_art_variant text default 'auto';
alter table public.companies add column if not exists site_font_style text default 'inter';
alter table public.companies add column if not exists site_button_style text default 'arredondado';
alter table public.companies add column if not exists site_hero_alignment text default 'esquerda';
alter table public.companies add column if not exists site_hero_style text default 'premium-showcase';
alter table public.companies add column if not exists site_section_style text default 'soft-premium';
alter table public.companies add column if not exists site_product_card_style text default 'premium';
alter table public.companies add column if not exists site_nav_variant text default 'clean';
alter table public.companies add column if not exists site_corner_style text default 'rounded';
alter table public.companies add column if not exists site_density text default 'comfortable';

alter table public.companies add column if not exists site_primary_color text default '#05245c';
alter table public.companies add column if not exists site_accent_color text default '#22c55e';
alter table public.companies add column if not exists site_background_color text default '#f5f8ff';
alter table public.companies add column if not exists site_text_color text default '#071b3a';
alter table public.companies add column if not exists site_card_color text default '#ffffff';

alter table public.companies add column if not exists site_badge_text text;
alter table public.companies add column if not exists site_headline text;
alter table public.companies add column if not exists site_subheadline text;
alter table public.companies add column if not exists site_cta_text text default 'Pedir orçamento';
alter table public.companies add column if not exists site_secondary_cta_text text default 'Ver catálogo';
alter table public.companies add column if not exists site_banner_url text;
alter table public.companies add column if not exists site_whatsapp_message text;
alter table public.companies add column if not exists site_about_title text;
alter table public.companies add column if not exists site_about_text text;
alter table public.companies add column if not exists site_services_title text;
alter table public.companies add column if not exists site_contact_title text;

alter table public.companies add column if not exists site_show_store boolean default true;
alter table public.companies add column if not exists site_show_marketplace boolean default true;
alter table public.companies add column if not exists site_show_about boolean default true;
alter table public.companies add column if not exists site_show_contact boolean default true;
alter table public.companies add column if not exists site_show_featured boolean default true;
alter table public.companies add column if not exists site_show_faq boolean default true;
alter table public.companies add column if not exists site_show_testimonials boolean default true;
alter table public.companies add column if not exists site_show_gallery boolean default true;
alter table public.companies add column if not exists site_show_benefits boolean default true;

alter table public.companies add column if not exists site_enable_cart boolean default true;
alter table public.companies add column if not exists site_enable_coupons boolean default true;
alter table public.companies add column if not exists site_show_prices boolean default true;
alter table public.companies add column if not exists site_checkout_mode text default 'cart';
alter table public.companies add column if not exists site_marketplace_title text default 'Catálogo online';
alter table public.companies add column if not exists site_marketplace_subtitle text default 'Escolha produtos, monte seu pedido e envie tudo organizado para atendimento.';
alter table public.companies add column if not exists site_cart_button_text text default 'Adicionar';
alter table public.companies add column if not exists site_checkout_button_text text default 'Finalizar pedido';
alter table public.companies add column if not exists site_empty_catalog_text text default 'A empresa ainda está preparando o catálogo.';

alter table public.companies add column if not exists site_features jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_faq jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_testimonials jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_gallery jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_benefits jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_custom_sections jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_hero_highlights jsonb default '[]'::jsonb;
alter table public.companies add column if not exists site_brand_words text[];
alter table public.companies add column if not exists site_trust_title text default 'Por que escolher a gente?';
alter table public.companies add column if not exists site_footer_text text;

alter table public.companies add column if not exists site_seo_title text;
alter table public.companies add column if not exists site_seo_description text;
alter table public.companies add column if not exists site_keywords text[];
alter table public.companies add column if not exists site_promo_title text;
alter table public.companies add column if not exists site_promo_text text;
alter table public.companies add column if not exists site_promo_active boolean default false;
alter table public.companies add column if not exists site_promo_button_text text default 'Aproveitar oferta';
alter table public.companies add column if not exists site_business_hours jsonb default '{}'::jsonb;
alter table public.companies add column if not exists site_payment_methods text[];
alter table public.companies add column if not exists site_delivery_options text[];
alter table public.companies add column if not exists site_updated_at timestamp with time zone default now();
alter table public.companies add column if not exists updated_at timestamp with time zone default now();

-- =========================
-- PAGAMENTOS DE PLANOS
-- =========================

create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  plano text,
  valor numeric,
  status text default 'pendente',
  email text,
  nome_empresa text,
  mercado_pago_preference_id text,
  checkout_url text,
  raw_payment jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_plan_payments_company_id on public.plan_payments(company_id);
create index if not exists idx_plan_payments_preference_id on public.plan_payments(mercado_pago_preference_id);

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
-- PEDIDOS: marketplace / cupons
-- =========================

alter table public.orders add column if not exists cupom_id uuid;
alter table public.orders add column if not exists cupom_codigo text;
alter table public.orders add column if not exists valor_desconto numeric default 0;
alter table public.orders add column if not exists valor_total_original numeric;

-- =========================
-- OPERAÇÃO PLUS
-- =========================

create table if not exists public.company_niche_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  niche text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.customer_magic_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  customer_name text,
  customer_phone text,
  token text not null unique,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.recurring_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid,
  customer_name text,
  customer_phone text,
  recurrence text,
  next_run_at timestamp with time zone,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.customer_portal_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid,
  token text,
  event_type text,
  payload jsonb default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid,
  status text default 'Recebido',
  responsavel_id uuid,
  observacoes text,
  prazo_entrega timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- =========================
-- WHATSAPP
-- =========================

alter table public.companies add column if not exists whatsapp_enabled boolean default false;
alter table public.companies add column if not exists whatsapp_phone_number_id text;
alter table public.companies add column if not exists whatsapp_access_token text;
alter table public.companies add column if not exists whatsapp_verify_token text;
alter table public.companies add column if not exists whatsapp_business_account_id text;
alter table public.companies add column if not exists whatsapp_auto_reply_enabled boolean default false;
alter table public.companies add column if not exists whatsapp_order_notifications boolean default false;
alter table public.companies add column if not exists whatsapp_status_notifications boolean default false;
alter table public.companies add column if not exists whatsapp_ai_enabled boolean default false;
alter table public.companies add column if not exists whatsapp_ai_prompt text;

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
-- STORAGE: imagens do site
-- =========================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-assets',
  'site-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================
-- GRANTS
-- =========================

grant select, insert, update on public.plan_payments to authenticated;
grant select, insert, update on public.marketplace_coupons to authenticated;
grant select on public.marketplace_coupons to anon;
grant select, update on public.companies to authenticated;
grant select, update on public.orders to authenticated;
grant select, insert, update on public.company_niche_templates to authenticated;
grant select, insert, update on public.customer_magic_links to authenticated;
grant select, insert, update on public.recurring_orders to authenticated;
grant select, insert, update on public.customer_portal_events to authenticated;
grant select, insert, update on public.production_orders to authenticated;
