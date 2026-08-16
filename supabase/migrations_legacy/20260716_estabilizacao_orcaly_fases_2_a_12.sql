-- Orçaly - estabilização fases 2 a 12
-- Seguro e não destrutivo. Revise e aplique no Supabase antes dos testes de pagamento.

create extension if not exists pgcrypto;

alter table if exists public.orders
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists delivery_fee numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0,
  add column if not exists total_amount numeric(12,2) default 0,
  add column if not exists coupon_code text,
  add column if not exists payment_status text default 'pending',
  add column if not exists payment_provider text,
  add column if not exists delivery_type text,
  add column if not exists delivery_zone_id uuid null,
  add column if not exists payment_method_id uuid null,
  add column if not exists marketplace_payment_id uuid null,
  add column if not exists items_snapshot jsonb default '[]'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.marketplace_payments
  add column if not exists provider_fee_amount numeric(12,2) not null default 0,
  add column if not exists net_amount numeric(12,2) not null default 0,
  add column if not exists commission_percentage numeric(5,2) not null default 0,
  add column if not exists commission_amount numeric(12,2) not null default 0,
  add column if not exists raw_payload jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.marketplace_commissions
  add column if not exists commission_percentage numeric(5,2) not null default 0,
  add column if not exists commission_fixed numeric(12,2) not null default 0,
  add column if not exists commission_amount numeric(12,2) not null default 0,
  add column if not exists gross_amount numeric(12,2) not null default 0,
  add column if not exists confirmed_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.marketplace_commission_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  plan_key text,
  commission_percentage numeric(5,2) not null default 0,
  commission_fixed numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_marketplace_commission_rules_company_plan
  on public.marketplace_commission_rules(company_id, plan_key)
  where company_id is not null;

create unique index if not exists idx_marketplace_commission_rules_global_plan
  on public.marketplace_commission_rules(plan_key)
  where company_id is null;

create index if not exists idx_orders_company_created
  on public.orders(company_id, created_at desc);

create index if not exists idx_order_items_company_order
  on public.order_items(company_id, order_id);

create index if not exists idx_deliveries_company_status
  on public.deliveries(company_id, status, created_at desc);

create index if not exists idx_delivery_zones_company_active
  on public.delivery_zones(company_id, is_active, name);

create index if not exists idx_payment_methods_company_active
  on public.payment_methods(company_id, is_active, type);

create index if not exists idx_marketplace_payments_company_created
  on public.marketplace_payments(company_id, created_at desc);

create index if not exists idx_marketplace_commissions_company_created
  on public.marketplace_commissions(company_id, created_at desc);

update public.marketplace_commission_rules
set commission_percentage = 3.50,
    commission_fixed = 0,
    is_active = true,
    updated_at = now()
where company_id is null
  and lower(plan_key) in ('essencial', 'basico', 'básico', 'basic');

insert into public.marketplace_commission_rules (
  company_id, plan_key, commission_percentage, commission_fixed, is_active
)
select null, 'essencial', 3.50, 0, true
where not exists (
  select 1 from public.marketplace_commission_rules
  where company_id is null and lower(plan_key) in ('essencial', 'basico', 'básico', 'basic')
);

update public.marketplace_commission_rules
set commission_percentage = 3.00,
    commission_fixed = 0,
    is_active = true,
    updated_at = now()
where company_id is null
  and lower(plan_key) in ('profissional', 'intermediario', 'intermediário', 'professional');

insert into public.marketplace_commission_rules (
  company_id, plan_key, commission_percentage, commission_fixed, is_active
)
select null, 'profissional', 3.00, 0, true
where not exists (
  select 1 from public.marketplace_commission_rules
  where company_id is null and lower(plan_key) in ('profissional', 'intermediario', 'intermediário', 'professional')
);

update public.marketplace_commission_rules
set commission_percentage = 2.00,
    commission_fixed = 0,
    is_active = true,
    updated_at = now()
where company_id is null
  and lower(plan_key) = 'premium';

insert into public.marketplace_commission_rules (
  company_id, plan_key, commission_percentage, commission_fixed, is_active
)
select null, 'premium', 2.00, 0, true
where not exists (
  select 1 from public.marketplace_commission_rules
  where company_id is null and lower(plan_key) = 'premium'
);
