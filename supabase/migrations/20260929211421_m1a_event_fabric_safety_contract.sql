-- ORCALY M1A — Event Fabric Safety & Contract Hardening
-- Frozen design: 34e7b8182eb077f1471d8c31f8169bd3227451e3
-- Scope: additive shared Event Fabric contract only.

alter table public.transactional_outbox
  add column user_id uuid,
  add column producer text not null default 'business',
  add column event_version smallint not null default 1,
  add column correlation_id uuid not null default gen_random_uuid(),
  add column causation_id uuid,
  add column dedupe_key text;

alter table public.transactional_outbox
  add constraint transactional_outbox_scope_check
    check (num_nonnulls(company_id, user_id) <= 1),
  add constraint transactional_outbox_producer_check
    check (
      char_length(producer) between 1 and 80
      and producer ~ '^[a-z][a-z0-9_.-]{0,79}$'
    ),
  add constraint transactional_outbox_event_version_check
    check (event_version between 1 and 32767),
  add constraint transactional_outbox_dedupe_key_check
    check (
      dedupe_key is null
      or char_length(dedupe_key) between 1 and 240
    ),
  add constraint transactional_outbox_payload_bytes_check
    check (octet_length(payload::text) <= 32768);

create unique index uq_transactional_outbox_dedupe_company
  on public.transactional_outbox(company_id, producer, event_type, dedupe_key)
  where dedupe_key is not null
    and company_id is not null
    and user_id is null;

create unique index uq_transactional_outbox_dedupe_personal
  on public.transactional_outbox(user_id, producer, event_type, dedupe_key)
  where dedupe_key is not null
    and user_id is not null
    and company_id is null;

create unique index uq_transactional_outbox_dedupe_platform
  on public.transactional_outbox(producer, event_type, dedupe_key)
  where dedupe_key is not null
    and company_id is null
    and user_id is null;

alter table public.background_jobs
  add column user_id uuid,
  add column outbox_event_id uuid references public.transactional_outbox(id) on delete restrict,
  add column dedupe_key text,
  add column correlation_id uuid,
  add column job_version smallint not null default 1;

alter table public.background_jobs
  add constraint background_jobs_scope_check
    check (num_nonnulls(company_id, user_id) <= 1),
  add constraint background_jobs_job_version_check
    check (job_version between 1 and 32767),
  add constraint background_jobs_dedupe_key_check
    check (
      dedupe_key is null
      or char_length(dedupe_key) between 1 and 240
    ),
  add constraint background_jobs_event_fabric_invariant_check
    check (
      outbox_event_id is null
      or (
        dedupe_key is not null
        and correlation_id is not null
        and octet_length(payload::text) <= 8192
      )
    );

create unique index uq_background_jobs_dedupe_company
  on public.background_jobs(company_id, job_type, dedupe_key)
  where dedupe_key is not null
    and company_id is not null
    and user_id is null;

create unique index uq_background_jobs_dedupe_personal
  on public.background_jobs(user_id, job_type, dedupe_key)
  where dedupe_key is not null
    and user_id is not null
    and company_id is null;

create unique index uq_background_jobs_dedupe_platform
  on public.background_jobs(job_type, dedupe_key)
  where dedupe_key is not null
    and company_id is null
    and user_id is null;

create index idx_background_jobs_outbox_event_id
  on public.background_jobs(outbox_event_id)
  where outbox_event_id is not null;

create index idx_background_jobs_event_fabric_claim
  on public.background_jobs(status, run_after, created_at)
  where outbox_event_id is not null
    and status in ('queued', 'retrying');

