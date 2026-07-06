-- ORÇALY - MARKETPLACE REAL COM CUPOM, FOOD CHECKOUT E ENTREGA
-- Seguro/idempotente: não apaga dados, não trunca tabelas e só adiciona o que faltar.

create extension if not exists "pgcrypto";

-- =========================
-- CUPONS DO MARKETPLACE
-- =========================

create table if not exists public.marketplace_coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  codigo text not null,
  codigo_normalizado text not null,
  descricao text,
  tipo text not null default 'percentual',
  coupon_type text,
  free_delivery boolean not null default false,
  valor numeric(12,2) not null default 0,
  valor_minimo_pedido numeric(12,2) not null default 0,
  valor_maximo_desconto numeric(12,2),
  allowed_product_ids jsonb not null default '[]'::jsonb,
  allowed_categories jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_coupons add column if not exists coupon_type text;
alter table public.marketplace_coupons add column if not exists free_delivery boolean not null default false;
alter table public.marketplace_coupons add column if not exists allowed_product_ids jsonb not null default '[]'::jsonb;
alter table public.marketplace_coupons add column if not exists allowed_categories jsonb not null default '[]'::jsonb;
alter table public.marketplace_coupons add column if not exists updated_at timestamptz not null default now();

update public.marketplace_coupons
set coupon_type = case
  when free_delivery is true then 'free_delivery'
  when tipo = 'fixo' then 'fixed'
  else 'percentage'
end
where coupon_type is null;

create unique index if not exists idx_marketplace_coupons_company_code
  on public.marketplace_coupons(company_id, codigo_normalizado);
create index if not exists idx_marketplace_coupons_company_id
  on public.marketplace_coupons(company_id);
create index if not exists idx_marketplace_coupons_active
  on public.marketplace_coupons(company_id, ativo);

-- =========================
-- TAXAS, PAGAMENTOS E HORÁRIOS FOOD
-- =========================

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

alter table public.delivery_zones add column if not exists minimum_order numeric(12,2) default 0;
alter table public.delivery_zones add column if not exists estimated_time_min integer;
alter table public.delivery_zones add column if not exists estimated_time_max integer;
alter table public.delivery_zones add column if not exists is_active boolean default true;
alter table public.delivery_zones add column if not exists notes text;
alter table public.delivery_zones add column if not exists updated_at timestamptz default now();

update public.delivery_zones set is_active = coalesce(is_active, active, true) where is_active is null and exists (
  select 1 from information_schema.columns where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'active'
);
update public.delivery_zones set minimum_order = coalesce(minimum_order, min_order, 0) where minimum_order is null and exists (
  select 1 from information_schema.columns where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'min_order'
);

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
  updated_at timestamptz default now(),
  unique(company_id, weekday)
);

alter table public.business_hours add column if not exists is_open boolean default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;
alter table public.business_hours add column if not exists closed_message text;
alter table public.business_hours add column if not exists updated_at timestamptz default now();

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

alter table public.payment_methods add column if not exists is_active boolean default true;
alter table public.payment_methods add column if not exists requires_change boolean default false;
alter table public.payment_methods add column if not exists allow_delivery_payment boolean default true;
alter table public.payment_methods add column if not exists allow_online_payment boolean default false;
alter table public.payment_methods add column if not exists instructions text;
alter table public.payment_methods add column if not exists updated_at timestamptz default now();

-- =========================
-- PEDIDOS, ITENS, PAGAMENTOS E ENTREGAS
-- =========================

alter table public.orders add column if not exists delivery_type text;
alter table public.orders add column if not exists delivery_fee numeric(12,2) default 0;
alter table public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table public.orders add column if not exists total_amount numeric(12,2) default 0;
alter table public.orders add column if not exists discount_amount numeric(12,2) default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists payment_method_id uuid null references public.payment_methods(id) on delete set null;
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists delivery_zone_id uuid null references public.delivery_zones(id) on delete set null;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists neighborhood text;
alter table public.orders add column if not exists complement text;
alter table public.orders add column if not exists reference_point text;
alter table public.orders add column if not exists change_for numeric(12,2);
alter table public.orders add column if not exists items_snapshot jsonb default '[]'::jsonb;
alter table public.orders add column if not exists valor_total_original numeric(12,2) default 0;
alter table public.orders add column if not exists valor_desconto numeric(12,2) default 0;
alter table public.orders add column if not exists valor_total numeric(12,2) default 0;
alter table public.orders add column if not exists valor_sinal numeric(12,2) default 0;
alter table public.orders add column if not exists percentual_sinal numeric(12,2) default 0;
alter table public.orders add column if not exists cupom_id uuid null;
alter table public.orders add column if not exists cupom_codigo text;
alter table public.orders add column if not exists forma_pagamento text;
alter table public.orders add column if not exists endereco_entrega text;
alter table public.orders add column if not exists itens_resumo text;
alter table public.orders add column if not exists cliente_empresa text;
alter table public.orders add column if not exists marketplace_origem text;
alter table public.orders add column if not exists dados_inteligentes jsonb default '{}'::jsonb;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  addons jsonb default '[]'::jsonb,
  variation jsonb default '{}'::jsonb,
  notes text,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

alter table public.order_items add column if not exists nome text;
alter table public.order_items add column if not exists tipo text;
alter table public.order_items add column if not exists unidade text;
alter table public.order_items add column if not exists quantidade integer default 1;
alter table public.order_items add column if not exists preco_unitario numeric(12,2) default 0;
alter table public.order_items add column if not exists largura numeric(12,3);
alter table public.order_items add column if not exists altura numeric(12,3);
alter table public.order_items add column if not exists comprimento numeric(12,3);
alter table public.order_items add column if not exists area_m2 numeric(12,3);
alter table public.order_items add column if not exists precificacao text;
alter table public.order_items add column if not exists detalhes_calculo text;
alter table public.order_items add column if not exists respostas jsonb default '{}'::jsonb;

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

alter table public.deliveries add column if not exists updated_at timestamptz default now();

create index if not exists idx_delivery_zones_company_id on public.delivery_zones(company_id);
create index if not exists idx_business_hours_company_id on public.business_hours(company_id);
create index if not exists idx_payment_methods_company_id on public.payment_methods(company_id);
create index if not exists idx_deliveries_company_id on public.deliveries(company_id);
create index if not exists idx_deliveries_order_id on public.deliveries(order_id);
create index if not exists idx_order_items_company_id on public.order_items(company_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_payments_company_id on public.order_payments(company_id);
create index if not exists idx_order_payments_order_id on public.order_payments(order_id);

-- RLS fica ativada sem política pública aberta. O código usa service role nas APIs públicas e company_id nas operações do painel.
alter table public.marketplace_coupons enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.business_hours enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deliveries enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

grant select on public.marketplace_coupons to anon;
grant select on public.delivery_zones to anon;
grant select on public.business_hours to anon;
grant select on public.payment_methods to anon;
grant select, insert, update on public.marketplace_coupons to authenticated;
grant select, insert, update, delete on public.delivery_zones to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.deliveries to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.order_payments to authenticated;
