-- ORÇALY - MARKETPLACE FOOD CHECKOUT REAL
-- Carrinho Food, itens do pedido, pagamento do pedido e geração de entrega.
-- Idempotente, não destrutivo: sem DROP, DELETE ou TRUNCATE.

create extension if not exists "pgcrypto";

-- =========================================================
-- COMPATIBILIDADE FOOD OPERACIONAL
-- =========================================================

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  fee numeric(12,2) not null default 0,
  minimum_order numeric(12,2) default 0,
  estimated_time_min integer,
  estimated_time_max integer,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.delivery_zones add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.delivery_zones add column if not exists name text;
alter table public.delivery_zones add column if not exists fee numeric(12,2) default 0;
alter table public.delivery_zones add column if not exists minimum_order numeric(12,2) default 0;
alter table public.delivery_zones add column if not exists estimated_time_min integer;
alter table public.delivery_zones add column if not exists estimated_time_max integer;
alter table public.delivery_zones add column if not exists is_active boolean default true;
alter table public.delivery_zones add column if not exists notes text;
alter table public.delivery_zones add column if not exists created_at timestamptz default now();
alter table public.delivery_zones add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'min_order') then
    update public.delivery_zones set minimum_order = coalesce(minimum_order, min_order, 0) where minimum_order is null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'active') then
    update public.delivery_zones set is_active = coalesce(is_active, active, true) where is_active is null;
  end if;
end $$;

update public.delivery_zones set fee = coalesce(fee, 0), minimum_order = coalesce(minimum_order, 0), is_active = coalesce(is_active, true);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  weekday integer not null,
  is_open boolean default true,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  closed_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.business_hours add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.business_hours add column if not exists weekday integer;
alter table public.business_hours add column if not exists is_open boolean default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;
alter table public.business_hours add column if not exists closed_message text;
alter table public.business_hours add column if not exists created_at timestamptz default now();
alter table public.business_hours add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_hours' and column_name = 'opens_at') then
    update public.business_hours set open_time = coalesce(open_time, opens_at) where open_time is null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_hours' and column_name = 'closes_at') then
    update public.business_hours set close_time = coalesce(close_time, closes_at) where close_time is null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_hours' and column_name = 'active') then
    update public.business_hours set is_open = coalesce(is_open, active, true) where is_open is null;
  end if;
end $$;

update public.business_hours set is_open = coalesce(is_open, true);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  type text not null,
  is_active boolean default true,
  requires_change boolean default false,
  allow_delivery_payment boolean default true,
  allow_online_payment boolean default false,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payment_methods add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.payment_methods add column if not exists name text;
alter table public.payment_methods add column if not exists type text;
alter table public.payment_methods add column if not exists is_active boolean default true;
alter table public.payment_methods add column if not exists requires_change boolean default false;
alter table public.payment_methods add column if not exists allow_delivery_payment boolean default true;
alter table public.payment_methods add column if not exists allow_online_payment boolean default false;
alter table public.payment_methods add column if not exists instructions text;
alter table public.payment_methods add column if not exists created_at timestamptz default now();
alter table public.payment_methods add column if not exists updated_at timestamptz default now();

update public.payment_methods
set is_active = coalesce(is_active, true),
    requires_change = coalesce(requires_change, false),
    allow_delivery_payment = coalesce(allow_delivery_payment, true),
    allow_online_payment = coalesce(allow_online_payment, false);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  customer_name text,
  customer_phone text,
  address text,
  neighborhood text,
  delivery_zone_id uuid null references public.delivery_zones(id) on delete set null,
  delivery_fee numeric(12,2) default 0,
  payment_method_id uuid null references public.payment_methods(id) on delete set null,
  status text default 'waiting_preparation',
  notes text,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.deliveries add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.deliveries add column if not exists order_id uuid null references public.orders(id) on delete set null;
alter table public.deliveries add column if not exists customer_name text;
alter table public.deliveries add column if not exists customer_phone text;
alter table public.deliveries add column if not exists address text;
alter table public.deliveries add column if not exists neighborhood text;
alter table public.deliveries add column if not exists delivery_zone_id uuid null references public.delivery_zones(id) on delete set null;
alter table public.deliveries add column if not exists delivery_fee numeric(12,2) default 0;
alter table public.deliveries add column if not exists payment_method_id uuid null references public.payment_methods(id) on delete set null;
alter table public.deliveries add column if not exists status text default 'waiting_preparation';
alter table public.deliveries add column if not exists notes text;
alter table public.deliveries add column if not exists estimated_delivery_at timestamptz;
alter table public.deliveries add column if not exists delivered_at timestamptz;
alter table public.deliveries add column if not exists created_at timestamptz default now();
alter table public.deliveries add column if not exists updated_at timestamptz default now();

update public.deliveries set delivery_fee = coalesce(delivery_fee, 0), status = coalesce(status, 'waiting_preparation');

-- =========================================================
-- ORDERS: CAMPOS DE CHECKOUT FOOD/PAGAMENTO/ENTREGA
-- =========================================================

