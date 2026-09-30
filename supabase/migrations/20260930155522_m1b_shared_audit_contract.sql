-- ORÇALY M1B — Shared Audit Contract
-- Frozen design: 5d5834bbc622002109bfb76ea26121d947b42b9a
-- Security review: f3113c8f50b620e8f76f484145c0d2f56fc6a696
-- One owning-domain migration. No semantic backfill.

create schema if not exists ecosystem_private;

-- STEP 0 — expected-shape preflight / canonical create path.
do $$
declare
  v_table regclass := to_regclass('public.ecosystem_audit_events');
  v_bad integer;
  v_actor_attnum smallint;
  v_actor_fk_count integer;
  v_actor_fk_delete "char";
begin
  if v_table is null then
    create table public.ecosystem_audit_events (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid,
      event_type text not null,
      entity_id text not null,
      recorded_at timestamptz not null default now()
    );
  else
    select count(*)
      into v_bad
    from (
      values
        ('id','uuid'),
        ('actor_id','uuid'),
        ('event_type','text'),
        ('entity_id','text'),
        ('recorded_at','timestamp with time zone')
    ) expected(column_name, data_type)
    left join information_schema.columns c
      on c.table_schema='public'
     and c.table_name='ecosystem_audit_events'
     and c.column_name=expected.column_name
     and c.data_type=expected.data_type
    where c.column_name is null;

    if v_bad <> 0 then
      raise exception 'M1B expected legacy ecosystem_audit_events shape mismatch';
    end if;

    if not exists (
      select 1
      from pg_constraint con
      where con.conrelid='public.ecosystem_audit_events'::regclass
        and con.contype='p'
        and con.conkey = array[
          (select attnum
           from pg_attribute
           where attrelid='public.ecosystem_audit_events'::regclass
             and attname='id'
             and not attisdropped)
        ]::smallint[]
    ) then
      raise exception 'M1B expected primary key on ecosystem_audit_events.id';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name='ecosystem_audit_events'
        and column_name in (
          'audit_contract_version','audit_kind','key_version','actor_kind','actor_key',
          'scope_kind','company_id','scope_user_id','subject_user_id','product_id',
          'resource_type','purpose_key','source','request_id','correlation_id','causation_id',
          'event_id','action_instance_id','result','risk_class','approval_required',
          'confirmation_required','assistance_mode','retention_class','row_table',
          'row_operation','changed_fields','before_snapshot','after_snapshot','metadata',
          'dedupe_key'
        )
    ) then
      raise exception 'M1B partial canonical columns already exist; refusing unknown state';
    end if;

    select attnum
      into v_actor_attnum
    from pg_attribute
    where attrelid='public.ecosystem_audit_events'::regclass
      and attname='actor_id'
      and not attisdropped;

    select count(*), min(con.confdeltype)
      into v_actor_fk_count, v_actor_fk_delete
    from pg_constraint con
    where con.conrelid='public.ecosystem_audit_events'::regclass
      and con.contype='f'
      and con.conkey = array[v_actor_attnum]::smallint[]
      and con.confrelid='auth.users'::regclass;

    if v_actor_fk_count <> 1 or v_actor_fk_delete <> 'n' then
      raise exception 'M1B expected actor_id -> auth.users ON DELETE SET NULL FK state';
    end if;
  end if;
end;
$$;

-- STEP 1 — additive canonical fields. Semantic defaults are intentionally absent.
alter table public.ecosystem_audit_events
  add column audit_contract_version smallint,
  add column audit_kind text,
  add column key_version smallint,
  add column actor_kind text,
  add column actor_key text,
  add column scope_kind text,
  add column company_id uuid,
  add column scope_user_id uuid,
  add column subject_user_id uuid,
  add column product_id text,
  add column resource_type text,
  add column purpose_key text,
  add column source text,
  add column request_id text,
  add column correlation_id uuid,
  add column causation_id uuid,
  add column event_id uuid,
  add column action_instance_id uuid,
  add column result text,
  add column risk_class text,
  add column approval_required boolean,
  add column confirmation_required boolean,
  add column assistance_mode text,
  add column retention_class text,
  add column row_table text,
  add column row_operation text,
  add column changed_fields text[],
  add column before_snapshot jsonb,
  add column after_snapshot jsonb,
  add column metadata jsonb,
  add column dedupe_key text;

