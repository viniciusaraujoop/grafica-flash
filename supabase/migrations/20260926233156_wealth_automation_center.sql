-- Operational view and idempotent commands over the existing recurrence engine. No clock registration.
begin;
create table ecosystem_private.wealth_automation_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 history_days integer not null default 30 check(history_days in (7,30,90,365)),
 show_inactive boolean not null default false, version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table ecosystem_private.wealth_automation_commands (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 token uuid not null,operation text not null,input_hash text not null,result jsonb not null,
 recorded_at timestamptz not null default now(),unique(user_id,token)
);
create index wealth_automation_history on ecosystem_private.wealth_automation_commands(user_id,recorded_at desc,id);
create index wealth_recurrence_operational_jobs on public.background_jobs((payload->>'recurrence_id'),created_at desc,id) where job_type='wealth.recurrence' and company_id is null;
do $$declare t text;begin
 foreach t in array array['wealth_automation_preferences','wealth_automation_commands'] loop
  execute format('alter table ecosystem_private.%I enable row level security',t);
  execute format('revoke all on ecosystem_private.%I from public,anon,authenticated',t);
  execute format('grant all on ecosystem_private.%I to service_role',t);
 end loop;
end;$$;
create trigger automation_preferences_audit after insert or update or delete on ecosystem_private.wealth_automation_preferences for each row execute function ecosystem_private.record_change();
create trigger automation_commands_audit after insert on ecosystem_private.wealth_automation_commands for each row execute function ecosystem_private.record_change();

