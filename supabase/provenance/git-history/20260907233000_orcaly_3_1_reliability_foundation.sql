-- Orçaly 3.1 reliability foundation
-- Server-managed tables. Existing provider webhook idempotency remains authoritative
-- and is mirrored into the common event ledger for unified observability.

create table if not exists public.event_idempotency (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  company_id uuid references public.companies(id) on delete cascade,
  event_type text,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received','processing','processed','ignored','failed','retrying','needs_attention')),
  attempt integer not null default 1 check (attempt >= 1),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  unique (provider, event_id)
);

create index if not exists event_idempotency_company_received_idx
  on public.event_idempotency (company_id, received_at desc);
create index if not exists event_idempotency_status_received_idx
  on public.event_idempotency (status, received_at desc);

create table if not exists public.transactional_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed','retrying','needs_attention')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists transactional_outbox_claim_idx
  on public.transactional_outbox (status, available_at, created_at)
  where status in ('queued','retrying');
create index if not exists transactional_outbox_company_created_idx
  on public.transactional_outbox (company_id, created_at desc);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','retrying','needs_attention')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists background_jobs_claim_idx
  on public.background_jobs (status, run_after, created_at)
  where status in ('queued','retrying');
create index if not exists background_jobs_company_created_idx
  on public.background_jobs (company_id, created_at desc);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_profile_id uuid,
  aggregate_type text not null,
  aggregate_id uuid,
  event_type text not null,
  title text not null,
  detail text,
  source text not null default 'system'
    check (source in ('manual','public_site','whatsapp','api','import','automation','ai','portal','system','provider')),
  source_id text,
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists timeline_events_company_occurred_idx
  on public.timeline_events (company_id, occurred_at desc);
create index if not exists timeline_events_aggregate_idx
  on public.timeline_events (company_id, aggregate_type, aggregate_id, occurred_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger_key text not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_company_enabled_idx
  on public.automation_rules (company_id, enabled, trigger_key);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  outbox_event_id uuid references public.transactional_outbox(id) on delete set null,
  run_key text not null,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','retrying','needs_attention','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (rule_id, run_key)
);

create index if not exists automation_runs_company_created_idx
  on public.automation_runs (company_id, created_at desc);
create index if not exists automation_runs_status_created_idx
  on public.automation_runs (status, created_at)
  where status in ('queued','retrying','needs_attention');

-- These tables are operated only through authenticated server routes / service role.
do $$
declare
  t text;