create or replace function public.claim_background_jobs(
  p_worker text,
  p_limit integer default 10
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_worker text := left(btrim(coalesce(p_worker, '')), 120);
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if v_worker = '' then
    raise exception 'worker id is required';
  end if;

  return query
  with picked as (
    select j.id
    from public.background_jobs j
    where j.outbox_event_id is null
      and j.status in ('queued', 'retrying')
      and j.run_after <= now()
    order by j.run_after, j.created_at
    for update skip locked
    limit v_limit
  )
  update public.background_jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_at = now(),
      locked_by = v_worker,
      started_at = coalesce(j.started_at, now())
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

create or replace function public.claim_event_fabric_jobs(
  p_worker text,
  p_limit integer default 10
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_worker text := left(btrim(coalesce(p_worker, '')), 120);
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if v_worker = '' then
    raise exception 'worker id is required';
  end if;

  return query
  with picked as (
    select j.id
    from public.background_jobs j
    where j.outbox_event_id is not null
      and j.status in ('queued', 'retrying')
      and j.run_after <= now()
    order by j.run_after, j.created_at
    for update skip locked
    limit v_limit
  )
  update public.background_jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_at = now(),
      locked_by = v_worker,
      started_at = coalesce(j.started_at, now())
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

create or replace function public.orcaly_dispatch_outbox_event(
  p_outbox_event_id uuid,
  p_expected_producer text,
  p_expected_event_type text,
  p_expected_event_version smallint,
  p_jobs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_job jsonb;
  v_job_type text;
  v_job_version smallint;
  v_max_attempts integer;
  v_dedupe_key text;
  v_expected_count integer := 0;
  v_existing_count integer := 0;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  if jsonb_typeof(p_jobs) <> 'array'
     or jsonb_array_length(p_jobs) < 1
     or jsonb_array_length(p_jobs) > 20 then
    raise exception 'jobs must be a non-empty array with at most 20 entries';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_jobs) as item
    where jsonb_typeof(item) <> 'object'
       or item - array['job_type','job_version','max_attempts']::text[] <> '{}'::jsonb
       or coalesce(item->>'job_type','') !~ '^[a-z][a-z0-9_-]{0,39}\.[a-z][a-z0-9_.-]{0,79}$'
       or not (
         coalesce(item->>'job_version','') ~ '^[0-9]+
  ) then
    raise exception 'invalid event fabric job specification';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_jobs)
  ) <> (
    select count(distinct ((item->>'job_type') || ':' || (item->>'job_version')))
    from jsonb_array_elements(p_jobs) as item
  ) then
    raise exception 'duplicate event fabric job specification';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    raise exception 'outbox event not found';
  end if;

  if v_event.producer <> p_expected_producer
     or v_event.event_type <> p_expected_event_type
     or v_event.event_version <> p_expected_event_version then
    raise exception 'outbox event contract mismatch';
  end if;

  if num_nonnulls(v_event.company_id, v_event.user_id) > 1 then
    raise exception 'outbox event scope is invalid';
  end if;

  if v_event.status = 'completed' then
    for v_job in select value from jsonb_array_elements(p_jobs)
    loop
      v_job_type := v_job->>'job_type';
      v_job_version := (v_job->>'job_version')::smallint;
      v_dedupe_key := format(
        'outbox:%s:handler:%s:v%s',
        v_event.id,
        v_job_type,
        v_job_version
      );

      if not exists (
        select 1
        from public.background_jobs j
        where j.outbox_event_id = v_event.id
          and j.job_type = v_job_type
          and j.job_version = v_job_version
          and j.dedupe_key = v_dedupe_key
          and j.correlation_id = v_event.correlation_id
          and j.company_id is not distinct from v_event.company_id
          and j.user_id is not distinct from v_event.user_id
      ) then
        raise exception 'completed outbox event is missing expected job';
      end if;
    end loop;

    return jsonb_build_object(
      'status', 'completed',
      'already_dispatched', true,
      'outbox_event_id', v_event.id
    );
  end if;

  if v_event.status not in ('queued', 'retrying') then
    raise exception 'outbox event is not dispatchable from status %', v_event.status;
  end if;

  if v_event.attempts >= v_event.max_attempts then
    update public.transactional_outbox
    set status = 'needs_attention',
        last_error = 'outbox_dispatch_attempts_exhausted'
    where id = v_event.id;

    return jsonb_build_object(
      'status', 'needs_attention',
      'outbox_event_id', v_event.id,
      'reason', 'attempts_exhausted'
    );
  end if;

  update public.transactional_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null
  where id = v_event.id;

  for v_job in select value from jsonb_array_elements(p_jobs)
  loop
    v_job_type := v_job->>'job_type';
    v_job_version := (v_job->>'job_version')::smallint;
    v_max_attempts := (v_job->>'max_attempts')::integer;
    v_dedupe_key := format(
      'outbox:%s:handler:%s:v%s',
      v_event.id,
      v_job_type,
      v_job_version
    );

    insert into public.background_jobs (
      company_id,
      user_id,
      job_type,
      payload,
      status,
      attempts,
      max_attempts,
      run_after,
      metadata,
      outbox_event_id,
      dedupe_key,
      correlation_id,
      job_version
    )
    values (
      v_event.company_id,
      v_event.user_id,
      v_job_type,
      jsonb_build_object('outbox_event_id', v_event.id),
      'queued',
      0,
      v_max_attempts,
      now(),
      jsonb_build_object(
        'event_fabric', true,
        'producer', v_event.producer,
        'event_type', v_event.event_type,
        'event_version', v_event.event_version
      ),
      v_event.id,
      v_dedupe_key,
      v_event.correlation_id,
      v_job_version
    )
    on conflict do nothing;

    select count(*)
    into v_existing_count
    from public.background_jobs j
    where j.outbox_event_id = v_event.id
      and j.job_type = v_job_type
      and j.job_version = v_job_version
      and j.dedupe_key = v_dedupe_key
      and j.correlation_id = v_event.correlation_id
      and j.company_id is not distinct from v_event.company_id
      and j.user_id is not distinct from v_event.user_id;

    if v_existing_count <> 1 then
      raise exception 'event fabric job could not be ensured';
    end if;

    v_expected_count := v_expected_count + 1;
  end loop;

  update public.transactional_outbox
  set status = 'completed',
      processed_at = now(),
      last_error = null
  where id = v_event.id;

  return jsonb_build_object(
    'status', 'completed',
    'already_dispatched', false,
    'outbox_event_id', v_event.id,
    'jobs_ensured', v_expected_count
  );
