-- ORCALY_AFFILIATE_WORKSPACE_SERVER_AUTHORITY_V1
begin;

-- O parceiro consulta os próprios dados, mas mutações passam pelo backend.
revoke insert, update, delete on public.affiliate_leads from authenticated;
revoke insert, update, delete on public.affiliate_tasks from authenticated;
revoke insert, update, delete on public.affiliate_goals from authenticated;
revoke insert, update, delete on public.affiliate_activity_events from authenticated;
revoke insert, update, delete on public.affiliate_course_progress from authenticated;
revoke insert, update, delete on public.affiliate_certifications from authenticated;
revoke insert, update, delete on public.affiliate_training_sessions from authenticated;
revoke insert, update, delete on public.affiliate_achievements from authenticated;

drop policy if exists affiliate_leads_insert_own on public.affiliate_leads;
drop policy if exists affiliate_leads_update_own on public.affiliate_leads;
drop policy if exists affiliate_leads_delete_own on public.affiliate_leads;

drop policy if exists affiliate_tasks_insert_own on public.affiliate_tasks;
drop policy if exists affiliate_tasks_update_own on public.affiliate_tasks;
drop policy if exists affiliate_tasks_delete_own on public.affiliate_tasks;

drop policy if exists affiliate_goals_insert_own on public.affiliate_goals;
drop policy if exists affiliate_goals_update_own on public.affiliate_goals;
drop policy if exists affiliate_goals_delete_own on public.affiliate_goals;

drop policy if exists affiliate_events_insert_own on public.affiliate_activity_events;
drop policy if exists affiliate_events_update_own on public.affiliate_activity_events;
drop policy if exists affiliate_events_delete_own on public.affiliate_activity_events;

drop policy if exists affiliate_course_insert_own on public.affiliate_course_progress;
drop policy if exists affiliate_course_update_own on public.affiliate_course_progress;
drop policy if exists affiliate_course_delete_own on public.affiliate_course_progress;

drop policy if exists affiliate_cert_insert_own on public.affiliate_certifications;
drop policy if exists affiliate_cert_update_own on public.affiliate_certifications;
drop policy if exists affiliate_cert_delete_own on public.affiliate_certifications;

drop policy if exists affiliate_training_insert_own on public.affiliate_training_sessions;
drop policy if exists affiliate_training_update_own on public.affiliate_training_sessions;
drop policy if exists affiliate_training_delete_own on public.affiliate_training_sessions;

drop policy if exists affiliate_achievements_insert_own on public.affiliate_achievements;
drop policy if exists affiliate_achievements_update_own on public.affiliate_achievements;
drop policy if exists affiliate_achievements_delete_own on public.affiliate_achievements;

-- Evita XP duplicado mesmo sob duas requisições concorrentes.
create unique index if not exists affiliate_activity_events_source_key_uq
  on public.affiliate_activity_events (
    affiliate_id,
    (metadata->>'source_key')
  )
  where metadata ? 'source_key';

-- A mesma tentativa de cobrança avulsa nunca cria duas linhas/charges.
create unique index if not exists plan_payments_company_idempotency_uq
  on public.plan_payments (company_id, idempotency_key)
  where idempotency_key is not null;

-- Ledger privado garante que o mesmo pagamento aprovado só estenda acesso uma vez.
create schema if not exists orcaly_private;
revoke all on schema orcaly_private from public, anon, authenticated;

create table if not exists orcaly_private.subscription_payment_applications (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_reference text not null,
  applied_at timestamptz not null default clock_timestamp(),
  primary key (company_id, provider_reference)
);

revoke all on orcaly_private.subscription_payment_applications
  from public, anon, authenticated;

