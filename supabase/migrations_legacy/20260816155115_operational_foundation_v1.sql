-- ORCALY_OPERATIONAL_FOUNDATION_V1
-- Additive foundation for controlled rollouts, operational events and future jobs.
-- All feature flags start disabled. No existing data is backfilled or changed.

begin;

create extension if not exists "pgcrypto";

create schema if not exists orcaly_private;
revoke all on schema orcaly_private from public, anon, authenticated;

create table if not exists public.feature_flags (
  key text primary key,
  description text not null,
  globally_enabled boolean not null default false,
  company_overrides_enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint feature_flags_key_format_check
    check (key ~ '^[a-z][a-z0-9_]{2,63}$')
);

create table if not exists public.company_feature_flags (
  company_id uuid not null references public.companies(id),
  feature_key text not null references public.feature_flags(key),
  enabled boolean not null,
  updated_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (company_id, feature_key)
);

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id text,
  visibility text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1,
  idempotency_key text,
  request_id text,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint operational_events_entity_type_check
    check (
      entity_type in (
        'order',
        'quote',
        'artwork',
        'customer',
        'payment',
        'service_order',
        'appointment',
        'delivery'
      )
    ),
  constraint operational_events_entity_id_check
    check (length(btrim(entity_id)) between 1 and 200),
  constraint operational_events_event_type_check
    check (
      length(event_type) between 3 and 120
      and event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
    ),
  constraint operational_events_actor_type_check
    check (actor_type in ('user', 'customer', 'system', 'integration')),
  constraint operational_events_actor_id_check
    check (actor_id is null or length(btrim(actor_id)) between 1 and 200),
  constraint operational_events_visibility_check
    check (visibility in ('internal', 'customer_visible', 'system')),
  constraint operational_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint operational_events_schema_version_check
    check (schema_version > 0),
  constraint operational_events_idempotency_key_check
    check (
      idempotency_key is null
      or length(btrim(idempotency_key)) between 8 and 200
    ),
  constraint operational_events_request_id_check
    check (request_id is null or length(btrim(request_id)) between 1 and 128),
  constraint operational_events_company_id_id_key unique (company_id, id),
  constraint operational_events_company_idempotency_key_key
    unique (company_id, idempotency_key)
);

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  operational_event_id uuid not null,
  action_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  scheduled_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint automation_jobs_event_company_fkey
    foreign key (company_id, operational_event_id)
    references public.operational_events(company_id, id),
  constraint automation_jobs_action_type_check
    check (
      length(action_type) between 3 and 120
      and action_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
    ),
  constraint automation_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  constraint automation_jobs_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint automation_jobs_idempotency_key_check
    check (length(btrim(idempotency_key)) between 8 and 200),
  constraint automation_jobs_attempts_check
    check (attempts >= 0 and max_attempts between 1 and 100),
  constraint automation_jobs_processed_at_check
    check (status <> 'completed' or processed_at is not null),
  constraint automation_jobs_company_idempotency_key_key
    unique (company_id, idempotency_key)
);

create index if not exists operational_events_entity_timeline_idx
  on public.operational_events (
    company_id,
    entity_type,
    entity_id,
    occurred_at desc,
    id desc
  );

create index if not exists operational_events_company_event_idx
  on public.operational_events (company_id, event_type, occurred_at desc);

create index if not exists operational_events_customer_timeline_idx
  on public.operational_events (
    company_id,
    entity_type,
    entity_id,
    occurred_at desc
  )
  where visibility = 'customer_visible';

create index if not exists automation_jobs_due_idx
  on public.automation_jobs (status, scheduled_at, id)
  where status in ('pending', 'failed');

create index if not exists automation_jobs_event_idx
  on public.automation_jobs (company_id, operational_event_id, created_at desc);

create or replace function orcaly_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function orcaly_private.prevent_operational_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    using
      errcode = '55000',
      message = 'operational_events is append-only; create a corrective event instead';
end;
$$;

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
before update on public.feature_flags
for each row execute function orcaly_private.touch_updated_at();

drop trigger if exists company_feature_flags_touch_updated_at
  on public.company_feature_flags;
create trigger company_feature_flags_touch_updated_at
before update on public.company_feature_flags
for each row execute function orcaly_private.touch_updated_at();

drop trigger if exists automation_jobs_touch_updated_at on public.automation_jobs;
create trigger automation_jobs_touch_updated_at
before update on public.automation_jobs
for each row execute function orcaly_private.touch_updated_at();

drop trigger if exists operational_events_append_only on public.operational_events;
create trigger operational_events_append_only
before update or delete on public.operational_events
for each row execute function orcaly_private.prevent_operational_event_mutation();

insert into public.feature_flags (
  key,
  description,
  globally_enabled,
  company_overrides_enabled
)
values
  ('customer_portal', 'Portal do cliente', false, true),
  ('graphic_workflow_v2', 'Fluxo avancado para graficas e personalizados', false, true),
  ('operational_events', 'Registro de eventos operacionais estruturados', false, true),
  ('stage_automations', 'Automacoes futuras orientadas por estagio', false, true),
  ('adaptive_panel', 'Painel adaptativo por segmento', false, true),
  ('smart_onboarding', 'Onboarding inteligente', false, true),
  ('operational_intelligence', 'Inteligencia operacional', false, true)
on conflict (key) do nothing;

alter table public.feature_flags enable row level security;
alter table public.company_feature_flags enable row level security;
alter table public.operational_events enable row level security;
alter table public.automation_jobs enable row level security;

drop policy if exists operational_events_select_company
  on public.operational_events;
create policy operational_events_select_company
on public.operational_events
for select
to authenticated
using (
  exists (
    select 1
    from public.companies as company
    where company.id = operational_events.company_id
      and (
        company.owner_id = (select auth.uid())
        or company.tester_id = (select auth.uid())
      )
  )
  or exists (
    select 1
    from public.company_members as member
    where member.company_id = operational_events.company_id
      and member.user_id = (select auth.uid())
      and member.status = 'ativo'
  )
);

revoke all privileges on table public.feature_flags
  from public, anon, authenticated;
revoke all privileges on table public.company_feature_flags
  from public, anon, authenticated;
revoke all privileges on table public.operational_events
  from public, anon, authenticated;
revoke all privileges on table public.automation_jobs
  from public, anon, authenticated;

grant select on table public.operational_events to authenticated;
grant select, insert, update, delete on table public.feature_flags to service_role;
grant select, insert, update, delete on table public.company_feature_flags to service_role;
grant select, insert on table public.operational_events to service_role;
grant select, insert, update, delete on table public.automation_jobs to service_role;

revoke all on function orcaly_private.touch_updated_at()
  from public, anon, authenticated;
revoke all on function orcaly_private.prevent_operational_event_mutation()
  from public, anon, authenticated;

commit;
