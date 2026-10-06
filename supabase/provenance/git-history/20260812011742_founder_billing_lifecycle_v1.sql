alter table public.companies
  add column if not exists founder_billing_claim_id uuid null,
  add column if not exists founder_billing_claimed_at timestamptz null,
  add column if not exists founder_billing_attempts integer not null default 0,
  add column if not exists founder_billing_last_error text null,
  add column if not exists founder_billing_setup_at timestamptz null,
  add column if not exists founder_billing_authorized_at timestamptz null,
  add column if not exists founder_billing_last_sync_at timestamptz null,
  add column if not exists founder_price_conversion_claim_id uuid null,
  add column if not exists founder_price_conversion_claimed_at timestamptz null,
  add column if not exists founder_price_conversion_attempts integer not null default 0,
  add column if not exists founder_price_conversion_last_error text null;

alter table public.companies
  drop constraint if exists companies_founder_billing_claim_pair_check,
  drop constraint if exists companies_founder_billing_attempts_check,
  drop constraint if exists companies_founder_conversion_claim_pair_check,
  drop constraint if exists companies_founder_conversion_attempts_check,
  drop constraint if exists companies_founder_conversion_timeline_check;

alter table public.companies
  add constraint companies_founder_billing_claim_pair_check
    check ((founder_billing_claim_id is null) = (founder_billing_claimed_at is null)),
  add constraint companies_founder_billing_attempts_check
    check (founder_billing_attempts >= 0),
  add constraint companies_founder_conversion_claim_pair_check
    check ((founder_price_conversion_claim_id is null) = (founder_price_conversion_claimed_at is null)),
  add constraint companies_founder_conversion_attempts_check
    check (founder_price_conversion_attempts >= 0),
  add constraint companies_founder_conversion_timeline_check
    check (
      founder_price_converted_at is null
      or founder_price_ends_at is null
      or founder_price_converted_at >= founder_price_ends_at
    );

create or replace function public.claim_founder_billing_setup(
  p_company_id uuid,
  p_claim_id uuid
)
returns table (
  company_id uuid,
  plan_payment_id uuid,
  plan_key text,
  payer_email text,
  effective_price_cents integer,
  founder_price_cents integer,
  normal_price_cents integer,
  billing_start_at timestamptz,
  provider_subscription_id text,
  checkout_url text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.companies%rowtype;
  v_payment public.plan_payments%rowtype;
  v_normal integer;
  v_effective integer;
  v_payment_id uuid;
begin
  if p_company_id is null or p_claim_id is null then
    raise exception 'FOUNDER_BILLING_INVALID_CLAIM';
  end if;

  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = 'STALE_BILLING_CLAIM_RECOVERED',
      updated_at = now()
  where c.id = p_company_id
    and c.founder_billing_claim_id is not null
    and c.founder_billing_claimed_at < now() - interval '10 minutes';

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'FOUNDER_BILLING_COMPANY_NOT_FOUND';
  end if;

  if v_company.is_founder is not true then
    raise exception 'FOUNDER_BILLING_NOT_FOUNDER';
  end if;

  if v_company.founder_billing_claim_id is not null then
    raise exception 'FOUNDER_BILLING_IN_PROGRESS';
  end if;

  if v_company.founder_trial_ends_at is null
     or v_company.founder_price_ends_at is null
     or v_company.founder_price_cents is null then
    raise exception 'FOUNDER_BILLING_TIMELINE_MISSING';
  end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano, v_company.plano, ''))
    when 'basico' then 4990
    when 'básico' then 4990
    when 'essencial' then 4990
    when 'profissional' then 9990
    when 'intermediario' then 9990
    when 'intermediário' then 9990
    when 'premium' then 14990
    else null
  end;

  if v_normal is null then
    raise exception 'FOUNDER_BILLING_INVALID_PLAN';
  end if;

  v_effective := case
    when now() < v_company.founder_price_ends_at then v_company.founder_price_cents
    else v_normal
  end;

  select pp.* into v_payment
  from public.plan_payments pp
  where pp.company_id = p_company_id
    and pp.idempotency_key = 'founder-recurring-v1'
  order by pp.created_at desc
  limit 1
  for update;

  if not found then
    v_payment_id := gen_random_uuid();

    insert into public.plan_payments (
      id, company_id, plano, valor, status, tipo, email, nome_empresa,
      payment_method, provider, billing_type, external_reference,
      idempotency_key, created_at, updated_at
    ) values (
      v_payment_id,
      p_company_id,
      lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
      v_effective / 100.0,
      'subscription_pending',
      'subscription',
      lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, '')),
      v_company.nome,
      'card_recurring',
      'mercado_pago',
      'founder_recurring',
      v_payment_id::text,
      'founder-recurring-v1',
      now(),
      now()
    )
    returning * into v_payment;
  else
    update public.plan_payments pp
    set plano = lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
        valor = case
          when coalesce(pp.provider_subscription_id, pp.mercado_pago_preapproval_id) is null
            then v_effective / 100.0
          else pp.valor
        end,
        email = lower(coalesce(v_company.email, pp.email, '')),
        provider = 'mercado_pago',
        billing_type = 'founder_recurring',
        external_reference = coalesce(nullif(pp.external_reference, ''), pp.id::text),
        updated_at = now()
    where pp.id = v_payment.id
    returning * into v_payment;
  end if;

  update public.companies c
  set founder_billing_claim_id = p_claim_id,
      founder_billing_claimed_at = now(),
      founder_billing_attempts = c.founder_billing_attempts + 1,
      founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  return query
  select
    v_company.id,
    v_payment.id,
    lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
    lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, v_payment.email, '')),
    v_effective,
    v_company.founder_price_cents,
    v_normal,
    v_company.founder_trial_ends_at,
    coalesce(
      v_company.provider_subscription_id,
      v_company.mercado_pago_subscription_id,
      v_payment.provider_subscription_id,
      v_payment.mercado_pago_preapproval_id
    ),
    coalesce(v_payment.checkout_url, v_company.assinatura_checkout_url);
