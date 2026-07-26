-- ORCALY_ASAAS_MIGRATION_V2
-- Migração financeira gradual Mercado Pago -> Asaas.
-- Aditiva, idempotente e sem operações destrutivas.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.marketplace_payment_settings') is not null then
    alter table public.marketplace_payment_settings
      add column if not exists provider text,
      add column if not exists provider_account_id text,
      add column if not exists provider_wallet_id text,
      add column if not exists encrypted_provider_api_key text,
      add column if not exists encrypted_webhook_auth_token text,
      add column if not exists onboarding_status text,
      add column if not exists account_status text,
      add column if not exists charges_enabled boolean default false,
      add column if not exists payouts_enabled boolean default false,
      add column if not exists pix_enabled boolean default false,
      add column if not exists card_enabled boolean default false,
      add column if not exists onboarding_url text,
      add column if not exists last_status_check_at timestamptz,
      add column if not exists provider_metadata_sanitized jsonb default '{}'::jsonb,
      add column if not exists legal_name text,
      add column if not exists document_last4 text,
      add column if not exists bank_name text,
      add column if not exists bank_account_last4 text,
      add column if not exists bank_account_type text,
      add column if not exists updated_at timestamptz default now();

    update public.marketplace_payment_settings
       set provider = 'mercado_pago'
     where provider is null;

    create unique index if not exists marketplace_payment_settings_company_provider_uidx
      on public.marketplace_payment_settings(company_id, provider)
      where company_id is not null and provider is not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.marketplace_payments') is not null then
    alter table public.marketplace_payments
      add column if not exists provider text,
      add column if not exists provider_payment_id text,
      add column if not exists provider_customer_id text,
      add column if not exists payment_method text,
      add column if not exists gross_amount numeric(14,2),
      add column if not exists provider_fee_amount numeric(14,2),
      add column if not exists provider_net_amount numeric(14,2),
      add column if not exists platform_fee_percent numeric(8,4),
      add column if not exists platform_fee_amount numeric(14,2),
      add column if not exists seller_net_amount numeric(14,2),
      add column if not exists split_status text,
      add column if not exists payout_status text,
      add column if not exists idempotency_key text,
      add column if not exists external_reference text,
      add column if not exists expires_at timestamptz,
      add column if not exists paid_at timestamptz,
      add column if not exists card_brand text,
      add column if not exists card_last4 text,
      add column if not exists error_message text,
      add column if not exists updated_at timestamptz default now();

    update public.marketplace_payments
       set provider = 'mercado_pago'
     where provider is null;

    create unique index if not exists marketplace_payments_provider_payment_uidx
      on public.marketplace_payments(provider, provider_payment_id)
      where provider is not null and provider_payment_id is not null;

    create unique index if not exists marketplace_payments_company_idempotency_uidx
      on public.marketplace_payments(company_id, idempotency_key)
      where company_id is not null and idempotency_key is not null;

    create index if not exists marketplace_payments_company_created_idx
      on public.marketplace_payments(company_id, created_at desc);

    create index if not exists marketplace_payments_order_idx
      on public.marketplace_payments(order_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.marketplace_commissions') is not null then
    alter table public.marketplace_commissions
      add column if not exists provider text,
      add column if not exists provider_split_id text,
      add column if not exists calculation_base text,
      add column if not exists fee_percent numeric(8,4),
      add column if not exists estimated_amount numeric(14,2),
      add column if not exists confirmed_amount numeric(14,2),
      add column if not exists status text,
      add column if not exists refusal_reason text,
      add column if not exists external_reference text,
      add column if not exists updated_at timestamptz default now();

    update public.marketplace_commissions
       set provider = 'mercado_pago'
     where provider is null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.order_payments') is not null then
    alter table public.order_payments
      add column if not exists provider text,
      add column if not exists provider_payment_id text,
      add column if not exists provider_status text,
      add column if not exists idempotency_key text,
      add column if not exists external_reference text,
      add column if not exists paid_at timestamptz,
      add column if not exists updated_at timestamptz default now();

    update public.order_payments
       set provider = 'mercado_pago'
     where provider is null;

    create unique index if not exists order_payments_provider_payment_uidx
      on public.order_payments(provider, provider_payment_id)
      where provider is not null and provider_payment_id is not null;

    create unique index if not exists order_payments_company_idempotency_uidx
      on public.order_payments(company_id, idempotency_key)
      where company_id is not null and idempotency_key is not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.plan_payments') is not null then
    alter table public.plan_payments
      add column if not exists provider text,
      add column if not exists provider_customer_id text,
      add column if not exists provider_payment_id text,
      add column if not exists provider_subscription_id text,
      add column if not exists billing_type text,
      add column if not exists external_reference text,
      add column if not exists idempotency_key text,
      add column if not exists paid_at timestamptz,
      add column if not exists updated_at timestamptz default now();

    update public.plan_payments
       set provider = 'mercado_pago'
     where provider is null;

    create unique index if not exists plan_payments_provider_payment_uidx
      on public.plan_payments(provider, provider_payment_id)
      where provider is not null and provider_payment_id is not null;

    create unique index if not exists plan_payments_provider_subscription_uidx
      on public.plan_payments(provider, provider_subscription_id)
      where provider is not null and provider_subscription_id is not null;

    create unique index if not exists plan_payments_company_idempotency_uidx
      on public.plan_payments(company_id, idempotency_key)
      where company_id is not null and idempotency_key is not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.subscription_events') is not null then
    alter table public.subscription_events
      add column if not exists provider text,
      add column if not exists provider_event_id text,
      add column if not exists provider_object_id text,
      add column if not exists payload_hash text,
      add column if not exists processing_status text,
      add column if not exists processed_at timestamptz,
      add column if not exists error_message text;

    update public.subscription_events
       set provider = 'mercado_pago'
     where provider is null;

    create unique index if not exists subscription_events_provider_event_uidx
      on public.subscription_events(provider, provider_event_id)
      where provider is not null and provider_event_id is not null;
  end if;
end $$;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_object_id text,
  company_id uuid,
  payload_hash text not null,
  payload_sanitized jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, provider_event_id)
);