end;
$$;

create or replace function public.orcaly_settle_outbox_failure(
  p_outbox_event_id uuid,
  p_retryable boolean,
  p_run_after timestamptz default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_attempts integer;
  v_next_run timestamptz;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    return false;
  end if;

  if v_event.status = 'completed' then
    return false;
  end if;

  if v_event.status not in ('queued', 'processing', 'retrying') then
    return false;
  end if;

  v_attempts := v_event.attempts + 1;
  v_next_run := greatest(
    now() + interval '1 second',
    least(
      coalesce(p_run_after, now() + interval '1 minute'),
      now() + interval '15 minutes'
    )
  );

  update public.transactional_outbox
  set attempts = v_attempts,
      status = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then 'retrying'
        else 'needs_attention'
      end,
      available_at = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then v_next_run
        else available_at
      end,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'outbox_dispatch_failed'),
        2000
      )
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public;
revoke all on function public.claim_background_jobs(text, integer) from anon;
revoke all on function public.claim_background_jobs(text, integer) from authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

revoke all on function public.claim_event_fabric_jobs(text, integer) from public;
revoke all on function public.claim_event_fabric_jobs(text, integer) from anon;
revoke all on function public.claim_event_fabric_jobs(text, integer) from authenticated;
grant execute on function public.claim_event_fabric_jobs(text, integer) to service_role;

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;

revoke delete on table public.transactional_outbox from service_role;
revoke truncate on table public.transactional_outbox from service_role;