alter table public.orders add column if not exists delivery_type text;
alter table public.orders add column if not exists delivery_fee numeric(12,2) default 0;
alter table public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table public.orders add column if not exists total_amount numeric(12,2) default 0;
alter table public.orders add column if not exists payment_method_id uuid null references public.payment_methods(id) on delete set null;
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists delivery_zone_id uuid null references public.delivery_zones(id) on delete set null;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists neighborhood text;
alter table public.orders add column if not exists complement text;
alter table public.orders add column if not exists reference_point text;
alter table public.orders add column if not exists change_for numeric(12,2);
alter table public.orders add column if not exists items_snapshot jsonb default '[]'::jsonb;
alter table public.orders add column if not exists marketplace_origem text;
alter table public.orders add column if not exists cliente_empresa text;
alter table public.orders add column if not exists dados_inteligentes jsonb default '{}'::jsonb;
alter table public.orders add column if not exists itens_resumo text;
alter table public.orders add column if not exists valor_total numeric(12,2);
alter table public.orders add column if not exists valor_total_original numeric(12,2);
alter table public.orders add column if not exists valor_desconto numeric(12,2) default 0;
alter table public.orders add column if not exists valor_sinal numeric(12,2) default 0;
alter table public.orders add column if not exists percentual_sinal numeric(5,2) default 0;
alter table public.orders add column if not exists cupom_id uuid;
alter table public.orders add column if not exists cupom_codigo text;
alter table public.orders add column if not exists endereco_entrega text;
alter table public.orders add column if not exists forma_pagamento text;
alter table public.orders add column if not exists updated_at timestamptz default now();

update public.orders
set delivery_fee = coalesce(delivery_fee, 0),
    subtotal = coalesce(subtotal, valor_total, preco_estimado, 0),
    total_amount = coalesce(total_amount, valor_total, preco_estimado, 0),
    payment_status = coalesce(payment_status, 'pending'),
    valor_desconto = coalesce(valor_desconto, 0),
    valor_sinal = coalesce(valor_sinal, 0),
    percentual_sinal = coalesce(percentual_sinal, 0),
    dados_inteligentes = coalesce(dados_inteligentes, '{}'::jsonb),
    items_snapshot = coalesce(items_snapshot, '[]'::jsonb);

-- =========================================================
-- ITENS DO PEDIDO
-- =========================================================

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  nome text,
  product_name text,
  tipo text,
  unidade text,
  quantidade integer not null default 1,
  quantity integer not null default 1,
  preco_unitario numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  addons jsonb default '[]'::jsonb,
  variation jsonb default '{}'::jsonb,
  notes text,
  subtotal numeric(12,2) not null default 0,
  largura numeric(12,4),
  altura numeric(12,4),
  comprimento numeric(12,4),
  area_m2 numeric(12,4),
  precificacao text,
  detalhes_calculo text,
  respostas jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.order_items add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.order_items add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.order_items add column if not exists product_id uuid null references public.products(id) on delete set null;
alter table public.order_items add column if not exists nome text;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists tipo text;
alter table public.order_items add column if not exists unidade text;
alter table public.order_items add column if not exists quantidade integer default 1;
alter table public.order_items add column if not exists quantity integer default 1;
alter table public.order_items add column if not exists preco_unitario numeric(12,2) default 0;
alter table public.order_items add column if not exists unit_price numeric(12,2) default 0;
alter table public.order_items add column if not exists addons jsonb default '[]'::jsonb;
alter table public.order_items add column if not exists variation jsonb default '{}'::jsonb;
alter table public.order_items add column if not exists notes text;
alter table public.order_items add column if not exists subtotal numeric(12,2) default 0;
alter table public.order_items add column if not exists largura numeric(12,4);
alter table public.order_items add column if not exists altura numeric(12,4);
alter table public.order_items add column if not exists comprimento numeric(12,4);
alter table public.order_items add column if not exists area_m2 numeric(12,4);
alter table public.order_items add column if not exists precificacao text;
alter table public.order_items add column if not exists detalhes_calculo text;
alter table public.order_items add column if not exists respostas jsonb default '{}'::jsonb;
alter table public.order_items add column if not exists created_at timestamptz default now();

update public.order_items
set quantidade = coalesce(quantidade, quantity, 1),
    quantity = coalesce(quantity, quantidade, 1),
    preco_unitario = coalesce(preco_unitario, unit_price, 0),
    unit_price = coalesce(unit_price, preco_unitario, 0),
    nome = coalesce(nome, product_name),
    product_name = coalesce(product_name, nome),
    addons = coalesce(addons, '[]'::jsonb),
    variation = coalesce(variation, '{}'::jsonb),
    respostas = coalesce(respostas, '{}'::jsonb),
    subtotal = coalesce(subtotal, 0);

-- =========================================================
-- PAGAMENTOS DE PEDIDOS, SEPARADOS DA ASSINATURA ORÇALY
-- =========================================================

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  payment_method_id uuid null references public.payment_methods(id) on delete set null,
  type text default 'full',
  status text default 'pending',
  amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) default 0,
  remaining_amount numeric(12,2) default 0,
  provider text,
  provider_payment_id text,
  proof_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.order_payments add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.order_payments add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.order_payments add column if not exists payment_method_id uuid null references public.payment_methods(id) on delete set null;