begin
  foreach t in array array[
    'event_idempotency',
    'transactional_outbox',
    'background_jobs',
    'timeline_events',
    'automation_rules',
    'automation_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

-- Mirror existing provider-specific idempotency ledgers into the shared ledger.
create or replace function public.orcaly_mirror_payment_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.event_idempotency (
    provider, event_id, company_id, event_type, payload_hash,
    received_at, processed_at, status, attempt, last_error,
    metadata
  ) values (
    new.provider,
    new.provider_event_id,
    new.company_id,
    new.event_type,
    new.payload_hash,
    coalesce(new.received_at, now()),
    new.processed_at,
    case
      when new.processing_status in ('processed','success','completed','done') then 'processed'
      when new.processing_status in ('failed','error') then 'failed'
      else 'received'
    end,
    greatest(coalesce(new.attempts, 1), 1),
    new.error_message,
    jsonb_build_object('provider_object_id', new.provider_object_id)
  )
  on conflict (provider, event_id) do update
    set company_id = coalesce(excluded.company_id, public.event_idempotency.company_id),
        event_type = excluded.event_type,
        payload_hash = coalesce(excluded.payload_hash, public.event_idempotency.payload_hash),
        processed_at = coalesce(excluded.processed_at, public.event_idempotency.processed_at),
        status = excluded.status,
        attempt = greatest(public.event_idempotency.attempt, excluded.attempt),
        last_error = excluded.last_error,
        metadata = public.event_idempotency.metadata || excluded.metadata;
  return new;
end;
$$;

create or replace function public.orcaly_mirror_whatsapp_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.event_idempotency (
    provider, event_id, company_id, event_type, payload_hash,
    received_at, processed_at, status, attempt, last_error
  ) values (
    'whatsapp',
    new.event_key,
    new.company_id,
    new.event_type,
    new.payload_hash,
    coalesce(new.received_at, now()),
    new.processed_at,
    case
      when new.processing_status = 'processed' then 'processed'
      when new.processing_status = 'ignored' then 'ignored'
      when new.processing_status = 'failed' then 'failed'
      else 'processing'
    end,
    1,
    new.error_message
  )
  on conflict (provider, event_id) do update
    set company_id = coalesce(excluded.company_id, public.event_idempotency.company_id),
        event_type = excluded.event_type,
        payload_hash = coalesce(excluded.payload_hash, public.event_idempotency.payload_hash),
        processed_at = coalesce(excluded.processed_at, public.event_idempotency.processed_at),
        status = excluded.status,
        last_error = excluded.last_error;
  return new;
end;
$$;

revoke all on function public.orcaly_mirror_payment_webhook_event() from public, anon, authenticated;
revoke all on function public.orcaly_mirror_whatsapp_webhook_event() from public, anon, authenticated;

drop trigger if exists trg_orcaly_mirror_payment_webhook_event on public.payment_webhook_events;
create trigger trg_orcaly_mirror_payment_webhook_event
after insert or update of processing_status, processed_at, error_message
on public.payment_webhook_events
for each row execute function public.orcaly_mirror_payment_webhook_event();

drop trigger if exists trg_orcaly_mirror_whatsapp_webhook_event on public.whatsapp_webhook_events;
create trigger trg_orcaly_mirror_whatsapp_webhook_event
after insert or update of processing_status, processed_at, error_message
on public.whatsapp_webhook_events
for each row execute function public.orcaly_mirror_whatsapp_webhook_event();

-- Atomically record internal events for critical business state changes.
create or replace function public.orcaly_record_business_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event_type text;
  v_title text;
  v_company_id uuid;
  v_source text;
  v_status text;
  v_old_status text;
begin
  v_company_id := new.company_id;
  if v_company_id is null then
    return new;
  end if;

  v_source := case
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('manual') then 'manual'
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('whatsapp') then 'whatsapp'
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('api') then 'api'
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('automation','automacao') then 'automation'
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('ai','ia') then 'ai'
    when lower(coalesce(to_jsonb(new)->>'source', to_jsonb(new)->>'origem', to_jsonb(new)->>'canal_origem', '')) in ('portal','customer_portal') then 'portal'
    else 'public_site'
  end;

  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      v_event_type := 'order.created';
      v_title := 'Pedido criado';
      insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload)
      values(v_company_id,v_event_type,'order',new.id,jsonb_build_object('order_id',new.id,'source',v_source));
      insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata)
      values(v_company_id,'order',new.id,v_event_type,v_title,v_source,jsonb_build_object('status',new.status));
    elsif tg_op = 'UPDATE' then
      v_status := lower(coalesce(new.status,''));
      v_old_status := lower(coalesce(old.status,''));
      if v_status is distinct from v_old_status then
        insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata)
        values(v_company_id,'order',new.id,'order.status_changed','Status do pedido alterado',v_source,
          jsonb_build_object('from',old.status,'to',new.status));
        if v_status in ('pronto','ready','pronto_para_entrega','pronto para entrega') then
          insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload)
          values(v_company_id,'order.ready','order',new.id,jsonb_build_object('order_id',new.id,'status',new.status));
        end if;
      end if;
      if lower(coalesce(new.payment_status,'')) is distinct from lower(coalesce(old.payment_status,''))
         and lower(coalesce(new.payment_status,'')) in ('paid','approved','pago','aprovado','authorized') then
        insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload)
        values(v_company_id,'payment.confirmed','order',new.id,jsonb_build_object('order_id',new.id,'payment_status',new.payment_status));
        insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata)
        values(v_company_id,'order',new.id,'payment.confirmed','Pagamento confirmado','provider',
          jsonb_build_object('payment_status',new.payment_status,'payment_provider',new.payment_provider));
      end if;
    end if;
  elsif tg_table_name = 'proposals' then
    if tg_op = 'INSERT' then
      insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata)
      values(v_company_id,'proposal',new.id,'proposal.created','Proposta criada',v_source,jsonb_build_object('status',new.status));
    elsif tg_op = 'UPDATE' then
      v_status := lower(coalesce(new.status,''));
      v_old_status := lower(coalesce(old.status,''));
      if v_status is distinct from v_old_status then
        insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata)
        values(v_company_id,'proposal',new.id,'proposal.status_changed','Status da proposta alterado',v_source,
          jsonb_build_object('from',old.status,'to',new.status));
        if v_status in ('approved','aprovado','aprovada') then
          insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload)
          values(v_company_id,'proposal.accepted','proposal',new.id,jsonb_build_object('proposal_id',new.id,'status',new.status));
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.orcaly_record_business_event() from public, anon, authenticated;

drop trigger if exists trg_orcaly_orders_business_event on public.orders;
create trigger trg_orcaly_orders_business_event
after insert or update of status, payment_status
on public.orders
for each row execute function public.orcaly_record_business_event();

drop trigger if exists trg_orcaly_proposals_business_event on public.proposals;
create trigger trg_orcaly_proposals_business_event
after insert or update of status
on public.proposals
for each row execute function public.orcaly_record_business_event();

-- Atomic worker claim. Service-role only.
create or replace function public.claim_background_jobs(p_worker text, p_limit integer default 10)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with picked as (
    select id
    from public.background_jobs
    where status in ('queued','retrying')
      and run_after <= now()
    order by run_after, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,10),50))
  )
  update public.background_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_at = now(),
         locked_by = left(coalesce(p_worker,'worker'),120),
         started_at = coalesce(j.started_at, now())
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;