alter table public.transactional_outbox enable row level security;
alter table public.background_jobs enable row level security;
alter table public.event_idempotency enable row level security;

         and case
           when coalesce(item->>'job_version','') ~ '^[0-9]+
  ) then
    raise exception 'invalid event fabric job specification';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_jobs)
  ) <> (
    select count(distinct ((item->>'job_type') || ':' || (item->>'job_version')))
    from jsonb_array_elements(p_jobs) as item
  ) then
    raise exception 'duplicate event fabric job specification';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    raise exception 'outbox event not found';
  end if;

  if v_event.producer <> p_expected_producer
     or v_event.event_type <> p_expected_event_type
     or v_event.event_version <> p_expected_event_version then
    raise exception 'outbox event contract mismatch';
  end if;

  if num_nonnulls(v_event.company_id, v_event.user_id) > 1 then
    raise exception 'outbox event scope is invalid';
  end if;

  if v_event.status = 'completed' then
    for v_job in select value from jsonb_array_elements(p_jobs)
    loop
      v_job_type := v_job->>'job_type';
      v_job_version := (v_job->>'job_version')::smallint;
      v_dedupe_key := format(
        'outbox:%s:handler:%s:v%s',
        v_event.id,
        v_job_type,
        v_job_version
      );

      if not exists (
        select 1
        from public.background_jobs j
        where j.outbox_event_id = v_event.id
          and j.job_type = v_job_type
          and j.job_version = v_job_version
          and j.dedupe_key = v_dedupe_key
          and j.correlation_id = v_event.correlation_id
          and j.company_id is not distinct from v_event.company_id
          and j.user_id is not distinct from v_event.user_id
      ) then
        raise exception 'completed outbox event is missing expected job';
      end if;
    end loop;

    return jsonb_build_object(
      'status', 'completed',
      'already_dispatched', true,
      'outbox_event_id', v_event.id
    );
  end if;

  if v_event.status not in ('queued', 'retrying') then
    raise exception 'outbox event is not dispatchable from status %', v_event.status;
  end if;

  if v_event.attempts >= v_event.max_attempts then
    update public.transactional_outbox
    set status = 'needs_attention',
        last_error = 'outbox_dispatch_attempts_exhausted'
    where id = v_event.id;

    return jsonb_build_object(
      'status', 'needs_attention',
      'outbox_event_id', v_event.id,
      'reason', 'attempts_exhausted'
    );
  end if;

  update public.transactional_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null
  where id = v_event.id;

  for v_job in select value from jsonb_array_elements(p_jobs)
  loop
    v_job_type := v_job->>'job_type';
    v_job_version := (v_job->>'job_version')::smallint;
    v_max_attempts := (v_job->>'max_attempts')::integer;
    v_dedupe_key := format(
      'outbox:%s:handler:%s:v%s',
      v_event.id,
      v_job_type,
      v_job_version
    );

    insert into public.background_jobs (
      company_id,
      user_id,
      job_type,
      payload,
      status,
      attempts,
      max_attempts,
      run_after,
      metadata,
      outbox_event_id,
      dedupe_key,
      correlation_id,
      job_version
    )
    values (
      v_event.company_id,
      v_event.user_id,
      v_job_type,
      jsonb_build_object('outbox_event_id', v_event.id),
      'queued',
      0,
      v_max_attempts,
      now(),
      jsonb_build_object(
        'event_fabric', true,
        'producer', v_event.producer,
        'event_type', v_event.event_type,
        'event_version', v_event.event_version
      ),
      v_event.id,
      v_dedupe_key,
      v_event.correlation_id,
      v_job_version
    )
    on conflict do nothing;

    select count(*)
    into v_existing_count
    from public.background_jobs j
    where j.outbox_event_id = v_event.id
      and j.job_type = v_job_type
      and j.job_version = v_job_version
      and j.dedupe_key = v_dedupe_key
      and j.correlation_id = v_event.correlation_id
      and j.company_id is not distinct from v_event.company_id
      and j.user_id is not distinct from v_event.user_id;

    if v_existing_count <> 1 then
      raise exception 'event fabric job could not be ensured';
    end if;

    v_expected_count := v_expected_count + 1;
  end loop;

  update public.transactional_outbox
  set status = 'completed',
      processed_at = now(),
      last_error = null
  where id = v_event.id;

  return jsonb_build_object(
    'status', 'completed',
    'already_dispatched', false,
    'outbox_event_id', v_event.id,
    'jobs_ensured', v_expected_count
  );
end;
$$;

create or replace function public.orcaly_settle_outbox_failure(
  p_outbox_event_id uuid,
  p_retryable boolean,
  p_run_after timestamptz default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_attempts integer;
  v_next_run timestamptz;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    return false;
  end if;

  if v_event.status = 'completed' then
    return false;
  end if;

  if v_event.status not in ('queued', 'processing', 'retrying') then
    return false;
  end if;

  v_attempts := v_event.attempts + 1;
  v_next_run := greatest(
    now() + interval '1 second',
    least(
      coalesce(p_run_after, now() + interval '1 minute'),
      now() + interval '15 minutes'
    )
  );

  update public.transactional_outbox
  set attempts = v_attempts,
      status = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then 'retrying'
        else 'needs_attention'
      end,
      available_at = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then v_next_run
        else available_at
      end,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'outbox_dispatch_failed'),
        2000
      )
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public;
revoke all on function public.claim_background_jobs(text, integer) from anon;
revoke all on function public.claim_background_jobs(text, integer) from authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

revoke all on function public.claim_event_fabric_jobs(text, integer) from public;
revoke all on function public.claim_event_fabric_jobs(text, integer) from anon;
revoke all on function public.claim_event_fabric_jobs(text, integer) from authenticated;
grant execute on function public.claim_event_fabric_jobs(text, integer) to service_role;

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;

revoke delete on table public.transactional_outbox from service_role;
revoke truncate on table public.transactional_outbox from service_role;

