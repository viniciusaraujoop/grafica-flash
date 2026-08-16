-- ORÇALY - FINANCEIRO BASE SEGURO
-- Idempotente: pode rodar mais de uma vez.
-- Não usa DROP. Não apaga dados. Não sobrescreve registros existentes.

create extension if not exists "pgcrypto";

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  tipo text not null default 'caixa',
  saldo_inicial numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tipo text not null default 'saida',
  type text,
  categoria text,
  category_id uuid references public.financial_categories(id) on delete set null,
  descricao text not null,
  description text,
  valor numeric(12,2) not null default 0,
  amount numeric(12,2),
  data_competencia date default current_date,
  vencimento date,
  due_date date,
  status text not null default 'pendente',
  forma_pagamento text,
  payment_method text,
  fornecedor_cliente text,
  customer_id uuid,
  order_id uuid,
  proposal_id uuid,
  invoice_id uuid,
  centro_custo text default 'Geral',
  observacoes text,
  notes text,
  account_id uuid references public.finance_accounts(id) on delete set null,
  documento_url text,
  documento_nome text,
  documento_tipo text,
  codigo_barras text,
  nota_chave text,
  nota_numero text,
  nota_serie text,
  nota_emitente text,
  nota_cnpj_emitente text,
  nota_data_emissao date,
  origem text default 'manual',
  recorrente boolean default false,
  recorrencia_grupo uuid,
  parcela_atual integer,
  parcelas_total integer,
  paid_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_material_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  transaction_id uuid references public.financial_transactions(id) on delete set null,
  nome text not null,
  quantidade numeric(12,3) not null default 1,
  unidade text default 'un',
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  codigo text,
  categoria text,
  fornecedor text,
  created_at timestamptz not null default now()
);

alter table public.finance_accounts add column if not exists ativo boolean not null default true;
alter table public.finance_accounts add column if not exists updated_at timestamptz not null default now();

alter table public.financial_transactions add column if not exists type text;
alter table public.financial_transactions add column if not exists description text;
alter table public.financial_transactions add column if not exists amount numeric(12,2);
alter table public.financial_transactions add column if not exists category_id uuid references public.financial_categories(id) on delete set null;
alter table public.financial_transactions add column if not exists customer_id uuid;
alter table public.financial_transactions add column if not exists order_id uuid;
alter table public.financial_transactions add column if not exists proposal_id uuid;
alter table public.financial_transactions add column if not exists invoice_id uuid;
alter table public.financial_transactions add column if not exists payment_method text;
alter table public.financial_transactions add column if not exists due_date date;
alter table public.financial_transactions add column if not exists paid_at timestamptz;
alter table public.financial_transactions add column if not exists notes text;
alter table public.financial_transactions add column if not exists raw_data jsonb not null default '{}'::jsonb;
alter table public.financial_transactions add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_finance_accounts_company_id on public.finance_accounts(company_id);
create index if not exists idx_financial_categories_company_id on public.financial_categories(company_id);
create index if not exists idx_financial_transactions_company_id on public.financial_transactions(company_id);
create index if not exists idx_financial_transactions_competencia on public.financial_transactions(company_id, data_competencia desc);
create index if not exists idx_financial_transactions_status on public.financial_transactions(company_id, status);
create index if not exists idx_financial_transactions_vencimento on public.financial_transactions(company_id, vencimento);
create index if not exists idx_financial_material_entries_company_id on public.financial_material_entries(company_id);
create index if not exists idx_financial_material_entries_transaction_id on public.financial_material_entries(transaction_id);

-- Bucket usado pela tela atual para anexos do financeiro.
insert into storage.buckets (id, name, public)
values ('financeiro', 'financeiro', true)
on conflict (id) do nothing;

-- RLS seguro por empresa.
alter table public.finance_accounts enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_material_entries enable row level security;

-- Helper repetido nas políticas: acesso se for dono/tester ou membro ativo da empresa.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'finance_accounts' and policyname = 'finance_accounts_company_access') then
    create policy finance_accounts_company_access on public.finance_accounts
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = finance_accounts.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = finance_accounts.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_categories' and policyname = 'financial_categories_company_access') then
    create policy financial_categories_company_access on public.financial_categories
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = financial_categories.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = financial_categories.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_transactions' and policyname = 'financial_transactions_company_access') then
    create policy financial_transactions_company_access on public.financial_transactions
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = financial_transactions.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = financial_transactions.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_material_entries' and policyname = 'financial_material_entries_company_access') then
    create policy financial_material_entries_company_access on public.financial_material_entries
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = financial_material_entries.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = financial_material_entries.company_id
          and (c.owner_id = auth.uid() or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))
      )
    );
  end if;
end $$;
