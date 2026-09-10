create index if not exists idx_background_jobs_running_lock
  on public.background_jobs(locked_at)
  where status = 'running' and locked_at is not null;

create or replace function public.settle_background_job(
  p_job_id uuid,
  p_worker text,
  p_status text,
  p_run_after timestamptz default null,
  p_error text default null,
  p_metadata_patch jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_updated integer := 0;
  v_worker text := left(coalesce(p_worker, ''), 120);
begin
  if p_status not in ('completed', 'failed', 'retrying', 'needs_attention') then
    raise exception 'invalid background job settlement status';
  end if;

  if v_worker = '' then
    raise exception 'worker id is required';
  end if;

  update public.background_jobs j
  set status = p_status,
      run_after = case
        when p_status = 'retrying' then coalesce(p_run_after, now() + interval '1 minute')
        else j.run_after
      end,
      locked_at = null,
      locked_by = null,
      completed_at = case
        when p_status in ('completed', 'failed', 'needs_attention') then now()
        else null
      end,
      last_error = case
        when p_status = 'completed' then null
        else left(coalesce(nullif(p_error, ''), 'job_failed'), 2000)
      end,
      metadata = coalesce(j.metadata, '{}'::jsonb) || coalesce(p_metadata_patch, '{}'::jsonb)
  where j.id = p_job_id
    and j.status = 'running'
    and j.locked_by = v_worker;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.recover_stale_background_jobs(
  p_stale_seconds integer default 300,
  p_limit integer default 25
) returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count integer := 0;
  v_stale_seconds integer := greatest(60, least(coalesce(p_stale_seconds, 300), 3600));
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50));
begin
  with picked as (
    select j.id
    from public.background_jobs j
    where j.status = 'running'
      and j.locked_at is not null
      and j.locked_at <= now() - make_interval(secs => v_stale_seconds)
    order by j.locked_at asc
    for update skip locked
    limit v_limit
  )
  update public.background_jobs j
  set status = case when j.attempts >= j.max_attempts then 'needs_attention' else 'retrying' end,
      run_after = case when j.attempts >= j.max_attempts then j.run_after else now() + interval '30 seconds' end,
      locked_at = null,
      locked_by = null,
      completed_at = case when j.attempts >= j.max_attempts then now() else null end,
      last_error = 'stale_worker_lock_recovered',
      metadata = coalesce(j.metadata, '{}'::jsonb) || jsonb_build_object('stale_recovered_at', now())
  from picked
  where j.id = picked.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.settle_background_job(uuid, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.recover_stale_background_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.settle_background_job(uuid, text, text, timestamptz, text, jsonb) to service_role;
grant execute on function public.recover_stale_background_jobs(integer, integer) to service_role;