alter table public.transactional_outbox enable row level security;
alter table public.background_jobs enable row level security;
alter table public.event_idempotency enable row level security;

             then (item->>'job_version')::integer between 1 and 32767
           else false
         end
       )
       or not (
         coalesce(item->>'max_attempts','') ~ '^[0-9]+
  ) then
    raise exception 'invalid event fabric job specification';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_jobs)
  ) <> (
    select count(distinct ((item->>'job_type') || ':' || (item->>'job_version')))
    from jsonb_array_elements(p_jobs) as item
  ) then
    raise exception 'duplicate event fabric job specification';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    raise exception 'outbox event not found';
  end if;

  if v_event.producer <> p_expected_producer
     or v_event.event_type <> p_expected_event_type
     or v_event.event_version <> p_expected_event_version then
    raise exception 'outbox event contract mismatch';
  end if;

  if num_nonnulls(v_event.company_id, v_event.user_id) > 1 then
    raise exception 'outbox event scope is invalid';
  end if;

  if v_event.status = 'completed' then
    for v_job in select value from jsonb_array_elements(p_jobs)
    loop
      v_job_type := v_job->>'job_type';
      v_job_version := (v_job->>'job_version')::smallint;
      v_dedupe_key := format(
        'outbox:%s:handler:%s:v%s',
        v_event.id,
        v_job_type,
        v_job_version
      );

      if not exists (
        select 1
        from public.background_jobs j
        where j.outbox_event_id = v_event.id
          and j.job_type = v_job_type
          and j.job_version = v_job_version
          and j.dedupe_key = v_dedupe_key
          and j.correlation_id = v_event.correlation_id
          and j.company_id is not distinct from v_event.company_id
          and j.user_id is not distinct from v_event.user_id
      ) then
        raise exception 'completed outbox event is missing expected job';
      end if;
    end loop;

    return jsonb_build_object(
      'status', 'completed',
      'already_dispatched', true,
      'outbox_event_id', v_event.id
    );
  end if;

  if v_event.status not in ('queued', 'retrying') then
    raise exception 'outbox event is not dispatchable from status %', v_event.status;
  end if;

  if v_event.attempts >= v_event.max_attempts then
    update public.transactional_outbox
    set status = 'needs_attention',
        last_error = 'outbox_dispatch_attempts_exhausted'
    where id = v_event.id;

    return jsonb_build_object(
      'status', 'needs_attention',
      'outbox_event_id', v_event.id,
      'reason', 'attempts_exhausted'
    );
  end if;

  update public.transactional_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null
  where id = v_event.id;

  for v_job in select value from jsonb_array_elements(p_jobs)
  loop
    v_job_type := v_job->>'job_type';
    v_job_version := (v_job->>'job_version')::smallint;
    v_max_attempts := (v_job->>'max_attempts')::integer;
    v_dedupe_key := format(
      'outbox:%s:handler:%s:v%s',
      v_event.id,
      v_job_type,
      v_job_version
    );

    insert into public.background_jobs (
      company_id,
      user_id,
      job_type,
      payload,
      status,
      attempts,
      max_attempts,
      run_after,
      metadata,
      outbox_event_id,
      dedupe_key,
      correlation_id,
      job_version
    )
    values (
      v_event.company_id,
      v_event.user_id,
      v_job_type,
      jsonb_build_object('outbox_event_id', v_event.id),
      'queued',
      0,
      v_max_attempts,
      now(),
      jsonb_build_object(
        'event_fabric', true,
        'producer', v_event.producer,
        'event_type', v_event.event_type,
        'event_version', v_event.event_version
      ),
      v_event.id,
      v_dedupe_key,
      v_event.correlation_id,
      v_job_version
    )
    on conflict do nothing;

    select count(*)
    into v_existing_count
    from public.background_jobs j
    where j.outbox_event_id = v_event.id
      and j.job_type = v_job_type
      and j.job_version = v_job_version
      and j.dedupe_key = v_dedupe_key
      and j.correlation_id = v_event.correlation_id
      and j.company_id is not distinct from v_event.company_id
      and j.user_id is not distinct from v_event.user_id;

    if v_existing_count <> 1 then
      raise exception 'event fabric job could not be ensured';
    end if;

    v_expected_count := v_expected_count + 1;
  end loop;

  update public.transactional_outbox
  set status = 'completed',
      processed_at = now(),
      last_error = null
  where id = v_event.id;

  return jsonb_build_object(
    'status', 'completed',
    'already_dispatched', false,
    'outbox_event_id', v_event.id,
    'jobs_ensured', v_expected_count
  );
end;
$$;