end;
$$;

create or replace function public.release_founder_billing_claim(
  p_company_id uuid,
  p_claim_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 1000),
      updated_at = now()
  where c.id = p_company_id
    and c.founder_billing_claim_id = p_claim_id;

  return found;
end;
$$;

create or replace function public.complete_founder_billing_setup(
  p_company_id uuid,
  p_claim_id uuid,
  p_plan_payment_id uuid,
  p_subscription_id text,
  p_provider_status text,
  p_checkout_url text,
  p_next_payment_date timestamptz,
  p_provider_payload jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.companies%rowtype;
  v_status text := lower(btrim(coalesce(p_provider_status, 'pending')));
begin
  if nullif(btrim(coalesce(p_subscription_id, '')), '') is null then
    raise exception 'FOUNDER_BILLING_SUBSCRIPTION_REQUIRED';
  end if;

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
    and c.founder_billing_claim_id = p_claim_id
    and c.is_founder = true
  for update;

  if not found then
    raise exception 'FOUNDER_BILLING_CLAIM_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.plan_payments pp
    where pp.id = p_plan_payment_id
      and pp.company_id = p_company_id
      and pp.idempotency_key = 'founder-recurring-v1'
  ) then
    raise exception 'FOUNDER_BILLING_PAYMENT_ROW_MISMATCH';
  end if;

  update public.plan_payments pp
  set provider = 'mercado_pago',
      provider_subscription_id = p_subscription_id,
      mercado_pago_preapproval_id = p_subscription_id,
      checkout_url = p_checkout_url,
      raw_subscription = coalesce(p_provider_payload, '{}'::jsonb),
      next_payment_date = p_next_payment_date,
      status = 'subscription_' || v_status,
      updated_at = now()
  where pp.id = p_plan_payment_id;

  update public.companies c
  set subscription_provider = 'mercado_pago',
      provider_subscription_id = p_subscription_id,
      mercado_pago_subscription_id = p_subscription_id,
      mercado_pago_subscription_status = v_status,
      mercado_pago_customer_email = coalesce(c.mercado_pago_customer_email, c.email),
      assinatura_checkout_url = p_checkout_url,
      assinatura_mp_payload = coalesce(p_provider_payload, '{}'::jsonb),
      assinatura_proxima_cobranca = p_next_payment_date,
      next_billing_at = p_next_payment_date,
      assinatura_auto_recorrente = (v_status = 'authorized'),
      assinatura_status = case
        when c.assinatura_status = 'ativa' then 'ativa'
        when c.founder_trial_ends_at > now() then 'trialing'
        else 'pendente'
      end,
      founder_billing_setup_at = coalesce(c.founder_billing_setup_at, now()),
      founder_billing_authorized_at = case
        when v_status = 'authorized' then coalesce(c.founder_billing_authorized_at, now())
        else c.founder_billing_authorized_at
      end,
      founder_billing_last_sync_at = now(),
      founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  insert into public.subscription_events (
    company_id, event_type, old_status, new_status, provider,
    provider_reference, provider_object_id, metadata,
    processing_status, processed_at
  ) values (
    p_company_id,
    'founder_billing_setup',
    null,
    v_status,
    'mercado_pago',
    p_subscription_id,
    p_subscription_id,
    jsonb_build_object(
      'plan_payment_id', p_plan_payment_id,
      'founder_number', v_company.founder_number,
      'founder_price_cents', v_company.founder_price_cents,
      'trial_ends_at', v_company.founder_trial_ends_at
    ),
    'processed',
    now()
  )
  on conflict do nothing;

  return v_company;
