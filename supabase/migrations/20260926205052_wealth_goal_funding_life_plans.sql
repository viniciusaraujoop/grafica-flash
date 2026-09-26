-- Additive planning metadata. No balance, transfers, return assumptions or scheduler.
begin;
create table public.wealth_goal_funding (
 id uuid primary key references public.wealth_goals(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 priority text not null check(priority in ('low','normal','high')),
 category text not null check(category in ('','salary','housing','food','transport','education','health','leisure','investment','property','loan','other')),
 sources jsonb not null check(jsonb_typeof(sources)='array' and jsonb_array_length(sources)<=20),
 notes text not null check(length(notes)<=2000),
 updated_at timestamptz not null default now()
);
create index wealth_goal_funding_owner on public.wealth_goal_funding(user_id,id);
create table public.wealth_life_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),
 event_type text not null check(event_type in ('house','car','wedding','child','education','moving','business','retirement','sabbatical','emergency','other')),
 target_date date not null check(target_date between date '1900-01-01' and date '2200-12-31'),
 scenario text not null check(scenario in ('BASE','CONSERVATIVE','OPTIMISTIC','CUSTOM')),
 status text not null check(status in ('draft','active','paused','completed','cancelled')),
 upfront_cents bigint not null check(upfront_cents between 0 and 100000000000000),
 monthly_impact_cents bigint not null check(monthly_impact_cents between 0 and 100000000000000),
 impact_months integer not null check(impact_months between 0 and 600),
 current_funding_cents bigint not null check(current_funding_cents between 0 and 100000000000000),
 monthly_capacity_cents bigint not null check(monthly_capacity_cents between 0 and 100000000000000),
 reserve_cents bigint check(reserve_cents between 0 and 100000000000000),
 reserve_draw_cents bigint not null check(reserve_draw_cents between 0 and coalesce(reserve_cents,0) and reserve_draw_cents<=current_funding_cents),
 links jsonb not null check(jsonb_typeof(links)='array' and jsonb_array_length(links)<=20),
 assumptions text not null check(length(btrim(assumptions)) between 1 and 2000),
 notes text not null check(length(notes)<=2000),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index wealth_life_plans_owner_date on public.wealth_life_plans(user_id,target_date,id);
-- Replay records are private and never carry data into application audit events.
create table ecosystem_private.wealth_planning_commands (
 user_id uuid not null references auth.users(id) on delete cascade,
 token uuid not null, operation text not null, input jsonb not null, result uuid not null,
 primary key(user_id,token)
);
alter table ecosystem_private.wealth_planning_commands enable row level security;
revoke all on ecosystem_private.wealth_planning_commands from public,anon,authenticated;
grant all on ecosystem_private.wealth_planning_commands to service_role;
do $$ declare t text; begin
 foreach t in array array['wealth_goal_funding','wealth_life_plans'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy planning_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access(''wealth'',''wealth.read'')))',t);
  execute format('create trigger planning_audit after insert or update or delete on public.%I for each row execute function ecosystem_private.record_change()',t);
 end loop;
end $$;

create function ecosystem_private.validate_wealth_planning_links(p_links jsonb,p_goal boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; k text; ref uuid; actor uuid:=auth.uid(); valid boolean;
begin
 if p_links is null or jsonb_typeof(p_links)<>'array' then raise exception 'invalid links' using errcode='22023';end if;
 if jsonb_array_length(p_links)>20 then raise exception 'too many links' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_links) e group by e->>'kind',coalesce(e->>'id','') having count(*)>1) then raise exception 'duplicate links' using errcode='22023';end if;
 for item in select * from jsonb_array_elements(p_links) loop
  if jsonb_typeof(item)<>'object' or item-array['kind','id','planned_cents']<>'{}'::jsonb then raise exception 'invalid link fields' using errcode='22023';end if;
  k:=item->>'kind';ref:=nullif(item->>'id','')::uuid;valid:=false;
  if p_goal then
   if coalesce(item->>'planned_cents','')!~'^\d{1,15}$' or (item->>'planned_cents')::numeric>100000000000000 then raise exception 'invalid planned amount' using errcode='22023';end if;
   if k in ('manual','budget_surplus') then valid:=ref is null;
   elsif k='recurring' then valid:=exists(select 1 from public.wealth_recurring_schedules where id=ref and user_id=actor and status='active');
   elsif k='income' then valid:=exists(select 1 from public.wealth_entries where id=ref and user_id=actor and kind='income' and archived_at is null);
   end if;
  else
   if item ? 'planned_cents' then raise exception 'life links are context only' using errcode='22023';end if;
   if k='goal' then valid:=exists(select 1 from public.wealth_goals where id=ref and user_id=actor and archived_at is null);
   elsif k='debt' then valid:=exists(select 1 from public.wealth_entries where id=ref and user_id=actor and kind='liability' and archived_at is null);
   end if;
  end if;
  if k='portfolio' then valid:=exists(select 1 from public.wealth_portfolios where id=ref and user_id=actor and kind='real');end if;
  if not valid then raise exception 'planning source unavailable' using errcode='42501';end if;
 end loop;
end;$$;
revoke all on function ecosystem_private.validate_wealth_planning_links(jsonb,boolean) from public,anon,authenticated;