create or replace function public.orcaly_settle_outbox_failure(
  p_outbox_event_id uuid,
  p_retryable boolean,
  p_run_after timestamptz default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_attempts integer;
  v_next_run timestamptz;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    return false;
  end if;

  if v_event.status = 'completed' then
    return false;
  end if;

  if v_event.status not in ('queued', 'processing', 'retrying') then
    return false;
  end if;

  v_attempts := v_event.attempts + 1;
  v_next_run := greatest(
    now() + interval '1 second',
    least(
      coalesce(p_run_after, now() + interval '1 minute'),
      now() + interval '15 minutes'
    )
  );

  update public.transactional_outbox
  set attempts = v_attempts,
      status = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then 'retrying'
        else 'needs_attention'
      end,
      available_at = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then v_next_run
        else available_at
      end,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'outbox_dispatch_failed'),
        2000
      )
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public;
revoke all on function public.claim_background_jobs(text, integer) from anon;
revoke all on function public.claim_background_jobs(text, integer) from authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

revoke all on function public.claim_event_fabric_jobs(text, integer) from public;
revoke all on function public.claim_event_fabric_jobs(text, integer) from anon;
revoke all on function public.claim_event_fabric_jobs(text, integer) from authenticated;
grant execute on function public.claim_event_fabric_jobs(text, integer) to service_role;

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;

revoke delete on table public.transactional_outbox from service_role;
revoke truncate on table public.transactional_outbox from service_role;

alter table public.transactional_outbox enable row level security;
alter table public.background_jobs enable row level security;
alter table public.event_idempotency enable row level security;

         and case
           when coalesce(item->>'max_attempts','') ~ '^[0-9]+
  ) then
    raise exception 'invalid event fabric job specification';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_jobs)
  ) <> (
    select count(distinct ((item->>'job_type') || ':' || (item->>'job_version')))
    from jsonb_array_elements(p_jobs) as item
  ) then
    raise exception 'duplicate event fabric job specification';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    raise exception 'outbox event not found';
  end if;

  if v_event.producer <> p_expected_producer
     or v_event.event_type <> p_expected_event_type
     or v_event.event_version <> p_expected_event_version then
    raise exception 'outbox event contract mismatch';
  end if;

  if num_nonnulls(v_event.company_id, v_event.user_id) > 1 then
    raise exception 'outbox event scope is invalid';
  end if;

  if v_event.status = 'completed' then
    for v_job in select value from jsonb_array_elements(p_jobs)
    loop
      v_job_type := v_job->>'job_type';
      v_job_version := (v_job->>'job_version')::smallint;
      v_dedupe_key := format(
        'outbox:%s:handler:%s:v%s',
        v_event.id,
        v_job_type,
        v_job_version
      );

      if not exists (
        select 1
        from public.background_jobs j
        where j.outbox_event_id = v_event.id
          and j.job_type = v_job_type
          and j.job_version = v_job_version
          and j.dedupe_key = v_dedupe_key
          and j.correlation_id = v_event.correlation_id
          and j.company_id is not distinct from v_event.company_id
          and j.user_id is not distinct from v_event.user_id
      ) then
        raise exception 'completed outbox event is missing expected job';
      end if;
    end loop;

    return jsonb_build_object(
      'status', 'completed',
      'already_dispatched', true,
      'outbox_event_id', v_event.id
    );
  end if;

  if v_event.status not in ('queued', 'retrying') then
    raise exception 'outbox event is not dispatchable from status %', v_event.status;
  end if;

  if v_event.attempts >= v_event.max_attempts then
    update public.transactional_outbox
    set status = 'needs_attention',
        last_error = 'outbox_dispatch_attempts_exhausted'
    where id = v_event.id;

    return jsonb_build_object(
      'status', 'needs_attention',
      'outbox_event_id', v_event.id,
      'reason', 'attempts_exhausted'
    );
  end if;

  update public.transactional_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null
  where id = v_event.id;

  for v_job in select value from jsonb_array_elements(p_jobs)
  loop
    v_job_type := v_job->>'job_type';
    v_job_version := (v_job->>'job_version')::smallint;
    v_max_attempts := (v_job->>'max_attempts')::integer;
    v_dedupe_key := format(
      'outbox:%s:handler:%s:v%s',
      v_event.id,
      v_job_type,
      v_job_version
    );

    insert into public.background_jobs (
      company_id,
      user_id,
      job_type,
      payload,
      status,
      attempts,
      max_attempts,
      run_after,
      metadata,
      outbox_event_id,
      dedupe_key,
      correlation_id,
      job_version
    )
    values (
      v_event.company_id,
      v_event.user_id,
      v_job_type,
      jsonb_build_object('outbox_event_id', v_event.id),
      'queued',
      0,
      v_max_attempts,
      now(),
      jsonb_build_object(
        'event_fabric', true,
        'producer', v_event.producer,
        'event_type', v_event.event_type,
        'event_version', v_event.event_version
      ),
      v_event.id,
      v_dedupe_key,
      v_event.correlation_id,
      v_job_version
    )
    on conflict do nothing;

    select count(*)
    into v_existing_count
    from public.background_jobs j
    where j.outbox_event_id = v_event.id
      and j.job_type = v_job_type
      and j.job_version = v_job_version
      and j.dedupe_key = v_dedupe_key
      and j.correlation_id = v_event.correlation_id
      and j.company_id is not distinct from v_event.company_id
      and j.user_id is not distinct from v_event.user_id;

    if v_existing_count <> 1 then
      raise exception 'event fabric job could not be ensured';
    end if;

    v_expected_count := v_expected_count + 1;
  end loop;

  update public.transactional_outbox
  set status = 'completed',
      processed_at = now(),
      last_error = null
  where id = v_event.id;

  return jsonb_build_object(
    'status', 'completed',
    'already_dispatched', false,
    'outbox_event_id', v_event.id,
    'jobs_ensured', v_expected_count
  );
