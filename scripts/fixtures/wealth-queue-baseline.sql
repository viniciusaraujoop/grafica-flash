-- Test-only schema subset from the certified production baseline, not a remote migration.
create table public.background_jobs ("id" uuid not null default gen_random_uuid(),"company_id" uuid,"job_type" text not null,"payload" jsonb not null default '{}'::jsonb,"status" text not null default 'queued'::text,"attempts" integer not null default 0,"max_attempts" integer not null default 5,"run_after" timestamp with time zone not null default now(),"locked_at" timestamp with time zone,"locked_by" text,"created_at" timestamp with time zone not null default now(),"started_at" timestamp with time zone,"completed_at" timestamp with time zone,"last_error" text,"metadata" jsonb not null default '{}'::jsonb,constraint "background_jobs_attempts_check" CHECK (attempts >= 0),constraint "background_jobs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,constraint "background_jobs_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 25),constraint "background_jobs_pkey" PRIMARY KEY (id),constraint "background_jobs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text])));
alter table public.background_jobs enable row level security; grant all on public.background_jobs to service_role;
create table public.event_idempotency ("id" uuid not null default gen_random_uuid(),"provider" text not null,"event_id" text not null,"company_id" uuid,"event_type" text,"payload_hash" text,"received_at" timestamp with time zone not null default now(),"processed_at" timestamp with time zone,"status" text not null default 'received'::text,"attempt" integer not null default 1,"last_error" text,"metadata" jsonb not null default '{}'::jsonb,constraint "event_idempotency_attempt_check" CHECK (attempt >= 1),constraint "event_idempotency_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,constraint "event_idempotency_pkey" PRIMARY KEY (id),constraint "event_idempotency_provider_event_id_key" UNIQUE (provider, event_id),constraint "event_idempotency_status_check" CHECK (status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'ignored'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text])));
alter table public.event_idempotency enable row level security; grant all on public.event_idempotency to service_role;
create table public.transactional_outbox ("id" uuid not null default gen_random_uuid(),"company_id" uuid,"event_type" text not null,"aggregate_type" text not null,"aggregate_id" uuid,"payload" jsonb not null default '{}'::jsonb,"status" text not null default 'queued'::text,"attempts" integer not null default 0,"max_attempts" integer not null default 5,"available_at" timestamp with time zone not null default now(),"created_at" timestamp with time zone not null default now(),"processed_at" timestamp with time zone,"last_error" text,constraint "transactional_outbox_attempts_check" CHECK (attempts >= 0),constraint "transactional_outbox_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,constraint "transactional_outbox_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 25),constraint "transactional_outbox_pkey" PRIMARY KEY (id),constraint "transactional_outbox_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text])));
alter table public.transactional_outbox enable row level security; grant all on public.transactional_outbox to service_role;
CREATE OR REPLACE FUNCTION public.claim_background_jobs(p_worker text, p_limit integer DEFAULT 10)
 RETURNS SETOF background_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin return query with picked as (select id from public.background_jobs where status in ('queued','retrying') and run_after<=now() order by run_after,created_at for update skip locked limit greatest(1,least(coalesce(p_limit,10),50))) update public.background_jobs j set status='running',attempts=j.attempts+1,locked_at=now(),locked_by=left(coalesce(p_worker,'worker'),120),started_at=coalesce(j.started_at,now()) from picked where j.id=picked.id returning j.*; end; $function$
;
revoke all on function public.claim_background_jobs(p_worker text, p_limit integer) from public,anon,authenticated; grant execute on function public.claim_background_jobs(p_worker text, p_limit integer) to service_role;
CREATE OR REPLACE FUNCTION public.recover_stale_background_jobs(p_stale_seconds integer DEFAULT 300, p_limit integer DEFAULT 25)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;
revoke all on function public.recover_stale_background_jobs(p_stale_seconds integer, p_limit integer) from public,anon,authenticated; grant execute on function public.recover_stale_background_jobs(p_stale_seconds integer, p_limit integer) to service_role;
CREATE OR REPLACE FUNCTION public.settle_background_job(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_error text DEFAULT NULL::text, p_metadata_patch jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;
revoke all on function public.settle_background_job(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone, p_error text, p_metadata_patch jsonb) from public,anon,authenticated; grant execute on function public.settle_background_job(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone, p_error text, p_metadata_patch jsonb) to service_role;
