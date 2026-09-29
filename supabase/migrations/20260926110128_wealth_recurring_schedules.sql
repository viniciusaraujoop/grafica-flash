-- Personal recurring declarations. No payment, network call or cron registration.
begin;
create table public.wealth_recurring_schedules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 160),
 kind text not null check(kind in ('income','expense')),
 category text not null check(category in ('salary','housing','food','transport','education','health','leisure','investment','property','loan','other')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000000),
 currency text not null default 'BRL' check(currency='BRL'),
 frequency text not null check(frequency in ('daily','weekly','monthly','yearly')),
 interval_count integer not null default 1 check(interval_count between 1 and 36),
 start_date date not null check(start_date between date '1900-01-01' and date '2200-12-31'),
 end_date date check(end_date between start_date and date '2200-12-31'),
 max_occurrences integer check(max_occurrences between 1 and 1200),
 timezone text not null,
 status text not null default 'active' check(status in ('active','paused','cancelled','completed')),
 pause_reason text check(pause_reason in ('user','access_unavailable')),
 next_index integer not null default 0 check(next_index between 0 and 200000),
 next_date date not null,
 next_run_at timestamptz not null,
 last_run_at timestamptz,
 source_entry_id uuid references public.wealth_entries(id) on delete set null,
 idempotency_key uuid not null,
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,idempotency_key)
);
create index wealth_recurring_owner_created on public.wealth_recurring_schedules(user_id,created_at desc,id);
create index wealth_recurring_source on public.wealth_recurring_schedules(source_entry_id) where source_entry_id is not null;
create table public.wealth_recurrence_occurrences (
 schedule_id uuid not null references public.wealth_recurring_schedules(id) on delete cascade,
 occurrence_index integer not null check(occurrence_index>=0),
 financial_date date not null,
 entry_id uuid references public.wealth_entries(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(schedule_id,occurrence_index),
 unique(entry_id)
);
alter table public.wealth_recurring_schedules enable row level security;
alter table public.wealth_recurrence_occurrences enable row level security;
revoke all on public.wealth_recurring_schedules,public.wealth_recurrence_occurrences from public,anon,authenticated;
grant select on public.wealth_recurring_schedules,public.wealth_recurrence_occurrences to authenticated;
grant all on public.wealth_recurring_schedules,public.wealth_recurrence_occurrences to service_role;
create policy wealth_recurring_read on public.wealth_recurring_schedules for select to authenticated
 using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access('wealth','wealth.read')));
create policy wealth_occurrences_read on public.wealth_recurrence_occurrences for select to authenticated
 using(exists(select 1 from public.wealth_recurring_schedules s where s.id=schedule_id and s.user_id=(select auth.uid())));
create trigger wealth_recurring_audit after insert or update or delete on public.wealth_recurring_schedules
 for each row execute function ecosystem_private.record_change();

-- Anchor-based arithmetic: Jan 31 -> Feb end -> Mar 31; leap years retain the original anchor.
create function ecosystem_private.wealth_recurrence_date(anchor date,frequency text,period integer,step integer) returns date
language sql immutable security invoker set search_path='' as $$
 select case frequency
 when 'daily' then anchor+period*step
 when 'weekly' then anchor+7*period*step
 when 'monthly' then (anchor+make_interval(months=>period*step))::date
 when 'yearly' then (anchor+make_interval(years=>period*step))::date end;
$$;
revoke all on function ecosystem_private.wealth_recurrence_date(date,text,integer,integer) from public,anon,authenticated;

create function ecosystem_private.enqueue_wealth_recurrence(s public.wealth_recurring_schedules) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Callers hold the schedule lock; pending/retrying work is reused after a pause/resume.
 if s.status='active' and not exists(select 1 from public.background_jobs j
  where j.job_type='wealth.recurrence' and j.payload->>'recurrence_id'=s.id::text
   and j.payload->>'occurrence_index'=s.next_index::text and j.status in ('queued','running','retrying')) then
  insert into public.background_jobs(company_id,job_type,payload,run_after)
   values(null,'wealth.recurrence',jsonb_build_object('recurrence_id',s.id,'occurrence_index',s.next_index),s.next_run_at);
 end if;
end;
$$;
revoke all on function ecosystem_private.enqueue_wealth_recurrence(public.wealth_recurring_schedules) from public,anon,authenticated;