end;
$$;

create or replace function public.expire_due_founder_trials()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.companies%rowtype;
  v_count integer := 0;
begin
  for v_company in
    select c.*
    from public.companies c
    where c.is_founder = true
      and c.assinatura_status = 'trialing'
      and c.trial_ends_at is not null
      and c.trial_ends_at <= now()
    order by c.id
    for update skip locked
  loop
    update public.companies c
    set assinatura_status = 'pendente',
        access_until = c.trial_ends_at,
        assinatura_expira_em = c.trial_ends_at,
        updated_at = now()
    where c.id = v_company.id;

    insert into public.subscription_events (
      company_id, event_type, old_status, new_status, provider,
      provider_reference, metadata, processing_status, processed_at
    ) values (
      v_company.id,
      'founder_trial_ended',
      'trialing',
      'pendente',
      'mercado_pago',
      'founder-trial-v1',
      jsonb_build_object('trial_ends_at', v_company.trial_ends_at),
      'processed',
      now()
    )
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.record_founder_payment_approved(
  p_company_id uuid,
  p_subscription_id text,
  p_payment_id text,
  p_next_payment_date timestamptz,
  p_provider_payload jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.companies%rowtype;
  v_access_until timestamptz;
  v_lead_id uuid;
begin
  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
    and c.is_founder = true
  for update;

  if not found then
    raise exception 'FOUNDER_PAYMENT_COMPANY_NOT_FOUND';
  end if;

  if nullif(btrim(coalesce(p_subscription_id, '')), '') is null then
    raise exception 'FOUNDER_PAYMENT_SUBSCRIPTION_REQUIRED';
  end if;

  v_access_until := case
    when p_next_payment_date is not null and p_next_payment_date > now()
      then p_next_payment_date
    else now() + interval '1 month'
  end;

  update public.companies c
  set ativo = true,
      assinatura_status = 'ativa',
      assinatura_auto_recorrente = true,
      assinatura_inicio = coalesce(c.assinatura_inicio, now()),
      assinatura_expira_em = v_access_until,
      access_until = v_access_until,
      assinatura_ultimo_pagamento = now(),
      assinatura_proxima_cobranca = p_next_payment_date,
      next_billing_at = p_next_payment_date,
      subscription_provider = 'mercado_pago',
      provider_subscription_id = p_subscription_id,
      mercado_pago_subscription_id = p_subscription_id,
      mercado_pago_subscription_status = 'authorized',
      assinatura_mp_payload = coalesce(p_provider_payload, '{}'::jsonb),
      founder_billing_authorized_at = coalesce(c.founder_billing_authorized_at, now()),
      founder_billing_last_sync_at = now(),
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  update public.plan_payments pp
  set provider = 'mercado_pago',
      provider_subscription_id = p_subscription_id,
      mercado_pago_preapproval_id = p_subscription_id,
      provider_payment_id = nullif(btrim(coalesce(p_payment_id, '')), ''),
      mercado_pago_payment_id = nullif(btrim(coalesce(p_payment_id, '')), ''),
      paid_at = coalesce(pp.paid_at, now()),
      next_payment_date = p_next_payment_date,
      raw_subscription = coalesce(p_provider_payload, pp.raw_subscription),
      status = 'approved',
      updated_at = now()
  where pp.company_id = p_company_id
    and pp.idempotency_key = 'founder-recurring-v1';

  insert into public.subscription_events (
    company_id, event_type, old_status, new_status, provider,
    provider_reference, provider_object_id, metadata,
    processing_status, processed_at
  ) values (
    p_company_id,
    'founder_subscription_started',
    null,
    'ativa',
    'mercado_pago',
    p_subscription_id,
    nullif(btrim(coalesce(p_payment_id, '')), ''),
    jsonb_build_object(
      'founder_number', v_company.founder_number,
      'payment_id', p_payment_id,
      'next_payment_date', p_next_payment_date
    ),
    'processed',
    now()
  )
  on conflict do nothing;

  update public.signup_leads sl
  set sales_stage = 'cliente',
      sales_stage_updated_at = now(),
      updated_at = now()
  where sl.converted_company_id = p_company_id
    and sl.sales_stage = 'conta_ativada'
  returning sl.id into v_lead_id;

  if v_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    select
      v_lead_id,
      'system',
      'registrado',
      'Primeira cobrança do Cliente Founder confirmada; etapa alterada para cliente.',
      now(),
      now(),
      fi.created_by_email,
      fi.created_by_admin_id,
      'system',
      jsonb_build_object(
        'source', 'founder_program',
        'event', 'first_payment_approved',
        'payment_id', p_payment_id
      )
    from public.founder_invites fi
    where fi.company_id = p_company_id
      and fi.status = 'activated'
    order by fi.activated_at desc
    limit 1;
  end if;

  return v_company;
end;
$$;

create or replace function public.claim_due_founder_price_conversions(
  p_limit integer default 20
)
returns table (
  company_id uuid,
  claim_id uuid,
  provider_subscription_id text,
  plan_key text,
  founder_price_cents integer,
  normal_price_cents integer,
  founder_price_ends_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.companies c
  set founder_price_conversion_claim_id = null,
      founder_price_conversion_claimed_at = null,
      founder_price_conversion_last_error = 'STALE_PRICE_CONVERSION_CLAIM_RECOVERED',
      updated_at = now()
  where c.founder_price_conversion_claim_id is not null
    and c.founder_price_conversion_claimed_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select c.id
    from public.companies c
    where c.is_founder = true
      and c.founder_price_ends_at is not null
      and c.founder_price_ends_at <= now()
      and c.founder_price_converted_at is null
      and c.founder_price_conversion_claim_id is null
      and coalesce(c.provider_subscription_id, c.mercado_pago_subscription_id) is not null
    order by c.founder_price_ends_at, c.id
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    for update skip locked
  )
  update public.companies c
  set founder_price_conversion_claim_id = gen_random_uuid(),
      founder_price_conversion_claimed_at = now(),
      founder_price_conversion_attempts = c.founder_price_conversion_attempts + 1,
      founder_price_conversion_last_error = null,
      updated_at = now()
  from candidates x
  where c.id = x.id
  returning
    c.id,
    c.founder_price_conversion_claim_id,
    coalesce(c.provider_subscription_id, c.mercado_pago_subscription_id),
    lower(coalesce(c.assinatura_plano, c.plano, '')),
    c.founder_price_cents,
    case lower(coalesce(c.assinatura_plano, c.plano, ''))
      when 'basico' then 4990
      when 'básico' then 4990
      when 'essencial' then 4990
      when 'profissional' then 9990
      when 'intermediario' then 9990
      when 'intermediário' then 9990
      when 'premium' then 14990
      else null
    end,
    c.founder_price_ends_at;
end;
$$;

create or replace function public.release_founder_price_conversion_claim(
  p_company_id uuid,
  p_claim_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.companies c
  set founder_price_conversion_claim_id = null,
      founder_price_conversion_claimed_at = null,
      founder_price_conversion_last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 1000),
      updated_at = now()
  where c.id = p_company_id
    and c.founder_price_conversion_claim_id = p_claim_id;

  return found;
end;
$$;

create or replace function public.complete_founder_price_conversion(
  p_company_id uuid,
  p_claim_id uuid,
  p_provider_status text,
  p_provider_payload jsonb,
  p_action text
)
returns public.companies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company public.companies%rowtype;
  v_normal integer;
  v_amount numeric;
  v_action text := lower(btrim(coalesce(p_action, 'updated')));
begin
  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
    and c.is_founder = true
    and c.founder_price_conversion_claim_id = p_claim_id
    and c.founder_price_converted_at is null
  for update;

  if not found then
    raise exception 'FOUNDER_PRICE_CONVERSION_CLAIM_NOT_FOUND';
  end if;

  if v_company.founder_price_ends_at > now() then
    raise exception 'FOUNDER_PRICE_CONVERSION_TOO_EARLY';
  end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano, v_company.plano, ''))
    when 'basico' then 4990
    when 'básico' then 4990
    when 'essencial' then 4990
    when 'profissional' then 9990
    when 'intermediario' then 9990
    when 'intermediário' then 9990
    when 'premium' then 14990
    else null
  end;

  if v_normal is null then
    raise exception 'FOUNDER_PRICE_CONVERSION_INVALID_PLAN';
  end if;

  if v_action not in ('inactive', 'cancelled') then
    begin
      v_amount := nullif(
        p_provider_payload #>> '{auto_recurring,transaction_amount}',
        ''
      )::numeric;
    exception when others then
      v_amount := null;
    end;

    if v_amount is null or round(v_amount * 100)::integer <> v_normal then
      raise exception 'FOUNDER_STANDARD_PRICE_PROVIDER_MISMATCH';
    end if;
  end if;

  update public.companies c
  set founder_price_converted_at = now(),
      founder_price_conversion_claim_id = null,
      founder_price_conversion_claimed_at = null,
      founder_price_conversion_last_error = null,
      founder_billing_last_sync_at = now(),
      mercado_pago_subscription_status = coalesce(
        nullif(btrim(coalesce(p_provider_status, '')), ''),
        c.mercado_pago_subscription_status
      ),
      assinatura_mp_payload = coalesce(p_provider_payload, c.assinatura_mp_payload),
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  update public.plan_payments pp
  set valor = v_normal / 100.0,
      raw_subscription = coalesce(p_provider_payload, pp.raw_subscription),
      status = case
        when v_action in ('inactive', 'cancelled') then pp.status
        else 'subscription_' || lower(coalesce(p_provider_status, 'authorized'))
      end,
      updated_at = now()
  where pp.company_id = p_company_id
    and pp.idempotency_key = 'founder-recurring-v1';

  insert into public.subscription_events (
    company_id, event_type, old_status, new_status, provider,
    provider_reference, provider_object_id, metadata,
    processing_status, processed_at
  ) values (
    p_company_id,
    'founder_converted_to_standard_price',
    v_company.founder_price_cents::text,
    v_normal::text,
    'mercado_pago',
    coalesce(v_company.provider_subscription_id, v_company.mercado_pago_subscription_id),
    coalesce(v_company.provider_subscription_id, v_company.mercado_pago_subscription_id),
    jsonb_build_object(
      'action', v_action,
      'plan_key', coalesce(v_company.assinatura_plano, v_company.plano),
      'founder_price_cents', v_company.founder_price_cents,
      'normal_price_cents', v_normal,
      'founder_price_ends_at', v_company.founder_price_ends_at,
      'provider_status', p_provider_status
    ),
    'processed',
    now()
  )
  on conflict do nothing;

  return v_company;
