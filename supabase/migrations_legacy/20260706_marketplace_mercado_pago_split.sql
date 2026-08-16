-- Orçaly Marketplace: Mercado Pago Split + admin interno
-- Seguro: sem DROP, sem TRUNCATE, sem DELETE em massa.

create extension if not exists pgcrypto;

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.platform_admins (user_id, email, role, is_active)
select id, email, 'admin', true
from auth.users
where email = 'viniciusad@orcaly.com'
on conflict (email) do update
set user_id = excluded.user_id,
    role = 'admin',
    is_active = true,
    updated_at = now();

create table if not exists public.marketplace_payment_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'mercado_pago',
  provider_user_id text,
  provider_account_id text,
  access_token text,
  refresh_token text,
  public_key text,
  token_expires_at timestamptz,
  onboarding_status text not null default 'pending',
  is_active boolean not null default false,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, provider)
);

create table if not exists public.marketplace_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  provider text not null default 'mercado_pago',
  provider_preference_id text,
  provider_payment_id text,
  provider_status text,
  status text not null default 'pending',
  checkout_url text,
  sandbox_checkout_url text,
  amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  commission_percentage numeric(5,2) not null default 0,
  currency text not null default 'BRL',
  payer_name text,
  payer_email text,
  payer_phone text,
  last_error text,
  raw_payload jsonb default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.marketplace_commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  marketplace_payment_id uuid references public.marketplace_payments(id) on delete set null,
  provider text not null default 'mercado_pago',
  gross_amount numeric(12,2) not null default 0,
  commission_percentage numeric(5,2) not null default 0,
  commission_fixed numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.marketplace_commission_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  plan_key text,
  commission_percentage numeric(5,2) not null default 5.00,
  commission_fixed numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.marketplace_oauth_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null default 'mercado_pago',
  state_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.marketplace_payment_settings
  add column if not exists last_error text;

alter table public.marketplace_payments
  add column if not exists last_error text;

alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_status text default 'pending',
  add column if not exists marketplace_payment_id uuid references public.marketplace_payments(id) on delete set null,
  add column if not exists total_amount numeric(12,2) default 0,
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists delivery_fee numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0,
  add column if not exists coupon_code text,
  add column if not exists paid_at timestamptz;

create index if not exists idx_platform_admins_user on public.platform_admins(user_id);
create index if not exists idx_platform_admins_email on public.platform_admins(lower(email));

create index if not exists idx_marketplace_payment_settings_company on public.marketplace_payment_settings(company_id);
create index if not exists idx_marketplace_payments_company on public.marketplace_payments(company_id);
create index if not exists idx_marketplace_payments_order on public.marketplace_payments(order_id);
create index if not exists idx_marketplace_payments_provider_payment on public.marketplace_payments(provider_payment_id);
create index if not exists idx_marketplace_commissions_company on public.marketplace_commissions(company_id);
create index if not exists idx_marketplace_commissions_payment on public.marketplace_commissions(marketplace_payment_id);
create index if not exists idx_marketplace_commission_rules_company on public.marketplace_commission_rules(company_id);
create index if not exists idx_marketplace_commission_rules_plan on public.marketplace_commission_rules(plan_key);
create index if not exists idx_marketplace_oauth_states_hash on public.marketplace_oauth_states(state_hash);

insert into public.marketplace_commission_rules (plan_key, commission_percentage, commission_fixed, is_active)
values
  ('basico', 5.00, 0, true),
  ('básico', 5.00, 0, true),
  ('intermediario', 3.00, 0, true),
  ('intermediário', 3.00, 0, true),
  ('premium', 1.50, 0, true)
on conflict do nothing;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_platform_admins_updated_at') then
    create trigger trg_platform_admins_updated_at before update on public.platform_admins for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_marketplace_payment_settings_updated_at') then
    create trigger trg_marketplace_payment_settings_updated_at before update on public.marketplace_payment_settings for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_marketplace_payments_updated_at') then
    create trigger trg_marketplace_payments_updated_at before update on public.marketplace_payments for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_marketplace_commissions_updated_at') then
    create trigger trg_marketplace_commissions_updated_at before update on public.marketplace_commissions for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_marketplace_commission_rules_updated_at') then
    create trigger trg_marketplace_commission_rules_updated_at before update on public.marketplace_commission_rules for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.platform_admins enable row level security;
alter table public.marketplace_payment_settings enable row level security;
alter table public.marketplace_payments enable row level security;
alter table public.marketplace_commissions enable row level security;
alter table public.marketplace_commission_rules enable row level security;
alter table public.marketplace_oauth_states enable row level security;

-- O acesso sensível é feito por route handlers server-side com service role.
-- Políticas permissivas não são criadas aqui justamente para não vazar token de provider.