create or replace function public.orcaly_apply_subscription_payment_once(
  p_company_id uuid,
  p_provider_reference text,
  p_plan text,
  p_payment_type text,
  p_amount numeric,
  p_previous_status text,
  p_previous_access_until timestamptz,
  p_new_access_until timestamptz,
  p_preapproval_id text,
  p_next_payment_date timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_now timestamptz := clock_timestamp();
  v_previous_status text;
  v_previous_access_until timestamptz;
  v_new_access_until timestamptz;
begin
  if p_company_id is null or coalesce(length(trim(p_provider_reference)), 0) < 1 then
    raise exception 'invalid subscription payment application';
  end if;

  select
    c.assinatura_status,
    greatest(
      coalesce(c.access_until, '-infinity'::timestamptz),
      coalesce(c.assinatura_expira_em, '-infinity'::timestamptz)
    )
  into v_previous_status, v_previous_access_until
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'company not found';
  end if;

  if v_previous_access_until = '-infinity'::timestamptz then
    v_previous_access_until := null;
  end if;

  v_new_access_until := case
    when p_next_payment_date is not null and p_next_payment_date > v_now
      then p_next_payment_date
    else greatest(coalesce(v_previous_access_until, v_now), v_now) + interval '1 month'
  end;

  insert into orcaly_private.subscription_payment_applications (
    company_id,
    provider_reference,
    applied_at
  )
  values (
    p_company_id,
    trim(p_provider_reference),
    v_now
  )
  on conflict (company_id, provider_reference) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  update public.companies
  set
    ativo = true,
    plano = p_plan,
    assinatura_plano = p_plan,
    assinatura_status = 'ativa',
    assinatura_inicio = coalesce(assinatura_inicio, v_now),
    assinatura_expira_em = v_new_access_until,
    access_until = v_new_access_until,
    assinatura_ultimo_pagamento = v_now,
    assinatura_proxima_cobranca = p_next_payment_date,
    assinatura_auto_recorrente = (p_payment_type = 'card_recurring'),
    assinatura_forma_pagamento_preferida = case
      when p_payment_type = 'card_recurring' then 'cartao_recorrente'
      when p_payment_type = 'card' then 'cartao_avulso'
      else 'pix_avulso'
    end,
    assinatura_pix_avulso_status = case
      when p_payment_type = 'pix' then 'paid'
      else assinatura_pix_avulso_status
    end,
    assinatura_pix_avulso_ultimo_pagamento = case
      when p_payment_type = 'pix' then v_now
      else assinatura_pix_avulso_ultimo_pagamento
    end,
    mercado_pago_subscription_id = coalesce(
      nullif(p_preapproval_id, ''),
      mercado_pago_subscription_id
    ),
    mercado_pago_subscription_status = case
      when p_payment_type = 'card_recurring' then 'authorized'
      else mercado_pago_subscription_status
    end,
    cancel_at_period_end = false,
    updated_at = v_now
  where id = p_company_id;

  if not found then
    raise exception 'company not found';
  end if;

  insert into public.subscription_events (
    company_id,
    event_type,
    old_status,
    new_status,
    provider,
    provider_reference,
    metadata
  )
  values (
    p_company_id,
    'payment_approved',
    v_previous_status,
    'ativa',
    'mercado_pago',
    trim(p_provider_reference),
    jsonb_build_object(
      'plan', p_plan,
      'payment_type', p_payment_type,
      'amount', p_amount,
      'previous_access_until', v_previous_access_until,
      'access_until', v_new_access_until
    )
  )
  on conflict (company_id, event_type, provider_reference) do nothing;

  return true;
exception
  when others then
    delete from orcaly_private.subscription_payment_applications
    where company_id = p_company_id
      and provider_reference = trim(p_provider_reference);
    raise;
end;
$$;

revoke all on function public.orcaly_apply_subscription_payment_once(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.orcaly_apply_subscription_payment_once(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz, text, timestamptz
) to service_role;

-- Regra única de acesso comercial: assinatura válida + nível de plano.
create or replace function public.orcaly_company_has_plan_access(
  p_company_id uuid,
  p_required_plan text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and coalesce(c.ativo, true) = true
      and greatest(
        coalesce(c.access_until, '-infinity'::timestamptz),
        coalesce(c.assinatura_expira_em, '-infinity'::timestamptz),
        case
          when lower(coalesce(c.assinatura_status, '')) = 'trialing'
            then coalesce(c.trial_ends_at, '-infinity'::timestamptz)
          else '-infinity'::timestamptz
        end
      ) > now()
      and (
        case lower(coalesce(c.assinatura_plano, c.plano, 'essencial'))
          when 'premium' then 3
          when 'profissional' then 2
          when 'intermediario' then 2
          when 'intermediário' then 2
          else 1
        end
      ) >= (
        case lower(coalesce(p_required_plan, 'essencial'))
          when 'premium' then 3
          when 'profissional' then 2
          when 'intermediate' then 2
          when 'intermediario' then 2
          when 'intermediário' then 2
          else 1
        end
      )
  );
$$;

revoke all on function public.orcaly_company_has_plan_access(uuid, text)
  from public, anon;
grant execute on function public.orcaly_company_has_plan_access(uuid, text)
  to authenticated, service_role;

-- Capacidade por cargo. A policy de posse da empresa continua sendo necessária;
-- esta função adiciona o limite funcional (financeiro, CRM, proposta, gestão).
create or replace function public.orcaly_current_user_can(
  p_company_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and (
          c.owner_id = (select auth.uid())
          or c.tester_id = (select auth.uid())
        )
    )
    or exists (
      select 1
      from public.company_members m
      where m.company_id = p_company_id
        and m.user_id = (select auth.uid())
        and lower(coalesce(m.status, '')) = 'ativo'
        and (
          case lower(coalesce(p_capability, ''))
            when 'finance' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin')
            when 'proposal' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente')
            when 'crm' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente')
            when 'manage' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin')
            when 'products' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'producao')
            when 'orders' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'atendente', 'producao')
            when 'production' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'gerente', 'admin', 'producao')
            when 'config' then
              lower(coalesce(m.cargo, '')) in ('dono', 'owner', 'admin')
            else false
          end
        )
    );
