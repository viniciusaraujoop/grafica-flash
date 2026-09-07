-- ORCALY_AFFILIATE_PROGRAM_DATABASE_V1
-- Programa de parceiros: 60% do primeiro pagamento elegivel.
-- A estrutura foi aplicada previamente no projeto Supabase de producao.

begin;

create schema if not exists orcaly_private;

create table if not exists public.affiliate_program_settings (
  id smallint primary key default 1 check (id = 1),
  commission_rate numeric(5,4) not null default 0.6000
    check (commission_rate between 0 and 0.6000),
  hold_days integer not null default 14
    check (hold_days between 7 and 60),
  minimum_payout_amount numeric(14,2) not null default 50.00
    check (minimum_payout_amount >= 1),
  attribution_days integer not null default 60
    check (attribution_days between 1 and 180),
  payouts_enabled boolean not null default true,
  automatic_payout_enabled boolean not null default false,
  terms_version text not null default '2026-07-29',
  updated_at timestamptz not null default now()
);

insert into public.affiliate_program_settings (
  id, commission_rate, hold_days, minimum_payout_amount,
  attribution_days, payouts_enabled, automatic_payout_enabled,
  terms_version
)
values (1, 0.6000, 14, 50.00, 60, true, false, '2026-07-29')
on conflict (id) do update
set commission_rate = excluded.commission_rate,
    hold_days = excluded.hold_days,
    minimum_payout_amount = excluded.minimum_payout_amount,
    attribution_days = excluded.attribution_days,
    terms_version = excluded.terms_version,
    updated_at = now();

create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  whatsapp text not null,
  document_type text not null check (document_type in ('CPF','CNPJ')),
  document_hash text not null,
  document_last4 text not null,
  code text not null,
  status text not null default 'active'
    check (status in ('pending','active','suspended','rejected','closed')),
  payout_status text not null default 'pending_verification'
    check (payout_status in ('pending_verification','verified','blocked')),
  commission_rate numeric(5,4) not null default 0.6000
    check (commission_rate between 0 and 0.6000),
  debt_balance numeric(14,2) not null default 0 check (debt_balance >= 0),
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  approved_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_profiles_name_check
    check (char_length(trim(name)) between 2 and 100),
  constraint affiliate_profiles_whatsapp_check
    check (char_length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) between 10 and 13),
  constraint affiliate_profiles_code_check
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$')
);

create unique index if not exists affiliate_profiles_email_uidx
  on public.affiliate_profiles (lower(email));
create unique index if not exists affiliate_profiles_code_uidx
  on public.affiliate_profiles (upper(code));
create unique index if not exists affiliate_profiles_document_uidx
  on public.affiliate_profiles (document_hash);
create index if not exists affiliate_profiles_status_idx
  on public.affiliate_profiles (status, created_at desc);