create function public.create_wealth_recurrence(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.wealth_recurring_schedules; existing public.wealth_recurring_schedules; source_id uuid;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then
  raise exception 'wealth write denied' using errcode='42501'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' or p_input->>'confirmed' is distinct from 'yes'
  or p_input->>'start_date' is null or p_input->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid recurrence' using errcode='22023'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_input->>'timezone') then raise exception 'invalid timezone' using errcode='22023'; end if;
 source_id:=nullif(p_input->>'source_entry_id','')::uuid;
 if source_id is not null and not exists(select 1 from public.wealth_entries where id=source_id and user_id=actor and archived_at is null) then raise exception 'source unavailable' using errcode='42501'; end if;
 insert into public.wealth_recurring_schedules(user_id,title,kind,category,amount_cents,frequency,interval_count,start_date,end_date,max_occurrences,timezone,next_date,next_run_at,source_entry_id,idempotency_key)
 values(actor,btrim(p_input->>'title'),p_input->>'kind',p_input->>'category',(p_input->>'amount_cents')::bigint,p_input->>'frequency',(p_input->>'interval_count')::integer,
 (p_input->>'start_date')::date,nullif(p_input->>'end_date','')::date,nullif(p_input->>'max_occurrences','')::integer,p_input->>'timezone',
 (p_input->>'start_date')::date,((p_input->>'start_date')::date+time '12:00') at time zone (p_input->>'timezone'),source_id,(p_input->>'idempotency_key')::uuid)
 on conflict(user_id,idempotency_key) do nothing returning * into s;
 if s.id is null then
  select * into existing from public.wealth_recurring_schedules where user_id=actor and idempotency_key=(p_input->>'idempotency_key')::uuid;
  if existing.title is distinct from btrim(p_input->>'title') or existing.kind is distinct from p_input->>'kind'
   or existing.category is distinct from p_input->>'category' or existing.amount_cents is distinct from (p_input->>'amount_cents')::bigint
   or existing.frequency is distinct from p_input->>'frequency' or existing.interval_count is distinct from (p_input->>'interval_count')::integer
   or existing.start_date is distinct from (p_input->>'start_date')::date or existing.end_date is distinct from nullif(p_input->>'end_date','')::date
   or existing.max_occurrences is distinct from nullif(p_input->>'max_occurrences','')::integer or existing.timezone is distinct from p_input->>'timezone'
   or existing.source_entry_id is distinct from source_id then raise exception 'idempotency conflict' using errcode='23505'; end if;
  return existing.id;
 end if;
 perform ecosystem_private.enqueue_wealth_recurrence(s);
 return s.id;
end;
$$;
revoke all on function public.create_wealth_recurrence(jsonb) from public,anon,authenticated;
grant execute on function public.create_wealth_recurrence(jsonb) to authenticated;

create function public.change_wealth_recurrence(p_id uuid,p_version bigint,p_operation text) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.wealth_recurring_schedules; actor uuid:=auth.uid();
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501'; end if;
 if p_operation is null or p_operation not in ('pause','resume','cancel') then raise exception 'invalid operation' using errcode='22023'; end if;
 select * into s from public.wealth_recurring_schedules where id=p_id and user_id=actor for update;
 if not found or p_version is null or s.version<>p_version or s.status in ('completed','cancelled') then return false; end if;
 if (p_operation='pause' and s.status<>'active') or (p_operation='resume' and s.status<>'paused') then return false; end if;
 update public.wealth_recurring_schedules set
  status=case p_operation when 'pause' then 'paused' when 'resume' then 'active' else 'cancelled' end,
  pause_reason=case p_operation when 'pause' then 'user' else null end,version=version+1,updated_at=clock_timestamp()
  where id=s.id returning * into s;
 if p_operation='resume' then perform ecosystem_private.enqueue_wealth_recurrence(s); end if;
 return true;
end;
$$;
revoke all on function public.change_wealth_recurrence(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.change_wealth_recurrence(uuid,bigint,text) to authenticated;

-- Only the existing trusted worker can call this. Fence the job lease before taking the schedule lock.
create function public.process_wealth_recurrence(p_job_id uuid,p_worker text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.background_jobs; s public.wealth_recurring_schedules; eid uuid; ledger uuid; upcoming date; finished boolean;
begin
 select * into j from public.background_jobs where id=p_job_id for update;
 if not found or j.job_type<>'wealth.recurrence' or j.status<>'running' or j.locked_by is distinct from p_worker or p_worker is null or p_worker='' then
  raise exception 'worker lease lost' using errcode='42501'; end if;
 select * into s from public.wealth_recurring_schedules where id=(j.payload->>'recurrence_id')::uuid for update;
 if not found then return jsonb_build_object('status','removed'); end if;
 if s.status<>'active' then return jsonb_build_object('status',s.status); end if;
 if s.next_index is distinct from (j.payload->>'occurrence_index')::integer then return jsonb_build_object('status','superseded'); end if;
 if s.next_run_at>now() then raise exception 'occurrence not due' using errcode='22023'; end if;
 if not exists(select 1 from public.ecosystem_product_entitlements e where e.user_id=s.user_id and e.company_id is null and e.product_id='wealth'
  and e.status='active' and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()) and array['wealth.read','wealth.write']::text[] <@ e.permissions) then
  update public.wealth_recurring_schedules set status='paused',pause_reason='access_unavailable',version=version+1,updated_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('status','access_unavailable');
 end if;
 insert into public.event_idempotency(provider,event_id,event_type,status)
 values('wealth_recurrence',s.id::text||':'||s.next_index,'wealth.recurrence.generated','processing')
 on conflict(provider,event_id) do nothing returning id into ledger;
 if ledger is null then return jsonb_build_object('status','already_processed'); end if;
 insert into public.wealth_entries(user_id,kind,title,category,amount_cents,currency,financial_date,recurrence,idempotency_key)
 values(s.user_id,s.kind,s.title,s.category,s.amount_cents,'BRL',s.next_date,case when s.frequency in ('monthly','yearly') then s.frequency else 'none' end,gen_random_uuid()) returning id into eid;
 insert into public.wealth_recurrence_occurrences(schedule_id,occurrence_index,financial_date,entry_id) values(s.id,s.next_index,s.next_date,eid);
 update public.event_idempotency set status='processed',processed_at=clock_timestamp(),metadata=jsonb_build_object('entry_id',eid) where id=ledger;
 insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload)
 values(null,'wealth.recurrence.generated','wealth_recurrence',s.id,jsonb_build_object('entry_id',eid,'occurrence_index',s.next_index));
 upcoming:=ecosystem_private.wealth_recurrence_date(s.start_date,s.frequency,s.interval_count,s.next_index+1);
 finished:=(s.end_date is not null and upcoming>s.end_date) or (s.max_occurrences is not null and s.next_index+1>=s.max_occurrences) or upcoming>date '2200-12-31';
 update public.wealth_recurring_schedules set next_index=next_index+1,next_date=upcoming,
  next_run_at=(upcoming+time '12:00') at time zone s.timezone,last_run_at=clock_timestamp(),status=case when finished then 'completed' else 'active' end,
  version=version+1,updated_at=clock_timestamp() where id=s.id returning * into s;
 if not finished then perform ecosystem_private.enqueue_wealth_recurrence(s); end if;
 return jsonb_build_object('status','generated','entry_id',eid,'completed',finished);
end;
$$;
revoke all on function public.process_wealth_recurrence(uuid,text) from public,anon,authenticated;
grant execute on function public.process_wealth_recurrence(uuid,text) to service_role;
comment on table public.wealth_recurring_schedules is 'Personal declared recurring records at local noon. Not a bank connection, payment instruction or investment execution. Paused schedules catch up only after explicit resume.';

-- Explicit owner refresh uses the same execution primitive, bounded to 10 own due jobs.
-- It never calls the global claim/recovery functions on behalf of an authenticated user.
create function public.run_my_wealth_recurrences() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); j public.background_jobs; result jsonb; worker text:='wealth-owner-'||gen_random_uuid()::text;
 generated integer:=0; skipped integer:=0; retrying integer:=0; attention integer:=0;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501'; end if;
 for j in select b.* from public.background_jobs b join public.wealth_recurring_schedules s on s.id::text=b.payload->>'recurrence_id'
  where b.job_type='wealth.recurrence' and s.user_id=actor and b.status in ('queued','retrying') and b.run_after<=now()
  order by b.run_after,b.created_at,b.id for update of b skip locked limit 10
 loop
  update public.background_jobs set status='running',attempts=attempts+1,locked_at=now(),locked_by=worker,started_at=coalesce(started_at,now()) where id=j.id;
  begin
   result:=public.process_wealth_recurrence(j.id,worker);
   perform public.settle_background_job(j.id,worker,'completed',null,null,result);
   if result->>'status'='generated' then generated:=generated+1; else skipped:=skipped+1; end if;
  exception when others then
   -- The subtransaction rolls back entry, ledger, outbox and next occurrence together.
   if j.attempts+1>=j.max_attempts then
    perform public.settle_background_job(j.id,worker,'needs_attention',null,'wealth_recurrence_failed','{}'::jsonb);attention:=attention+1;
   else
    perform public.settle_background_job(j.id,worker,'retrying',now()+make_interval(secs=>least(3600,30*(2^least(j.attempts,7)))::integer),'wealth_recurrence_retry','{}'::jsonb);retrying:=retrying+1;
   end if;
  end;
 end loop;
 return jsonb_build_object('generated',generated,'skipped',skipped,'retrying',retrying,'needs_attention',attention);
end;
$$;
revoke all on function public.run_my_wealth_recurrences() from public,anon,authenticated;
grant execute on function public.run_my_wealth_recurrences() to authenticated;
commit;
