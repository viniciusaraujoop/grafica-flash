-- ORÇALY - CORREÇÃO /PAINEL/CUPONS
-- Garante a tabela usada pela página de cupons.
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

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

create index if not exists idx_marketplace_coupons_active
  on public.marketplace_coupons(company_id, ativo);

grant select, insert, update on public.marketplace_coupons to authenticated;
grant select on public.marketplace_coupons to anon;