$$;

revoke all on function public.orcaly_current_user_can(uuid, text)
  from public, anon;
grant execute on function public.orcaly_current_user_can(uuid, text)
  to authenticated, service_role;

-- Tabelas que continuam acessadas diretamente pelo cliente recebem duas camadas:
-- uma policy permissiva de cargo/empresa e outra RESTRICTIVE de plano/assinatura.
do $$
declare
  item record;
  member_policy text;
  capability_policy text;
  plan_policy text;
begin
  for item in
    select *
    from (
      values
        ('products', 'essencial', 'products'),
        ('orders', 'essencial', 'orders'),
        ('financial_transactions', 'profissional', 'finance'),
        ('financial_material_entries', 'profissional', 'finance'),
        ('marketplace_coupons', 'profissional', 'manage'),
        ('proposals', 'premium', 'proposal'),
        ('proposal_events', 'premium', 'proposal')
    ) as feature_table(table_name, required_plan, capability)
  loop
    if to_regclass(format('public.%I', item.table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', item.table_name);

    member_policy := format('orcaly_feature_member_%s', item.table_name);
    capability_policy := format('orcaly_feature_capability_%s', item.table_name);
    plan_policy := format('orcaly_feature_plan_%s', item.table_name);

    execute format(
      'drop policy if exists %I on public.%I',
      member_policy,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      capability_policy,
      item.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      plan_policy,
      item.table_name
    );

    execute format(
      'create policy %I on public.%I as permissive for all to authenticated using (public.orcaly_current_user_can(company_id, %L)) with check (public.orcaly_current_user_can(company_id, %L))',
      member_policy,
      item.table_name,
      item.capability,
      item.capability
    );

    -- RESTRICTIVE impede que uma policy permissiva antiga/broad contorne o cargo.
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.orcaly_current_user_can(company_id, %L)) with check (public.orcaly_current_user_can(company_id, %L))',
      capability_policy,
      item.table_name,
      item.capability,
      item.capability
    );

    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.orcaly_company_has_plan_access(company_id, %L)) with check (public.orcaly_company_has_plan_access(company_id, %L))',
      plan_policy,
      item.table_name,
      item.required_plan,
      item.required_plan
    );
  end loop;