create function ecosystem_private.manage_wealth_planning(p_operation text,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); command_token uuid; record_id uuid; previous ecosystem_private.wealth_planning_commands; g public.wealth_goals; v bigint; keys text[]; f text;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('funding','life') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>24000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid planning command' using errcode='22023';end if;
 command_token:=(p_input->>'idempotency_key')::uuid;
 if command_token is null then raise exception 'missing command token' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-planning:'||actor::text,0));
 select * into previous from ecosystem_private.wealth_planning_commands where user_id=actor and token=command_token;
 if found then
  if previous.operation<>p_operation or previous.input<>p_input then raise exception 'command reused' using errcode='23505';end if;
  return previous.result;
 end if;
 keys:=array['id','version','idempotency_key','confirmed'];
 if p_operation='funding' then
  keys:=keys||array['priority','category','sources','notes'];
  if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
  record_id:=(p_input->>'id')::uuid;
  select * into g from public.wealth_goals where id=record_id and user_id=actor and archived_at is null for update;
  if not found then raise exception 'goal unavailable' using errcode='42501';end if;
  if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>g.version then raise exception 'goal changed' using errcode='PT409';end if;
  perform ecosystem_private.validate_wealth_planning_links(p_input->'sources',true);
  insert into public.wealth_goal_funding(id,user_id,priority,category,sources,notes)
   values(record_id,actor,p_input->>'priority',p_input->>'category',p_input->'sources',p_input->>'notes')
   on conflict(id) do update set priority=excluded.priority,category=excluded.category,sources=excluded.sources,notes=excluded.notes,updated_at=clock_timestamp();
  -- Funding and the existing goal editor share one CAS version; declared savings stay unchanged.
  update public.wealth_goals set version=version+1 where id=record_id and user_id=actor;
 else
  keys:=keys||array['title','event_type','target_date','scenario','status','upfront_cents','monthly_impact_cents','impact_months','current_funding_cents','monthly_capacity_cents','reserve_cents','reserve_draw_cents','links','assumptions','notes'];
  if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
  foreach f in array array['upfront_cents','monthly_impact_cents','current_funding_cents','monthly_capacity_cents','reserve_draw_cents'] loop
   if coalesce(p_input->>f,'')!~'^\d{1,15}$' then raise exception 'invalid cents' using errcode='22023';end if;
  end loop;
  if p_input->>'reserve_cents' is not null and (p_input->>'reserve_cents')!~'^\d{1,15}$' then raise exception 'invalid reserve' using errcode='22023';end if;
  if coalesce(p_input->>'impact_months','')!~'^\d{1,3}$' or coalesce(p_input->>'target_date','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid duration or date' using errcode='22023';end if;
  perform ecosystem_private.validate_wealth_planning_links(p_input->'links',false);
  record_id:=(p_input->>'id')::uuid;
  if record_id is not null then
   select version into v from public.wealth_life_plans where id=record_id and user_id=actor for update;
   if not found then raise exception 'plan unavailable' using errcode='42501';end if;
   if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>v then raise exception 'plan changed' using errcode='PT409';end if;
  else
   if p_input ? 'version' then raise exception 'new plan has no version' using errcode='22023';end if;
   record_id:=gen_random_uuid();v:=0;
  end if;
  insert into public.wealth_life_plans(id,user_id,title,event_type,target_date,scenario,status,upfront_cents,monthly_impact_cents,impact_months,current_funding_cents,monthly_capacity_cents,reserve_cents,reserve_draw_cents,links,assumptions,notes,version)
   values(record_id,actor,btrim(p_input->>'title'),p_input->>'event_type',(p_input->>'target_date')::date,p_input->>'scenario',p_input->>'status',(p_input->>'upfront_cents')::bigint,(p_input->>'monthly_impact_cents')::bigint,(p_input->>'impact_months')::int,(p_input->>'current_funding_cents')::bigint,(p_input->>'monthly_capacity_cents')::bigint,(p_input->>'reserve_cents')::bigint,(p_input->>'reserve_draw_cents')::bigint,p_input->'links',p_input->>'assumptions',p_input->>'notes',v+1)
   on conflict(id) do update set title=excluded.title,event_type=excluded.event_type,target_date=excluded.target_date,scenario=excluded.scenario,status=excluded.status,upfront_cents=excluded.upfront_cents,monthly_impact_cents=excluded.monthly_impact_cents,impact_months=excluded.impact_months,current_funding_cents=excluded.current_funding_cents,monthly_capacity_cents=excluded.monthly_capacity_cents,reserve_cents=excluded.reserve_cents,reserve_draw_cents=excluded.reserve_draw_cents,links=excluded.links,assumptions=excluded.assumptions,notes=excluded.notes,version=excluded.version,updated_at=clock_timestamp();
 end if;
 insert into ecosystem_private.wealth_planning_commands values(actor,command_token,p_operation,p_input,record_id);
 return record_id;
end;$$;
revoke all on function ecosystem_private.manage_wealth_planning(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_planning(text,jsonb) to authenticated;
create function public.manage_wealth_planning(p_operation text,p_input jsonb) returns uuid
language sql security invoker set search_path='' as $$ select ecosystem_private.manage_wealth_planning(p_operation,p_input); $$;
revoke all on function public.manage_wealth_planning(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_wealth_planning(text,jsonb) to authenticated;
commit;
