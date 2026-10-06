-- ORÇALY PEDIDOS PRO + PRODUTOS AVANÇADOS
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

-- =========================
-- PEDIDOS PRO
-- =========================

alter table public.orders add column if not exists prioridade text default 'normal';
alter table public.orders add column if not exists prazo_entrega timestamp with time zone;
alter table public.orders add column if not exists responsavel_id uuid;
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
  note text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_order_status_history_company_id on public.order_status_history(company_id);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);

create table if not exists public.order_internal_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  user_id uuid,
  comentario text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_order_internal_comments_company_id on public.order_internal_comments(company_id);
create index if not exists idx_order_internal_comments_order_id on public.order_internal_comments(order_id);

-- =========================
-- PRODUTOS AVANÇADOS
-- =========================

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
alter table public.products add column if not exists adicionais jsonb default '[]'::jsonb;
alter table public.products add column if not exists variacoes jsonb default '[]'::jsonb;
alter table public.products add column if not exists campos_orcamento jsonb default '[]'::jsonb;
alter table public.products add column if not exists configuracoes jsonb default '{}'::jsonb;
alter table public.products add column if not exists updated_at timestamp with time zone default now();

create index if not exists idx_products_company_categoria on public.products(company_id, categoria);
create index if not exists idx_products_company_destaque on public.products(company_id, destaque);
create index if not exists idx_products_company_oculto on public.products(company_id, oculto);

-- =========================
-- GRANTS
-- =========================

grant select, update on public.orders to authenticated;
grant select, insert on public.order_status_history to authenticated;
grant select, insert on public.order_internal_comments to authenticated;
grant select, update on public.products to authenticated;