end;
$$;

-- Itens de pedido herdam empresa/plano/cargo através do pedido pai.
do $$
begin
  if to_regclass('public.order_items') is not null then
    alter table public.order_items enable row level security;

    drop policy if exists orcaly_order_items_member
      on public.order_items;
    drop policy if exists orcaly_order_items_capability
      on public.order_items;
    drop policy if exists orcaly_order_items_plan
      on public.order_items;

    create policy orcaly_order_items_member
      on public.order_items
      as permissive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      );

    create policy orcaly_order_items_capability
      on public.order_items
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_current_user_can(o.company_id, 'orders')
        )
      );

    create policy orcaly_order_items_plan
      on public.order_items
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_company_has_plan_access(o.company_id, 'essencial')
        )
      )
      with check (
        exists (
          select 1
          from public.orders o
          where o.id = order_items.order_id
            and public.orcaly_company_has_plan_access(o.company_id, 'essencial')
        )
      );
  end if;
end;
$$;

-- A empresa pode ser lida pelas policies existentes, mas configuração direta
-- só pode ser alterada pelo dono/admin e enquanto houver acesso ativo.
do $$
begin
  if to_regclass('public.companies') is not null then
    alter table public.companies enable row level security;

    drop policy if exists orcaly_company_update_member
      on public.companies;
    drop policy if exists orcaly_company_update_capability
      on public.companies;
    drop policy if exists orcaly_company_update_plan
      on public.companies;

    create policy orcaly_company_update_member
      on public.companies
      as permissive
      for update
      to authenticated
      using (public.orcaly_current_user_can(id, 'config'))
      with check (public.orcaly_current_user_can(id, 'config'));

    create policy orcaly_company_update_capability
      on public.companies
      as restrictive
      for update
      to authenticated
      using (public.orcaly_current_user_can(id, 'config'))
      with check (public.orcaly_current_user_can(id, 'config'));

    create policy orcaly_company_update_plan
      on public.companies
      as restrictive
      for update
      to authenticated
      using (public.orcaly_company_has_plan_access(id, 'essencial'))
      with check (public.orcaly_company_has_plan_access(id, 'essencial'));
  end if;
end;
$$;

-- Notas fiscais são Premium embora compartilhem financial_transactions.
do $$
begin
  if
    to_regclass('public.financial_transactions') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'origem'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'nota_numero'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financial_transactions'
        and column_name = 'documento_url'
    )
  then
    drop policy if exists orcaly_financial_notes_premium
      on public.financial_transactions;

    create policy orcaly_financial_notes_premium
      on public.financial_transactions
      as restrictive
      for all
      to authenticated
      using (
        (
          lower(coalesce(origem, '')) <> 'nota_fiscal'
          and coalesce(nota_numero, '') = ''
          and coalesce(documento_url, '') = ''
        )
        or public.orcaly_company_has_plan_access(company_id, 'premium')
      )
      with check (
        (
          lower(coalesce(origem, '')) <> 'nota_fiscal'
          and coalesce(nota_numero, '') = ''
          and coalesce(documento_url, '') = ''
        )
        or public.orcaly_company_has_plan_access(company_id, 'premium')
      );
  end if;
end;
$$;

-- CRM e dados financeiros autoritativos passam somente pelas APIs service-role.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_leads',
    'marketplace_payment_settings',
    'marketplace_payments',
    'marketplace_commissions',
    'marketplace_commission_rules',
    'marketplace_oauth_states',
    'payment_webhook_events',
    'plan_payments'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'revoke all privileges on table public.%I from authenticated',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Views de proposta passam a obedecer RLS das tabelas-base.
do $$
begin
  if to_regclass('public.proposals_dashboard') is not null then
    execute 'alter view public.proposals_dashboard set (security_invoker = true)';
  end if;
end;
$$;

commit;
