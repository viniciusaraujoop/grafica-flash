-- ORÇALY PEDIDOS PRO V2
-- Foco: pedido detalhado, timeline, histórico, comentários internos, responsável, prazo, tarefa e proposta.
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

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

create index if not exists idx_order_status_history_company_id on public.order_status_history(company_id);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);
create index if not exists idx_order_status_history_created_at on public.order_status_history(order_id, created_at desc);

create table if not exists public.order_internal_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  user_id uuid,
  user_email text,
  comentario text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_order_internal_comments_company_id on public.order_internal_comments(company_id);
create index if not exists idx_order_internal_comments_order_id on public.order_internal_comments(order_id);
create index if not exists idx_order_internal_comments_created_at on public.order_internal_comments(order_id, created_at desc);

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

grant select, update on public.orders to authenticated;
grant select, insert on public.order_status_history to authenticated;
grant select, insert on public.order_internal_comments to authenticated;
grant select, insert, update on public.internal_tasks to authenticated;