end;
$$;

revoke all on function public.claim_founder_billing_setup(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.release_founder_billing_claim(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.complete_founder_billing_setup(
  uuid,uuid,uuid,text,text,text,timestamptz,jsonb
) from public, anon, authenticated;
revoke all on function public.expire_due_founder_trials()
  from public, anon, authenticated;
revoke all on function public.record_founder_payment_approved(
  uuid,text,text,timestamptz,jsonb
) from public, anon, authenticated;
revoke all on function public.claim_due_founder_price_conversions(integer)
  from public, anon, authenticated;
revoke all on function public.release_founder_price_conversion_claim(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.complete_founder_price_conversion(
  uuid,uuid,text,jsonb,text
) from public, anon, authenticated;

grant execute on function public.claim_founder_billing_setup(uuid,uuid)
  to service_role;
grant execute on function public.release_founder_billing_claim(uuid,uuid,text)
  to service_role;
grant execute on function public.complete_founder_billing_setup(
  uuid,uuid,uuid,text,text,text,timestamptz,jsonb
) to service_role;
grant execute on function public.expire_due_founder_trials()
  to service_role;
grant execute on function public.record_founder_payment_approved(
  uuid,text,text,timestamptz,jsonb
) to service_role;
grant execute on function public.claim_due_founder_price_conversions(integer)
  to service_role;
grant execute on function public.release_founder_price_conversion_claim(uuid,uuid,text)
  to service_role;
grant execute on function public.complete_founder_price_conversion(
  uuid,uuid,text,jsonb,text
) to service_role;
