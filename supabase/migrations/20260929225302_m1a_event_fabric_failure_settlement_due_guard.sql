-- ORÇALY M1A final corrective follow-up
-- Prevent premature failure settlement before PostgreSQL DB-time eligibility.
-- Prior M1A migrations remain immutable.

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

  -- Queued/retrying rows must not consume failure budget before DB time says due.
  -- Processing is intentionally excluded: it may already represent an eligible
  -- dispatch whose handler subsequently failed and must remain settleable.
  if v_event.status in ('queued', 'retrying')
     and v_event.available_at > now() then
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

revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from public;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from anon;
revoke all on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) from authenticated;
grant execute on function public.orcaly_settle_outbox_failure(uuid, boolean, timestamptz, text) to service_role;