-- STEP 2 — historical identity is evidence, not entity ownership.
do $$
declare
  v_constraint text;
begin
  select con.conname
    into v_constraint
  from pg_constraint con
  join pg_attribute a
    on a.attrelid=con.conrelid
   and a.attnum=any(con.conkey)
  where con.conrelid='public.ecosystem_audit_events'::regclass
    and con.contype='f'
    and a.attname='actor_id'
    and con.confrelid='auth.users'::regclass
  limit 1;

  if v_constraint is not null then
    execute format(
      'alter table public.ecosystem_audit_events drop constraint %I',
      v_constraint
    );
  end if;
end;
$$;

-- STEP 3 — strict v1 structural checks with legacy NULL compatibility.
alter table public.ecosystem_audit_events
  add constraint ecosystem_audit_v1_version_shape_check
  check (
    audit_contract_version is null
    or audit_contract_version = 1
  ) not valid,

  add constraint ecosystem_audit_v1_common_check
  check (
    audit_contract_version is null
    or (
      audit_kind in ('ROW_CHANGE','ACTION')
      and key_version is not null
      and key_version >= 1
      and char_length(event_type) between 1 and 160
      and event_type ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
      and resource_type is not null
      and char_length(resource_type) between 1 and 96
      and resource_type ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
      and char_length(entity_id) between 1 and 256
      and actor_kind in ('USER','SERVICE','SYSTEM','AUTOMATION','AI')
      and scope_kind in ('COMPANY','PERSONAL','PLATFORM')
      and source is not null
      and char_length(source) between 1 and 96
      and source ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
      and (
        product_id is null
        or (
          char_length(product_id) between 1 and 64
          and product_id ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
        )
      )
      and (
        purpose_key is null
        or (
          char_length(purpose_key) between 1 and 128
          and purpose_key ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
        )
      )
      and (
        actor_key is null
        or (
          char_length(actor_key) between 1 and 128
          and actor_key ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$'
        )
      )
      and (
        request_id is null
        or (
          char_length(request_id) between 1 and 128
          and request_id !~ '[[:cntrl:]]'
        )
      )
      and retention_class in (
        'OPERATIONAL_HISTORY',
        'AUDIT_STANDARD',
        'AUDIT_EXTENDED',
        'AGGREGATED_ARCHIVE'
      )
      and (
        metadata is null
        or octet_length(metadata::text) <= 8192
      )
      and (
        coalesce(octet_length(before_snapshot::text),0)
        + coalesce(octet_length(after_snapshot::text),0)
        <= 16384
      )
      and (
        risk_class is null
        or (
          char_length(risk_class) between 1 and 32
          and risk_class !~ '[[:cntrl:]]'
        )
      )
    )
  ) not valid,

  add constraint ecosystem_audit_v1_actor_check
  check (
    audit_contract_version is null
    or (
      (actor_kind='USER' and actor_id is not null and actor_key is null)
      or
      (actor_kind in ('SERVICE','SYSTEM','AUTOMATION','AI')
       and actor_id is null
       and actor_key is not null)
    )
  ) not valid,

  add constraint ecosystem_audit_v1_scope_check
  check (
    audit_contract_version is null
    or (
      (scope_kind='COMPANY' and company_id is not null and scope_user_id is null)
      or
      (scope_kind='PERSONAL' and company_id is null and scope_user_id is not null)
      or
      (scope_kind='PLATFORM' and company_id is null and scope_user_id is null)
    )
  ) not valid,

  add constraint ecosystem_audit_v1_action_check
  check (
    audit_contract_version is null
    or audit_kind <> 'ACTION'
    or (
      action_instance_id is not null
      and result in (
        'ATTEMPTED',
        'REJECTED',
        'AUTHORIZED',
        'EXECUTED',
        'FAILED',
        'COMPLETED',
        'SKIPPED'
      )
      and dedupe_key is not null
      and char_length(dedupe_key) = 67
      and dedupe_key ~ '^a1:[0-9a-f]{64}$'
      and row_table is null
      and row_operation is null
      and changed_fields is null
      and before_snapshot is null
      and after_snapshot is null
      and (
        assistance_mode is null
        or assistance_mode in (
          'NONE',
          'AI_RECOMMENDATION',
          'AI_DRAFT',
          'AI_HUMAN_CONFIRMED'
        )
      )
    )
  ) not valid,

  add constraint ecosystem_audit_v1_row_change_check
  check (
    audit_contract_version is null
    or audit_kind <> 'ROW_CHANGE'
    or (
      row_table is not null
      and char_length(row_table) between 1 and 128
      and row_table ~ '^[a-z0-9][a-z0-9_-]*\.[a-z0-9][a-z0-9_-]*$'
      and row_operation in ('INSERT','UPDATE','DELETE')
      and action_instance_id is null
      and result is null
      and dedupe_key is null
      and risk_class is null
      and approval_required is null
      and confirmation_required is null
      and assistance_mode is null
    )
  ) not valid;

