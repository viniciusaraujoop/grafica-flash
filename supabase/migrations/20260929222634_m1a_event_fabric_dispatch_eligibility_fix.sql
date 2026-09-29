-- ORÇALY M1A corrective follow-up
-- Security blockers: DB-time dispatch eligibility only.
-- Original M1A migration remains immutable.

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
         coalesce(item->>'job_version','') ~ '^[0-9]+$'
         and case
           when coalesce(item->>'job_version','') ~ '^[0-9]+$'
             then (item->>'job_version')::integer between 1 and 32767
           else false
         end
       )
       or not (
         coalesce(item->>'max_attempts','') ~ '^[0-9]+$'
         and case
           when coalesce(item->>'max_attempts','') ~ '^[0-9]+$'
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

  if v_event.available_at > now() then
    return jsonb_build_object(
      'status', 'not_due',
      'outbox_event_id', v_event.id
    );
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

revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from public;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from anon;
revoke all on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) from authenticated;
grant execute on function public.orcaly_dispatch_outbox_event(uuid, text, text, smallint, jsonb) to service_role;