create index if not exists payment_webhook_events_object_idx
  on public.payment_webhook_events(provider, provider_object_id);

create index if not exists payment_webhook_events_company_idx
  on public.payment_webhook_events(company_id, received_at desc);

create table if not exists public.payment_payouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  marketplace_payment_id uuid,
  provider text not null,
  provider_payout_id text,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending',
  expected_at timestamptz,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_payouts_company_idx
  on public.payment_payouts(company_id, created_at desc);

create table if not exists public.provider_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  customer_id text,
  provider text not null,
  provider_customer_id text not null,
  document_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider, customer_id)
);

create index if not exists provider_customers_provider_id_idx
  on public.provider_customers(provider, provider_customer_id);

do $$
begin
  if to_regclass('public.companies') is not null then
    alter table public.companies
      add column if not exists subscription_provider text,
      add column if not exists provider_customer_id text,
      add column if not exists provider_subscription_id text,
      add column if not exists next_billing_at timestamptz;
  end if;
end $$;

do $$
begin
  if to_regclass('public.orders') is not null then
    alter table public.orders
      add column if not exists company_id uuid,
      add column if not exists customer_name text,
      add column if not exists customer_email text,
      add column if not exists customer_phone text,
      add column if not exists subtotal numeric(14,2) default 0,
      add column if not exists discount_amount numeric(14,2) default 0,
      add column if not exists delivery_fee numeric(14,2) default 0,
      add column if not exists total numeric(14,2) default 0,
      add column if not exists payment_status text,
      add column if not exists payment_method text,
      add column if not exists coupon_id uuid,
      add column if not exists checkout_idempotency_key text,
      add column if not exists delivery_type text;

    create unique index if not exists orders_checkout_idempotency_uidx
      on public.orders(company_id, checkout_idempotency_key)
      where company_id is not null and checkout_idempotency_key is not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.order_items') is not null then
    alter table public.order_items
      add column if not exists company_id uuid,
      add column if not exists product_id uuid,
      add column if not exists product_name text,
      add column if not exists unit_price numeric(14,2) default 0,
      add column if not exists quantity integer default 1,
      add column if not exists total numeric(14,2) default 0,
      add column if not exists variation_json jsonb,
      add column if not exists addons_json jsonb,
      add column if not exists observation text;
  end if;
end $$;

create or replace function public.orcaly_user_has_company_access(target_company uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.companies') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.companies
            where id = $1
              and (
                owner_id = $2
                or tester_id = $2
              )
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;

    if allowed then
      return true;
    end if;
  end if;

  if to_regclass('public.company_members') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.company_members
            where company_id = $1
              and user_id = $2
              and coalesce(status, ''ativo'') = ''ativo''
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;
  end if;

  return coalesce(allowed, false);
end;
$$;

grant execute on function public.orcaly_user_has_company_access(uuid) to authenticated;

alter table public.payment_webhook_events enable row level security;
alter table public.payment_payouts enable row level security;
alter table public.provider_customers enable row level security;

drop policy if exists payment_webhook_events_company_select on public.payment_webhook_events;
create policy payment_webhook_events_company_select
  on public.payment_webhook_events
  for select
  to authenticated
  using (
    company_id is not null
    and public.orcaly_user_has_company_access(company_id)
  );

drop policy if exists payment_payouts_company_select on public.payment_payouts;
create policy payment_payouts_company_select
  on public.payment_payouts
  for select
  to authenticated
  using (public.orcaly_user_has_company_access(company_id));

drop policy if exists provider_customers_company_select on public.provider_customers;
create policy provider_customers_company_select
  on public.provider_customers
  for select
  to authenticated
  using (public.orcaly_user_has_company_access(company_id));

comment on table public.payment_webhook_events is
  'Eventos financeiros idempotentes e sanitizados. Escrita exclusiva do backend com service role.';

comment on table public.payment_payouts is
  'Registro de repasses informados pelo provider. Nao representa saldo ficticio.';

comment on table public.provider_customers is
  'Mapeamento de clientes internos para identificadores do provider.';