-- STEP 4 — canonical ROW_CHANGE trigger writer.
create or replace function ecosystem_private.record_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_before jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  v_after jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_event_type text := tg_table_name || '.' || lower(tg_op);
  v_entity_id text;
  v_resource_type text;
  v_product_id text;
  v_scope_kind text;
  v_company_id uuid;
  v_scope_user_id uuid;
  v_retention_class text := 'AUDIT_STANDARD';
  v_actor_id uuid := auth.uid();
  v_actor_kind text;
  v_actor_key text;
  v_safe_fields text[] := '{}'::text[];
  v_changed_fields text[] := '{}'::text[];
  v_field text;
begin
  if v_actor_id is not null then
    v_actor_kind := 'USER';
    v_actor_key := null;
  else
    v_actor_kind := 'SYSTEM';
    v_actor_key := 'system.database_trigger';
  end if;

  case tg_table_schema || '.' || tg_table_name
    when 'ecosystem_private.wealth_alert_commands' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.alert_command';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['operation'];

    when 'ecosystem_private.wealth_alert_preferences' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.alert_preferences';
      v_entity_id := v_row->>'user_id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['enabled','minimum_priority','cooldown_hours','version'];

    when 'ecosystem_private.wealth_alert_state' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.alert_state';
      v_entity_id := v_row->>'alert_key';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['dismissed_at','snoozed_until','last_notified_at'];

    when 'ecosystem_private.wealth_automation_commands' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.automation_command';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['operation'];

    when 'ecosystem_private.wealth_automation_preferences' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.automation_preferences';
      v_entity_id := v_row->>'user_id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['history_days','show_inactive','version'];

    when 'ecosystem_private.wealth_family_connections' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.family_connection';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'owner_id')::uuid;
      v_safe_fields := array['state','version','accepted_at','revoked_at'];

    when 'ecosystem_private.wealth_family_shares' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.family_share';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'owner_id')::uuid;
      v_safe_fields := array['scope','state','version','accepted_at','revoked_at'];

    when 'public.ecosystem_context_consents' then
      v_product_id := null;
      v_resource_type := 'ecosystem.context_consent';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_retention_class := 'AUDIT_EXTENDED';
      v_safe_fields := array['data_scope','purpose','expires_at','revoked_at'];

    when 'public.ecosystem_product_entitlements' then
      v_product_id := v_row->>'product_id';
      v_resource_type := 'ecosystem.product_entitlement';
      v_entity_id := v_row->>'id';
      if v_row->>'company_id' is not null then
        v_scope_kind := 'COMPANY';
        v_company_id := (v_row->>'company_id')::uuid;
      else
        v_scope_kind := 'PERSONAL';
        v_scope_user_id := (v_row->>'user_id')::uuid;
      end if;
      v_retention_class := 'AUDIT_EXTENDED';
      v_safe_fields := array['status','expires_at','permissions','source'];

    when 'public.wealth_bill_details' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.bill_detail';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['bill_type','reviewed_at','version'];

    when 'public.wealth_debt_terms' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.debt_term';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := auth.uid();
      if v_scope_user_id is null then
        select e.user_id
          into v_scope_user_id
        from public.wealth_entries e
        where e.id=(v_row->>'id')::uuid;
      end if;
      if v_scope_user_id is null then
        raise exception 'M1B cannot derive PERSONAL scope for wealth_debt_terms';
      end if;
      v_safe_fields := array[
        'installment_count',
        'remaining_installments',
        'next_due_date',
        'priority'
      ];

    when 'public.wealth_documents' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.document';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['status','archived_at','version'];

    when 'public.wealth_entries' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.entry';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['status','archived_at','version'];
      if tg_op='UPDATE' then
        if (v_before->>'archived_at') is null and (v_after->>'archived_at') is not null then
          v_event_type := 'wealth.entry.archived';
        elsif (v_before->>'archived_at') is not null and (v_after->>'archived_at') is null then
          v_event_type := 'wealth.entry.restored';
        end if;
      end if;

    when 'public.wealth_goal_funding' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.goal_funding';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['version'];

    when 'public.wealth_goals' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.goal';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['status','archived_at','version'];
      if tg_op='UPDATE' then
        if (v_before->>'archived_at') is null and (v_after->>'archived_at') is not null then
          v_event_type := 'wealth.goal.archived';
        elsif (v_before->>'archived_at') is not null and (v_after->>'archived_at') is null then
          v_event_type := 'wealth.goal.restored';
        elsif v_before->>'status' is distinct from 'completed'
          and v_after->>'status'='completed' then
          v_event_type := 'wealth.goal.completed';
        end if;
      end if;

    when 'public.wealth_holdings' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.holding';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['status','archived_at','version'];

    when 'public.wealth_life_plans' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.life_plan';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['status','scenario','version'];

    when 'public.wealth_net_worth_snapshots' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.net_worth_snapshot';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['source'];

    when 'public.wealth_portfolio_transactions' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.portfolio_transaction';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['type','financial_date'];

    when 'public.wealth_portfolios' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.portfolio';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['kind','version'];

    when 'public.wealth_profiles' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.profile';
      v_entity_id := v_row->>'user_id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['dependents','emergency_months','currency','timezone'];

    when 'public.wealth_protection_policies' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.protection_policy';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['category','premium_period','status','archived_at','version'];

    when 'public.wealth_recurring_schedules' then
      v_product_id := 'wealth';
      v_resource_type := 'wealth.recurring_schedule';
      v_entity_id := v_row->>'id';
      v_scope_kind := 'PERSONAL';
      v_scope_user_id := (v_row->>'user_id')::uuid;
      v_safe_fields := array['frequency','status','pause_reason','next_date','version'];

    else
      raise exception 'M1B unreviewed ROW_CHANGE relation: %.%', tg_table_schema, tg_table_name;
  end case;

  if v_entity_id is null or char_length(v_entity_id)=0 then
    raise exception 'M1B ROW_CHANGE resource identity missing for %.%', tg_table_schema, tg_table_name;
  end if;

  if tg_op='UPDATE' and cardinality(v_safe_fields)>0 then
    foreach v_field in array v_safe_fields loop
      if v_before->v_field is distinct from v_after->v_field then
        v_changed_fields := array_append(v_changed_fields, v_field);
      end if;
    end loop;
  end if;

  insert into public.ecosystem_audit_events (
    actor_id,
    event_type,
    entity_id,
    audit_contract_version,
    audit_kind,
    key_version,
    actor_kind,
    actor_key,
    scope_kind,
    company_id,
    scope_user_id,
    subject_user_id,
    product_id,
    resource_type,
    purpose_key,
    source,
    request_id,
    correlation_id,
    causation_id,
    event_id,
    action_instance_id,
    result,
    risk_class,
    approval_required,
    confirmation_required,
    assistance_mode,
    retention_class,
    row_table,
    row_operation,
    changed_fields,
    before_snapshot,
    after_snapshot,
    metadata,
    dedupe_key
  )
  values (
    v_actor_id,
    v_event_type,
    v_entity_id,
    1,
    'ROW_CHANGE',
    1,
    v_actor_kind,
    v_actor_key,
    v_scope_kind,
    v_company_id,
    v_scope_user_id,
    null,
    v_product_id,
    v_resource_type,
    'shared_audit.row_change',
    'database_trigger',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    v_retention_class,
    tg_table_schema || '.' || tg_table_name,
    tg_op,
    v_changed_fields,
    null,
    null,
    '{}'::jsonb,
    null
  );

  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function ecosystem_private.record_change() from public;