end;
$$;

create or replace function public.orcaly_settle_outbox_failure(
  p_outbox_event_id uuid,
  p_retryable boolean,
  p_run_after timestamptz default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_attempts integer;
  v_next_run timestamptz;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    return false;
  end if;

  if v_event.status = 'completed' then
    return false;
  end if;

  if v_event.status not in ('queued', 'processing', 'retrying') then
    return false;
  end if;

  v_attempts := v_event.attempts + 1;
  v_next_run := greatest(
    now() + interval '1 second',
    least(
      coalesce(p_run_after, now() + interval '1 minute'),
      now() + interval '15 minutes'
    )
  );

  update public.transactional_outbox
  set attempts = v_attempts,
      status = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then 'retrying'
        else 'needs_attention'
      end,
      available_at = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then v_next_run
        else available_at
      end,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'outbox_dispatch_failed'),
        2000
      )
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public;
revoke all on function public.claim_background_jobs(text, integer) from anon;
revoke all on function public.claim_background_jobs(text, integer) from authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

revoke all on function public.claim_event_fabric_jobs(text, integer) from public;
revoke all on function public.claim_event_fabric_jobs(text, integer) from anon;
revoke all on function public.claim_event_fabric_jobs(text, integer) from authenticated;
grant execute on function public.claim_event_fabric_jobs(text, integer) to service_role;

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;

revoke delete on table public.transactional_outbox from service_role;
revoke truncate on table public.transactional_outbox from service_role;