create table if not exists orcaly_private.affiliate_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null unique
    references public.affiliate_profiles(id) on delete cascade,
  pix_key_type text not null check (pix_key_type in ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  pix_key_encrypted text not null,
  pix_key_masked text not null,
  holder_name text not null,
  holder_document_hash text not null,
  holder_document_last4 text not null,
  bank_name text,
  provider_validation jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  code_snapshot text not null,
  session_hash text,
  ip_hash text,
  user_agent_hash text,
  landing_path text,
  referrer_host text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_affiliate_created_idx
  on public.affiliate_clicks (affiliate_id, created_at desc);
create index if not exists affiliate_clicks_session_idx
  on public.affiliate_clicks (session_hash, created_at desc);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  referral_code text not null,
  signup_lead_id uuid unique references public.signup_leads(id) on delete set null,
  company_id uuid unique references public.companies(id) on delete set null,
  status text not null default 'registered'
    check (status in ('registered','trial','payment_pending','qualified','rejected','reversed','customer_active','customer_cancelled')),
  plan text,
  customer_name_masked text,
  customer_email_masked text,
  customer_document_hash text,
  customer_whatsapp_hash text,
  source text not null default 'link',
  registered_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  qualified_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  first_payment_reference text,
  first_payment_amount numeric(14,2),
  commission_expected numeric(14,2) not null default 0,
  ip_hash text,
  device_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_referrals_affiliate_created_idx
  on public.affiliate_referrals (affiliate_id, created_at desc);
create index if not exists affiliate_referrals_status_idx
  on public.affiliate_referrals (status, created_at desc);
create index if not exists affiliate_referrals_company_idx
  on public.affiliate_referrals (company_id);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  gross_commissions numeric(14,2) not null default 0 check (gross_commissions >= 0),
  debt_offset numeric(14,2) not null default 0 check (debt_offset >= 0),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'requested'
    check (status in ('requested','approved','processing','paid','failed','cancelled')),
  provider text not null default 'manual' check (provider in ('manual','asaas')),
  provider_transfer_id text,
  external_reference text not null unique,
  pix_key_type text not null,
  pix_key_masked text not null,
  holder_name text not null,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  processing_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  proof_url text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists affiliate_payouts_provider_transfer_uidx
  on public.affiliate_payouts (provider_transfer_id)
  where provider_transfer_id is not null;
create index if not exists affiliate_payouts_affiliate_created_idx
  on public.affiliate_payouts (affiliate_id, created_at desc);
create index if not exists affiliate_payouts_status_idx
  on public.affiliate_payouts (status, created_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete restrict,
  referral_id uuid not null unique references public.affiliate_referrals(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  plan_payment_id uuid references public.plan_payments(id) on delete set null,
  provider_payment_id text not null unique,
  plan text not null,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  eligible_amount numeric(14,2) not null check (eligible_amount >= 0),
  commission_rate numeric(5,4) not null check (commission_rate between 0 and 0.6000),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  status text not null default 'hold'
    check (status in ('future','hold','available','processing','paid','reversed','rejected')),
  hold_until timestamptz,
  available_at timestamptz,
  payout_id uuid references public.affiliate_payouts(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_commissions_affiliate_status_idx
  on public.affiliate_commissions (affiliate_id, status, hold_until);
create index if not exists affiliate_commissions_company_idx
  on public.affiliate_commissions (company_id, created_at desc);

create table if not exists public.affiliate_payout_items (
  payout_id uuid not null references public.affiliate_payouts(id) on delete cascade,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, commission_id)
);

create table if not exists public.affiliate_audit_logs (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references public.affiliate_profiles(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_audit_logs_affiliate_idx
  on public.affiliate_audit_logs (affiliate_id, created_at desc);

alter table public.signup_leads
  add column if not exists referral_code text,
  add column if not exists affiliate_referral_id uuid
    references public.affiliate_referrals(id) on delete set null;
create index if not exists signup_leads_referral_code_idx
  on public.signup_leads (referral_code);

create or replace function orcaly_private.touch_affiliate_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function orcaly_private.touch_affiliate_updated_at() from public;

create or replace function public.release_affiliate_commissions_admin()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare changed integer;
begin
  update public.affiliate_commissions c
  set status = 'available',
      available_at = coalesce(c.available_at, now()),
      updated_at = now()
  from public.affiliate_profiles p
  where p.id = c.affiliate_id
    and p.status = 'active'
    and c.status = 'hold'
    and c.hold_until is not null
    and c.hold_until <= now();
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.release_affiliate_commissions_admin()
  from public, anon, authenticated;
grant execute on function public.release_affiliate_commissions_admin()
  to service_role;

create or replace function public.save_affiliate_payout_account_admin(
  p_affiliate_id uuid,
  p_pix_key_type text,
  p_pix_key_encrypted text,
  p_pix_key_masked text,
  p_holder_name text,
  p_holder_document_hash text,
  p_holder_document_last4 text,
  p_bank_name text,
  p_provider_validation jsonb,
  p_is_verified boolean,
  p_verified_by text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  if p_pix_key_type not in ('CPF','CNPJ','EMAIL','PHONE','EVP') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;
  if not exists (
    select 1 from public.affiliate_profiles
    where id = p_affiliate_id and status in ('pending','active')
  ) then
    raise exception 'Indicador não encontrado ou bloqueado.';
  end if;

  insert into orcaly_private.affiliate_payout_accounts (
    affiliate_id, pix_key_type, pix_key_encrypted, pix_key_masked,
    holder_name, holder_document_hash, holder_document_last4,
    bank_name, provider_validation, is_verified, verified_at, verified_by
  ) values (
    p_affiliate_id, p_pix_key_type, p_pix_key_encrypted, p_pix_key_masked,
    p_holder_name, p_holder_document_hash, p_holder_document_last4,
    nullif(trim(p_bank_name), ''), coalesce(p_provider_validation, '{}'::jsonb),
    p_is_verified, case when p_is_verified then now() else null end,
    nullif(trim(p_verified_by), '')
  )
  on conflict (affiliate_id) do update
  set pix_key_type = excluded.pix_key_type,
      pix_key_encrypted = excluded.pix_key_encrypted,
      pix_key_masked = excluded.pix_key_masked,
      holder_name = excluded.holder_name,
      holder_document_hash = excluded.holder_document_hash,
      holder_document_last4 = excluded.holder_document_last4,
      bank_name = excluded.bank_name,
      provider_validation = excluded.provider_validation,
      is_verified = excluded.is_verified,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      updated_at = now();

  update public.affiliate_profiles
  set payout_status = case when p_is_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;
  return true;
end;
$$;
revoke all on function public.save_affiliate_payout_account_admin(
  uuid,text,text,text,text,text,text,text,jsonb,boolean,text
) from public, anon, authenticated;
grant execute on function public.save_affiliate_payout_account_admin(
  uuid,text,text,text,text,text,text,text,jsonb,boolean,text
) to service_role;

create or replace function public.get_affiliate_payout_account_admin(p_affiliate_id uuid)
returns table (
  affiliate_id uuid,
  pix_key_type text,
  pix_key_encrypted text,
  pix_key_masked text,
  holder_name text,
  holder_document_hash text,
  holder_document_last4 text,
  bank_name text,
  provider_validation jsonb,
  is_verified boolean,
  verified_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
  select a.affiliate_id, a.pix_key_type, a.pix_key_encrypted,
         a.pix_key_masked, a.holder_name, a.holder_document_hash,
         a.holder_document_last4, a.bank_name, a.provider_validation,
         a.is_verified, a.verified_at, a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  where a.affiliate_id = p_affiliate_id;
$$;
revoke all on function public.get_affiliate_payout_account_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.get_affiliate_payout_account_admin(uuid)
  to service_role;

create or replace function public.set_affiliate_payout_account_verification_admin(
  p_affiliate_id uuid,
  p_verified boolean,
  p_verified_by text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  update orcaly_private.affiliate_payout_accounts
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = nullif(trim(p_verified_by), ''),
      provider_validation = provider_validation || jsonb_build_object(
        'manual_note', nullif(trim(p_note), ''),
        'manual_verified', p_verified,
        'manual_verified_at', now()
      ),
      updated_at = now()
  where affiliate_id = p_affiliate_id;
  if not found then return false; end if;

  update public.affiliate_profiles
  set payout_status = case when p_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;
  return true;
end;
$$;
revoke all on function public.set_affiliate_payout_account_verification_admin(
  uuid,boolean,text,text
) from public, anon, authenticated;
grant execute on function public.set_affiliate_payout_account_verification_admin(
  uuid,boolean,text,text
) to service_role;

create or replace function public.create_affiliate_payout_admin(p_affiliate_id uuid)
returns table (
  payout_id uuid,
  payout_amount numeric,
  gross_amount numeric,
  debt_applied numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare
  profile_row public.affiliate_profiles%rowtype;
  account_row orcaly_private.affiliate_payout_accounts%rowtype;
  settings_row public.affiliate_program_settings%rowtype;
  gross numeric(14,2);
  debt numeric(14,2);
  offset_value numeric(14,2);
  net_value numeric(14,2);
  new_payout_id uuid;
begin
  perform public.release_affiliate_commissions_admin();
  select * into profile_row
  from public.affiliate_profiles
  where id = p_affiliate_id for update;
  if not found or profile_row.status <> 'active' then
    raise exception 'Indicador inativo ou não encontrado.';
  end if;

  select * into account_row
  from orcaly_private.affiliate_payout_accounts
  where affiliate_id = p_affiliate_id for update;
  if not found or not account_row.is_verified then
    raise exception 'Conta Pix ainda não verificada.';
  end if;

  select * into settings_row
  from public.affiliate_program_settings where id = 1;
  if not settings_row.payouts_enabled then
    raise exception 'Pagamentos de comissão estão temporariamente desativados.';
  end if;
  if exists (
    select 1 from public.affiliate_payouts
    where affiliate_id = p_affiliate_id
      and status in ('requested','approved','processing')
  ) then
    raise exception 'Já existe um pagamento em andamento.';
  end if;

  select coalesce(sum(locked.commission_amount), 0)
  into gross
  from (
    select c.id, c.commission_amount
    from public.affiliate_commissions c
    where c.affiliate_id = p_affiliate_id
      and c.status = 'available'
    order by c.created_at, c.id
    for update
  ) locked;

  debt := coalesce(profile_row.debt_balance, 0);
  offset_value := least(gross, debt);
  net_value := round(gross - offset_value, 2);
  if net_value < settings_row.minimum_payout_amount then
    raise exception 'Saldo disponível abaixo do mínimo de pagamento.';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id, gross_commissions, debt_offset, amount, status,
    provider, external_reference, pix_key_type, pix_key_masked, holder_name
  ) values (
    p_affiliate_id, gross, offset_value, net_value, 'requested', 'manual',
    'affiliate_payout:' || gen_random_uuid()::text,
    account_row.pix_key_type, account_row.pix_key_masked, account_row.holder_name
  ) returning id into new_payout_id;

  insert into public.affiliate_payout_items (payout_id, commission_id, amount)
  select new_payout_id, id, commission_amount
  from public.affiliate_commissions
  where affiliate_id = p_affiliate_id and status = 'available';

  update public.affiliate_commissions
  set status = 'processing', payout_id = new_payout_id, updated_at = now()
  where affiliate_id = p_affiliate_id and status = 'available';

  update public.affiliate_profiles
  set debt_balance = greatest(0, debt - offset_value), updated_at = now()
  where id = p_affiliate_id;

  return query select new_payout_id, net_value, gross, offset_value;
end;
$$;
revoke all on function public.create_affiliate_payout_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.create_affiliate_payout_admin(uuid)
  to service_role;

create or replace function public.mark_affiliate_payout_paid_admin(
  p_payout_id uuid,
  p_provider text,
  p_provider_transfer_id text,
  p_proof_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  update public.affiliate_payouts
  set status = 'paid',
      provider = case when p_provider in ('manual','asaas') then p_provider else provider end,
      provider_transfer_id = nullif(trim(p_provider_transfer_id), ''),
      proof_url = nullif(trim(p_proof_url), ''),
      paid_at = now(), updated_at = now()
  where id = p_payout_id and status in ('requested','approved','processing');
  if not found then return false; end if;

  update public.affiliate_commissions
  set status = 'paid', updated_at = now()
  where payout_id = p_payout_id and status = 'processing';
  return true;
end;
$$;
revoke all on function public.mark_affiliate_payout_paid_admin(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.mark_affiliate_payout_paid_admin(uuid,text,text,text)
  to service_role;

create or replace function public.fail_affiliate_payout_admin(
  p_payout_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id for update;
  if not found or payout_row.status not in ('requested','approved','processing') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'failed', failure_reason = left(coalesce(p_reason, 'Falha no pagamento.'), 500),
      failed_at = now(), updated_at = now()
  where id = p_payout_id;
  update public.affiliate_commissions
  set status = 'available', payout_id = null, updated_at = now()
  where payout_id = p_payout_id and status = 'processing';
  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset, updated_at = now()
    where id = payout_row.affiliate_id;
  end if;
  return true;
end;
$$;
revoke all on function public.fail_affiliate_payout_admin(uuid,text)
  from public, anon, authenticated;
grant execute on function public.fail_affiliate_payout_admin(uuid,text)
  to service_role;

create or replace function public.cancel_affiliate_payout_admin(
  p_payout_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id for update;
  if not found or payout_row.status not in ('requested','approved') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'cancelled',
      failure_reason = left(coalesce(p_reason, 'Pagamento cancelado.'), 500),
      cancelled_at = now(), updated_at = now()
  where id = p_payout_id;
  update public.affiliate_commissions
  set status = 'available', payout_id = null, updated_at = now()
  where payout_id = p_payout_id and status = 'processing';
  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset, updated_at = now()
    where id = payout_row.affiliate_id;
  end if;
  return true;
end;
$$;
revoke all on function public.cancel_affiliate_payout_admin(uuid,text)
  from public, anon, authenticated;
grant execute on function public.cancel_affiliate_payout_admin(uuid,text)
  to service_role;

create or replace function public.reverse_affiliate_commission_admin(
  p_provider_payment_id text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare commission_row public.affiliate_commissions%rowtype;
begin
  select * into commission_row
  from public.affiliate_commissions
  where provider_payment_id = p_provider_payment_id for update;
  if not found or commission_row.status in ('reversed','rejected') then
    return false;
  end if;

  if commission_row.status = 'paid' then
    update public.affiliate_profiles
    set debt_balance = debt_balance + commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  update public.affiliate_commissions
  set status = 'reversed', reversed_at = now(),
      reversal_reason = left(coalesce(p_reason, 'Pagamento estornado.'), 500),
      updated_at = now()
  where id = commission_row.id;
  update public.affiliate_referrals
  set status = 'reversed', updated_at = now()
  where id = commission_row.referral_id;
  return true;
end;
$$;
revoke all on function public.reverse_affiliate_commission_admin(text,text)
  from public, anon, authenticated;
grant execute on function public.reverse_affiliate_commission_admin(text,text)
  to service_role;

alter table public.affiliate_program_settings enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_payout_items enable row level security;
alter table public.affiliate_audit_logs enable row level security;

revoke all on public.affiliate_program_settings from anon, authenticated;
revoke all on public.affiliate_profiles from anon, authenticated;
revoke all on public.affiliate_clicks from anon, authenticated;
revoke all on public.affiliate_referrals from anon, authenticated;
revoke all on public.affiliate_commissions from anon, authenticated;
revoke all on public.affiliate_payouts from anon, authenticated;
revoke all on public.affiliate_payout_items from anon, authenticated;
revoke all on public.affiliate_audit_logs from anon, authenticated;
revoke all on orcaly_private.affiliate_payout_accounts from public, anon, authenticated;

grant select on public.affiliate_profiles to authenticated;
grant select on public.affiliate_referrals to authenticated;
grant select on public.affiliate_commissions to authenticated;
grant select on public.affiliate_payouts to authenticated;

drop policy if exists affiliate_profiles_select_own on public.affiliate_profiles;
create policy affiliate_profiles_select_own
on public.affiliate_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists affiliate_referrals_select_own on public.affiliate_referrals;
create policy affiliate_referrals_select_own
on public.affiliate_referrals for select to authenticated
using (exists (
  select 1 from public.affiliate_profiles p
  where p.id = affiliate_referrals.affiliate_id
    and p.user_id = (select auth.uid())
));

drop policy if exists affiliate_commissions_select_own on public.affiliate_commissions;
create policy affiliate_commissions_select_own
on public.affiliate_commissions for select to authenticated
using (exists (
  select 1 from public.affiliate_profiles p
  where p.id = affiliate_commissions.affiliate_id
    and p.user_id = (select auth.uid())
));

drop policy if exists affiliate_payouts_select_own on public.affiliate_payouts;
create policy affiliate_payouts_select_own
on public.affiliate_payouts for select to authenticated
using (exists (
  select 1 from public.affiliate_profiles p
  where p.id = affiliate_payouts.affiliate_id
    and p.user_id = (select auth.uid())
));

drop policy if exists affiliate_settings_deny_client on public.affiliate_program_settings;
create policy affiliate_settings_deny_client
on public.affiliate_program_settings for all to authenticated
using (false) with check (false);
drop policy if exists affiliate_clicks_deny_client on public.affiliate_clicks;
create policy affiliate_clicks_deny_client
on public.affiliate_clicks for all to authenticated
using (false) with check (false);
drop policy if exists affiliate_payout_items_deny_client on public.affiliate_payout_items;
create policy affiliate_payout_items_deny_client
on public.affiliate_payout_items for all to authenticated
using (false) with check (false);
drop policy if exists affiliate_audit_logs_deny_client on public.affiliate_audit_logs;
create policy affiliate_audit_logs_deny_client
on public.affiliate_audit_logs for all to authenticated
using (false) with check (false);

drop trigger if exists affiliate_program_settings_updated_at on public.affiliate_program_settings;
create trigger affiliate_program_settings_updated_at
before update on public.affiliate_program_settings
for each row execute function orcaly_private.touch_affiliate_updated_at();
drop trigger if exists affiliate_profiles_updated_at on public.affiliate_profiles;
create trigger affiliate_profiles_updated_at
before update on public.affiliate_profiles
for each row execute function orcaly_private.touch_affiliate_updated_at();
drop trigger if exists affiliate_payout_accounts_updated_at on orcaly_private.affiliate_payout_accounts;
create trigger affiliate_payout_accounts_updated_at
before update on orcaly_private.affiliate_payout_accounts
for each row execute function orcaly_private.touch_affiliate_updated_at();
drop trigger if exists affiliate_referrals_updated_at on public.affiliate_referrals;
create trigger affiliate_referrals_updated_at
before update on public.affiliate_referrals
for each row execute function orcaly_private.touch_affiliate_updated_at();
drop trigger if exists affiliate_commissions_updated_at on public.affiliate_commissions;
create trigger affiliate_commissions_updated_at
before update on public.affiliate_commissions
for each row execute function orcaly_private.touch_affiliate_updated_at();
drop trigger if exists affiliate_payouts_updated_at on public.affiliate_payouts;
create trigger affiliate_payouts_updated_at
before update on public.affiliate_payouts
for each row execute function orcaly_private.touch_affiliate_updated_at();

comment on table public.affiliate_profiles is
  'Perfis do Portal de Parceiros do Orcaly.';
comment on table public.affiliate_referrals is
  'Atribuicao imutavel de indicacoes a cadastros e empresas.';
comment on table public.affiliate_commissions is
  'Comissao unica sobre o primeiro pagamento elegivel.';
comment on table public.affiliate_payouts is
  'Lotes de pagamento Pix de comissoes de parceiros.';
comment on table orcaly_private.affiliate_payout_accounts is
  'Dados Pix criptografados, fora do schema exposto.';

commit;