revoke all on function ecosystem_private.record_change() from anon;
revoke all on function ecosystem_private.record_change() from authenticated;
revoke all on function ecosystem_private.record_change() from service_role;

-- STEP 5 — new-row contract-version enforcement.
create or replace function ecosystem_private.enforce_shared_audit_insert_contract()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_field text;
begin
  if new.audit_contract_version is null then
    raise exception using
      errcode='23514',
      message='M1B audit_contract_version is required for every new audit row';
  end if;

  if new.audit_contract_version <> 1 then
    raise exception using
      errcode='23514',
      message='M1B unsupported audit_contract_version';
  end if;

  if new.changed_fields is not null then
    foreach v_field in array new.changed_fields loop
      if v_field is null
         or char_length(v_field)<1
         or char_length(v_field)>96
         or v_field ~ '[[:cntrl:]]' then
        raise exception using
          errcode='23514',
          message='M1B changed_fields item violates canonical bounds';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function ecosystem_private.enforce_shared_audit_insert_contract() from public;
revoke all on function ecosystem_private.enforce_shared_audit_insert_contract() from anon;
revoke all on function ecosystem_private.enforce_shared_audit_insert_contract() from authenticated;
revoke all on function ecosystem_private.enforce_shared_audit_insert_contract() from service_role;