alter table public.transactional_outbox enable row level security;
alter table public.background_jobs enable row level security;
alter table public.event_idempotency enable row level security;

             then (item->>'max_attempts')::integer between 1 and 25
           else false
         end
       )
  ) then
    raise exception 'invalid event fabric job specification';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_jobs)
  ) <> (
    select count(distinct ((item->>'job_type') || ':' || (item->>'job_version')))
    from jsonb_array_elements(p_jobs) as item
  ) then
    raise exception 'duplicate event fabric job specification';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    raise exception 'outbox event not found';
  end if;

  if v_event.producer <> p_expected_producer
     or v_event.event_type <> p_expected_event_type
     or v_event.event_version <> p_expected_event_version then
    raise exception 'outbox event contract mismatch';
  end if;

  if num_nonnulls(v_event.company_id, v_event.user_id) > 1 then
    raise exception 'outbox event scope is invalid';
  end if;

  if v_event.status = 'completed' then
    for v_job in select value from jsonb_array_elements(p_jobs)
    loop
      v_job_type := v_job->>'job_type';
      v_job_version := (v_job->>'job_version')::smallint;
      v_dedupe_key := format(
        'outbox:%s:handler:%s:v%s',
        v_event.id,
        v_job_type,
        v_job_version
      );

      if not exists (
        select 1
        from public.background_jobs j
        where j.outbox_event_id = v_event.id
          and j.job_type = v_job_type
          and j.job_version = v_job_version
          and j.dedupe_key = v_dedupe_key
          and j.correlation_id = v_event.correlation_id
          and j.company_id is not distinct from v_event.company_id
          and j.user_id is not distinct from v_event.user_id
      ) then
        raise exception 'completed outbox event is missing expected job';
      end if;
    end loop;

    return jsonb_build_object(
      'status', 'completed',
      'already_dispatched', true,
      'outbox_event_id', v_event.id
    );
  end if;

  if v_event.status not in ('queued', 'retrying') then
    raise exception 'outbox event is not dispatchable from status %', v_event.status;
  end if;

  if v_event.attempts >= v_event.max_attempts then
    update public.transactional_outbox
    set status = 'needs_attention',
        last_error = 'outbox_dispatch_attempts_exhausted'
    where id = v_event.id;

    return jsonb_build_object(
      'status', 'needs_attention',
      'outbox_event_id', v_event.id,
      'reason', 'attempts_exhausted'
    );
  end if;

  update public.transactional_outbox
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null
  where id = v_event.id;

  for v_job in select value from jsonb_array_elements(p_jobs)
  loop
    v_job_type := v_job->>'job_type';
    v_job_version := (v_job->>'job_version')::smallint;
    v_max_attempts := (v_job->>'max_attempts')::integer;
    v_dedupe_key := format(
      'outbox:%s:handler:%s:v%s',
      v_event.id,
      v_job_type,
      v_job_version
    );

    insert into public.background_jobs (
      company_id,
      user_id,
      job_type,
      payload,
      status,
      attempts,
      max_attempts,
      run_after,
      metadata,
      outbox_event_id,
      dedupe_key,
      correlation_id,
      job_version
    )
    values (
      v_event.company_id,
      v_event.user_id,
      v_job_type,
      jsonb_build_object('outbox_event_id', v_event.id),
      'queued',
      0,
      v_max_attempts,
      now(),
      jsonb_build_object(
        'event_fabric', true,
        'producer', v_event.producer,
        'event_type', v_event.event_type,
        'event_version', v_event.event_version
      ),
      v_event.id,
      v_dedupe_key,
      v_event.correlation_id,
      v_job_version
    )
    on conflict do nothing;

    select count(*)
    into v_existing_count
    from public.background_jobs j
    where j.outbox_event_id = v_event.id
      and j.job_type = v_job_type
      and j.job_version = v_job_version
      and j.dedupe_key = v_dedupe_key
      and j.correlation_id = v_event.correlation_id
      and j.company_id is not distinct from v_event.company_id
      and j.user_id is not distinct from v_event.user_id;

    if v_existing_count <> 1 then
      raise exception 'event fabric job could not be ensured';
    end if;

    v_expected_count := v_expected_count + 1;
  end loop;

  update public.transactional_outbox
  set status = 'completed',
      processed_at = now(),
      last_error = null
  where id = v_event.id;

  return jsonb_build_object(
    'status', 'completed',
    'already_dispatched', false,
    'outbox_event_id', v_event.id,
    'jobs_ensured', v_expected_count
  );
end;
$$;

create or replace function public.orcaly_settle_outbox_failure(
  p_outbox_event_id uuid,
  p_retryable boolean,
  p_run_after timestamptz default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.transactional_outbox%rowtype;
  v_attempts integer;
  v_next_run timestamptz;
begin
  if p_outbox_event_id is null then
    raise exception 'outbox event id is required';
  end if;

  select *
  into v_event
  from public.transactional_outbox o
  where o.id = p_outbox_event_id
  for update;

  if not found then
    return false;
  end if;

  if v_event.status = 'completed' then
    return false;
  end if;

  if v_event.status not in ('queued', 'processing', 'retrying') then
    return false;
  end if;

  v_attempts := v_event.attempts + 1;
  v_next_run := greatest(
    now() + interval '1 second',
    least(
      coalesce(p_run_after, now() + interval '1 minute'),
      now() + interval '15 minutes'
    )
  );

  update public.transactional_outbox
  set attempts = v_attempts,
      status = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then 'retrying'
        else 'needs_attention'
      end,
      available_at = case
        when coalesce(p_retryable, false) and v_attempts < max_attempts then v_next_run
        else available_at
      end,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'outbox_dispatch_failed'),
        2000
      )
  where id = v_event.id;

  return true;
end;
$$;

revoke all on function public.claim_background_jobs(text, integer) from public;
revoke all on function public.claim_background_jobs(text, integer) from anon;
revoke all on function public.claim_background_jobs(text, integer) from authenticated;
grant execute on function public.claim_background_jobs(text, integer) to service_role;

revoke all on function public.claim_event_fabric_jobs(text, integer) from public;
revoke all on function public.claim_event_fabric_jobs(text, integer) from anon;
revoke all on function public.claim_event_fabric_jobs(text, integer) from authenticated;
grant execute on function public.claim_event_fabric_jobs(text, integer) to service_role;

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;

revoke delete on table public.transactional_outbox from service_role;
revoke truncate on table public.transactional_outbox from service_role;

alter table public.transactional_outbox enable row level security;
alter table public.background_jobs enable row level security;
alter table public.event_idempotency enable row level security;