alter table public.order_payments add column if not exists type text default 'full';
alter table public.order_payments add column if not exists status text default 'pending';
alter table public.order_payments add column if not exists amount numeric(12,2) default 0;
alter table public.order_payments add column if not exists paid_amount numeric(12,2) default 0;
alter table public.order_payments add column if not exists remaining_amount numeric(12,2) default 0;
alter table public.order_payments add column if not exists provider text;
alter table public.order_payments add column if not exists provider_payment_id text;
alter table public.order_payments add column if not exists proof_url text;
alter table public.order_payments add column if not exists notes text;
alter table public.order_payments add column if not exists created_at timestamptz default now();
alter table public.order_payments add column if not exists updated_at timestamptz default now();

update public.order_payments
set type = coalesce(type, 'full'),
    status = coalesce(status, 'pending'),
    amount = coalesce(amount, 0),
    paid_amount = coalesce(paid_amount, 0),
    remaining_amount = coalesce(remaining_amount, 0);

-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists idx_delivery_zones_company_id on public.delivery_zones(company_id);
create index if not exists idx_delivery_zones_company_active on public.delivery_zones(company_id, is_active);
create index if not exists idx_business_hours_company_id on public.business_hours(company_id);
create index if not exists idx_business_hours_company_weekday on public.business_hours(company_id, weekday);
create index if not exists idx_payment_methods_company_id on public.payment_methods(company_id);
create index if not exists idx_payment_methods_company_active on public.payment_methods(company_id, is_active);
create index if not exists idx_deliveries_company_id on public.deliveries(company_id);
create index if not exists idx_deliveries_company_status on public.deliveries(company_id, status);
create index if not exists idx_deliveries_company_created_at on public.deliveries(company_id, created_at desc);
create index if not exists idx_deliveries_order_id on public.deliveries(order_id);
create index if not exists idx_orders_company_created_at on public.orders(company_id, created_at desc);
create index if not exists idx_orders_company_payment_status on public.orders(company_id, payment_status);
create index if not exists idx_orders_company_delivery_type on public.orders(company_id, delivery_type);
create index if not exists idx_order_items_company_order on public.order_items(company_id, order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_order_payments_company_order on public.order_payments(company_id, order_id);
create index if not exists idx_order_payments_company_status on public.order_payments(company_id, status);

-- =========================================================
-- UPDATED_AT AUTOMÁTICO
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_delivery_zones_updated_at') then
    create trigger set_delivery_zones_updated_at before update on public.delivery_zones for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_business_hours_updated_at') then
    create trigger set_business_hours_updated_at before update on public.business_hours for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_payment_methods_updated_at') then
    create trigger set_payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_deliveries_updated_at') then
    create trigger set_deliveries_updated_at before update on public.deliveries for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_orders_updated_at') then
    create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_order_payments_updated_at') then
    create trigger set_order_payments_updated_at before update on public.order_payments for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================================================
-- RLS POR EMPRESA
-- =========================================================

alter table public.delivery_zones enable row level security;
alter table public.business_hours enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deliveries enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

-- As APIs públicas usam service role para inserir pedido. O painel autenticado acessa somente pela empresa.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_company_access') then
    create policy order_items_company_access on public.order_items
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = order_items.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = order_items.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_payments' and policyname = 'order_payments_company_access') then
    create policy order_payments_company_access on public.order_payments
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = order_payments.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = order_payments.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;
end $$;

-- Garante policies de Food do pacote anterior, caso este SQL seja rodado sozinho.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_zones' and policyname = 'delivery_zones_company_access') then
    create policy delivery_zones_company_access on public.delivery_zones
    for all using (exists (select 1 from public.companies c where c.id = delivery_zones.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))))
    with check (exists (select 1 from public.companies c where c.id = delivery_zones.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'business_hours' and policyname = 'business_hours_company_access') then
    create policy business_hours_company_access on public.business_hours
    for all using (exists (select 1 from public.companies c where c.id = business_hours.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))))
    with check (exists (select 1 from public.companies c where c.id = business_hours.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_methods' and policyname = 'payment_methods_company_access') then
    create policy payment_methods_company_access on public.payment_methods
    for all using (exists (select 1 from public.companies c where c.id = payment_methods.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))))
    with check (exists (select 1 from public.companies c where c.id = payment_methods.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deliveries' and policyname = 'deliveries_company_access') then
    create policy deliveries_company_access on public.deliveries
    for all using (exists (select 1 from public.companies c where c.id = deliveries.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))))
    with check (exists (select 1 from public.companies c where c.id = deliveries.company_id and (c.owner_id = auth.uid() or c.tester_id = auth.uid() or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo'))));
  end if;
end $$;

grant select, insert, update, delete on public.delivery_zones to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.deliveries to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.order_payments to authenticated;

-- Diagnóstico final.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'order_items', 'order_payments', 'delivery_zones', 'business_hours', 'payment_methods', 'deliveries')
order by table_name, ordinal_position;