create function ecosystem_private.manage_wealth_automation(p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();command_token uuid;fingerprint text;receipt ecosystem_private.wealth_automation_commands;pref ecosystem_private.wealth_automation_preferences;
 result jsonb;keys text[]:=array['idempotency_key','confirmed'];j public.background_jobs;s public.wealth_recurring_schedules;command_id uuid:=gen_random_uuid();
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'automation denied' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('configure','run','pause','resume','cancel','retry') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>2000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid command' using errcode='22023';end if;
 if p_operation='configure' then keys:=keys||array['version','history_days','show_inactive'];elsif p_operation in ('pause','resume','cancel') then keys:=keys||array['id','version'];elsif p_operation='retry' then keys:=keys||array['id','attempts'];end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 command_token:=(p_input->>'idempotency_key')::uuid;if command_token is null then raise exception 'missing token' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-automation:'||actor::text,0));
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into receipt from ecosystem_private.wealth_automation_commands where user_id=actor and token=command_token;
 if found then
  if receipt.operation<>p_operation or receipt.input_hash<>fingerprint then raise exception 'command reused' using errcode='23505';end if;
  return receipt.result;
 end if;
 if p_operation='configure' then
  select * into pref from ecosystem_private.wealth_automation_preferences where user_id=actor for update;
  if coalesce(p_input->>'version','')!~'^\d{1,16}$' or (p_input->>'version')::bigint<>coalesce(pref.version,0) then raise exception 'preferences changed' using errcode='PT409';end if;
  if coalesce(p_input->>'history_days','') not in ('7','30','90','365') or jsonb_typeof(p_input->'show_inactive') is distinct from 'boolean' then raise exception 'invalid preference' using errcode='22023';end if;
  insert into ecosystem_private.wealth_automation_preferences(user_id,history_days,show_inactive) values(actor,(p_input->>'history_days')::integer,(p_input->>'show_inactive')::boolean)
  on conflict(user_id) do update set history_days=excluded.history_days,show_inactive=excluded.show_inactive,version=wealth_automation_preferences.version+1,updated_at=now();
  result:=jsonb_build_object('status','configured');
 elsif p_operation='run' then
  -- Same engine, authorization, occurrence ledger and transactional outbox; max10 own jobs.
  result:=ecosystem_private.run_my_wealth_recurrences()||jsonb_build_object('status','completed');
 elsif p_operation in ('pause','resume','cancel') then
  if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' then raise exception 'invalid version' using errcode='22023';end if;
  if ecosystem_private.change_wealth_recurrence((p_input->>'id')::uuid,(p_input->>'version')::bigint,p_operation) is distinct from true then raise exception 'schedule changed or unavailable' using errcode='PT409';end if;
  result:=jsonb_build_object('status',case p_operation when 'pause' then 'paused' when 'resume' then 'active' else 'cancelled' end);
 else
  -- The same lease -> schedule order as the worker, never reset attempt history or touch another job type.
  select b.* into j from public.background_jobs b join public.wealth_recurring_schedules r on r.id::text=b.payload->>'recurrence_id'
   where b.id=(p_input->>'id')::uuid and b.company_id is null and b.job_type='wealth.recurrence' and r.user_id=actor for update of b;
  if not found then raise exception 'job unavailable' using errcode='42501';end if;
  select * into s from public.wealth_recurring_schedules where id::text=j.payload->>'recurrence_id' and user_id=actor for update;
  if j.status<>'needs_attention' or j.locked_by is not null or j.locked_at is not null or coalesce(p_input->>'attempts','')!~'^\d{1,2}$' or (p_input->>'attempts')::int<>j.attempts or s.status<>'active' or j.payload->>'occurrence_index' is distinct from s.next_index::text then raise exception 'job changed or ineligible' using errcode='PT409';end if;
  if j.attempts>=25 then raise exception 'attempt limit' using errcode='54000';end if;
  update public.background_jobs set status='retrying',max_attempts=greatest(max_attempts,attempts+1),run_after=now(),completed_at=null where id=j.id;
  result:=jsonb_build_object('status','retrying');
 end if;
 result:=result||jsonb_build_object('command_id',command_id);
 insert into ecosystem_private.wealth_automation_commands(id,user_id,token,operation,input_hash,result) values(command_id,actor,command_token,p_operation,fingerprint,result);
 return result;
end;$$;
revoke all on function ecosystem_private.manage_wealth_automation(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_automation(text,jsonb) to authenticated;
create function public.manage_wealth_automation(p_operation text,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_automation(p_operation,p_input);$$;
revoke all on function public.manage_wealth_automation(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_wealth_automation(text,jsonb) to authenticated;

create function ecosystem_private.wealth_automation_overview(p_page integer default 1,p_days integer default null,p_status text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();pref ecosystem_private.wealth_automation_preferences;days integer;clock_state text:='NOT_CONFIGURED';schedules jsonb;commands jsonb;occurrences jsonb;summary jsonb;sc bigint;cc bigint;oc bigint;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'automation read denied' using errcode='42501';end if;
 select * into pref from ecosystem_private.wealth_automation_preferences where user_id=actor;days:=coalesce(p_days,pref.history_days,30);
 if p_page is null or p_page<1 or p_page>100000 or days not in (7,30,90,365) or (p_status is not null and p_status not in ('active','paused','cancelled','completed')) then raise exception 'invalid filter' using errcode='22023';end if;
 -- Database clock only; do not inspect secrets, payloads or presume an external worker is online.
 if to_regclass('cron.job') is not null then
  execute $q$select case when bool_or(active) then 'ACTIVE' when count(*)>0 then 'PAUSED' else 'NOT_CONFIGURED' end from cron.job where command like '%ecosystem_private.run_wealth_recurrence_batch(%'$q$ into clock_state;
 end if;
 select jsonb_build_object('active',count(*) filter(where status='active')::text,'paused',count(*) filter(where status='paused')::text,'closed',count(*) filter(where status in ('cancelled','completed'))::text) into summary from public.wealth_recurring_schedules where user_id=actor;
 select summary||jsonb_build_object('due',count(*) filter(where b.status in ('queued','retrying') and b.run_after<=now() and s.status='active')::text,'attention',count(*) filter(where b.status='needs_attention' and s.status='active')::text) into summary
  from public.background_jobs b join public.wealth_recurring_schedules s on s.id::text=b.payload->>'recurrence_id' where s.user_id=actor and b.company_id is null and b.job_type='wealth.recurrence';
 select count(*) into sc from public.wealth_recurring_schedules where user_id=actor and (case when p_status is not null then status=p_status else coalesce(pref.show_inactive,false) or status in ('active','paused') end);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into schedules from (
  select s.id,s.title,s.status,s.version,s.next_date,s.timezone,s.pause_reason,
   (select jsonb_build_object('id',b.id,'status',b.status,'attempts',b.attempts,'max_attempts',b.max_attempts,'run_after',b.run_after,'can_retry',b.status='needs_attention' and b.locked_by is null and b.locked_at is null and b.attempts<25 and b.payload->>'occurrence_index'=s.next_index::text and s.status='active') from public.background_jobs b where b.company_id is null and b.job_type='wealth.recurrence' and b.payload->>'recurrence_id'=s.id::text and b.payload->>'occurrence_index'=s.next_index::text order by b.created_at desc,b.id desc limit 1) job
  from public.wealth_recurring_schedules s where s.user_id=actor and (case when p_status is not null then s.status=p_status else coalesce(pref.show_inactive,false) or s.status in ('active','paused') end) order by s.created_at desc,s.id limit 25 offset (p_page-1)*25
 )r;
 select count(*) into cc from ecosystem_private.wealth_automation_commands where user_id=actor and recorded_at>=now()-make_interval(days=>days);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into commands from (select id,operation,recorded_at,result from ecosystem_private.wealth_automation_commands where user_id=actor and recorded_at>=now()-make_interval(days=>days) order by recorded_at desc,id limit 25 offset (p_page-1)*25)r;
 select count(*) into oc from public.wealth_recurrence_occurrences o join public.wealth_recurring_schedules s on s.id=o.schedule_id where s.user_id=actor and o.created_at>=now()-make_interval(days=>days);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into occurrences from (
  select o.schedule_id,o.occurrence_index,o.financial_date,o.created_at,s.title,
   case when e.id is not null and e.user_id=actor then e.id else null end entry_id
  from public.wealth_recurrence_occurrences o join public.wealth_recurring_schedules s on s.id=o.schedule_id left join public.wealth_entries e on e.id=o.entry_id
  where s.user_id=actor and o.created_at>=now()-make_interval(days=>days) order by o.created_at desc,o.schedule_id,o.occurrence_index limit 25 offset (p_page-1)*25
 )r;
 return jsonb_build_object('preferences',jsonb_build_object('history_days',coalesce(pref.history_days,30),'show_inactive',coalesce(pref.show_inactive,false),'version',coalesce(pref.version,0)),
 'days',days,'clock',clock_state,'summary',summary,'schedules',schedules,'commands',commands,'occurrences',occurrences,'schedule_count',sc::text,'command_count',cc::text,'occurrence_count',oc::text);
end;$$;
revoke all on function ecosystem_private.wealth_automation_overview(integer,integer,text) from public,anon,authenticated;
grant execute on function ecosystem_private.wealth_automation_overview(integer,integer,text) to authenticated;
create function public.wealth_automation_overview(p_page integer default 1,p_days integer default null,p_status text default null) returns jsonb language sql security invoker set search_path='' as $$select ecosystem_private.wealth_automation_overview(p_page,p_days,p_status);$$;
revoke all on function public.wealth_automation_overview(integer,integer,text) from public,anon,authenticated;
grant execute on function public.wealth_automation_overview(integer,integer,text) to authenticated;
commit;