create trigger ecosystem_audit_events_insert_contract_guard
before insert on public.ecosystem_audit_events
for each row
execute function ecosystem_private.enforce_shared_audit_insert_contract();

-- STEP 6 — access-pattern and ACTION dedupe indexes.
create index ecosystem_audit_company_date
  on public.ecosystem_audit_events(company_id, recorded_at desc)
  where company_id is not null;

create index ecosystem_audit_personal_date
  on public.ecosystem_audit_events(scope_user_id, recorded_at desc)
  where scope_user_id is not null;

create index ecosystem_audit_product_action_date
  on public.ecosystem_audit_events(product_id, event_type, recorded_at desc)
  where product_id is not null;

create index ecosystem_audit_resource_date
  on public.ecosystem_audit_events(resource_type, entity_id, recorded_at desc)
  where resource_type is not null;

create index ecosystem_audit_correlation_date
  on public.ecosystem_audit_events(correlation_id, recorded_at desc)
  where correlation_id is not null;

create index ecosystem_audit_kind_date
  on public.ecosystem_audit_events(audit_kind, recorded_at desc)
  where audit_kind is not null;

create unique index uq_ecosystem_audit_action_company_dedupe
  on public.ecosystem_audit_events(company_id, source, audit_kind, dedupe_key)
  where audit_contract_version=1
    and audit_kind='ACTION'
    and scope_kind='COMPANY'
    and company_id is not null
    and scope_user_id is null
    and dedupe_key is not null;

create unique index uq_ecosystem_audit_action_personal_dedupe
  on public.ecosystem_audit_events(scope_user_id, source, audit_kind, dedupe_key)
  where audit_contract_version=1
    and audit_kind='ACTION'
    and scope_kind='PERSONAL'
    and scope_user_id is not null
    and company_id is null
    and dedupe_key is not null;

create unique index uq_ecosystem_audit_action_platform_dedupe
  on public.ecosystem_audit_events(source, audit_kind, dedupe_key)
  where audit_contract_version=1
    and audit_kind='ACTION'
    and scope_kind='PLATFORM'
    and company_id is null
    and scope_user_id is null
    and dedupe_key is not null;

-- STEP 7 — RLS and final normal application grants.
alter table public.ecosystem_audit_events enable row level security;

revoke all on table public.ecosystem_audit_events from public;
revoke all on table public.ecosystem_audit_events from anon;
revoke all on table public.ecosystem_audit_events from authenticated;
revoke all on table public.ecosystem_audit_events from service_role;

grant select, insert on table public.ecosystem_audit_events to service_role;

-- STEP 8 — validate final structural contract.
alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_version_shape_check;

alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_common_check;

alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_actor_check;

alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_scope_check;

alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_action_check;

alter table public.ecosystem_audit_events
  validate constraint ecosystem_audit_v1_row_change_check;
