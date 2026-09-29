-- Personal insurance declarations. No underwriting, purchase, payment or insurer connection.
begin;
create table public.wealth_protection_policies (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),
 category text not null check(category in ('life','health','home','vehicle','liability','other')),
 insurer text not null default '' check(length(insurer)<=120),reference text not null default '' check(length(reference)<=160),
 coverage_cents bigint check(coverage_cents between 0 and 100000000000000),deductible_cents bigint check(deductible_cents between 0 and 100000000000000),
 premium_cents bigint check(premium_cents between 0 and 100000000000000),
 premium_period text not null check(premium_period in ('unknown','one_off','monthly','quarterly','yearly')),
 starts_on date check(starts_on between date '1900-01-01' and date '2200-12-31'),ends_on date check(ends_on between date '1900-01-01' and date '2200-12-31'),
 check(starts_on is null or ends_on is null or ends_on>=starts_on),
 status text not null default 'declared' check(status in ('declared','cancelled')),
 -- Context IDs retain history when the original is unavailable; owner is verified on writes AND reads.
 asset_id uuid,document_id uuid,schedule_id uuid,
 notes text not null default '' check(length(notes)<=2000),
 archived_at timestamptz,version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index wealth_protection_owner_end on public.wealth_protection_policies(user_id,ends_on,id);
alter table public.wealth_protection_policies enable row level security;
revoke all on public.wealth_protection_policies from public,anon,authenticated;
grant select on public.wealth_protection_policies to authenticated;
grant all on public.wealth_protection_policies to service_role;
create policy protection_owner_read on public.wealth_protection_policies for select to authenticated
 using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access('wealth','wealth.read')));
create trigger protection_audit after insert or update or delete on public.wealth_protection_policies for each row execute function ecosystem_private.record_change();
create table ecosystem_private.wealth_protection_commands (
 user_id uuid not null references auth.users(id) on delete cascade,token uuid not null,operation text not null,
 input_hash text not null,result_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,token)
);
alter table ecosystem_private.wealth_protection_commands enable row level security;
revoke all on ecosystem_private.wealth_protection_commands from public,anon,authenticated;
grant all on ecosystem_private.wealth_protection_commands to service_role;

create function ecosystem_private.manage_wealth_protection(p_operation text,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); command_token uuid; fingerprint text; receipt ecosystem_private.wealth_protection_commands;
 item public.wealth_protection_policies; record_id uuid; current_version bigint:=0; f text; asset uuid; document uuid; schedule uuid;
 keys text[]:=array['id','version','idempotency_key','confirmed'];
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'protection access denied' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('save','archive','restore') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>9000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid protection command' using errcode='22023';end if;
 if p_operation='save' then keys:=keys||array['title','category','insurer','reference','coverage_cents','deductible_cents','premium_cents','premium_period','starts_on','ends_on','status','asset_id','document_id','schedule_id','notes'];end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 command_token:=(p_input->>'idempotency_key')::uuid;if command_token is null then raise exception 'missing token' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-protection:'||actor::text,0));
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into receipt from ecosystem_private.wealth_protection_commands where user_id=actor and token=command_token;
 if found then
  if receipt.operation<>p_operation or receipt.input_hash<>fingerprint then raise exception 'command reused' using errcode='23505';end if;
  return receipt.result_id;
 end if;
 record_id:=(p_input->>'id')::uuid;
 if record_id is not null then
  select * into item from public.wealth_protection_policies where id=record_id and user_id=actor for update;
  if not found then raise exception 'policy unavailable' using errcode='42501';end if;
  if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>item.version then raise exception 'policy changed' using errcode='PT409';end if;
  current_version:=item.version;
 else
  if p_operation<>'save' or p_input ? 'version' then raise exception 'invalid new policy' using errcode='22023';end if;
  if (select count(*) from public.wealth_protection_policies where user_id=actor)>=1000 then raise exception 'policy capacity reached' using errcode='54000';end if;
  record_id:=gen_random_uuid();
 end if;
 if p_operation='save' then
  if item.archived_at is not null then raise exception 'restore before editing' using errcode='PT409';end if;
  foreach f in array array['coverage_cents','deductible_cents','premium_cents'] loop
   if p_input->>f is not null and (p_input->>f)!~'^\d{1,15}$' then raise exception 'invalid cents' using errcode='22023';end if;
  end loop;
  foreach f in array array['starts_on','ends_on'] loop
   if p_input->>f is not null and (p_input->>f)!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date' using errcode='22023';end if;
  end loop;
  asset:=(p_input->>'asset_id')::uuid;document:=(p_input->>'document_id')::uuid;schedule:=(p_input->>'schedule_id')::uuid;
  if asset is not null and not exists(select 1 from public.wealth_entries where id=asset and user_id=actor and kind='asset' and archived_at is null) then raise exception 'asset unavailable' using errcode='42501';end if;
  if document is not null and not exists(select 1 from public.wealth_documents where id=document and user_id=actor and status='active') then raise exception 'document unavailable' using errcode='42501';end if;
  if schedule is not null and not exists(select 1 from public.wealth_recurring_schedules where id=schedule and user_id=actor and kind='expense') then raise exception 'schedule unavailable' using errcode='42501';end if;
  insert into public.wealth_protection_policies(id,user_id,title,category,insurer,reference,coverage_cents,deductible_cents,premium_cents,premium_period,starts_on,ends_on,status,asset_id,document_id,schedule_id,notes,version)
   values(record_id,actor,btrim(p_input->>'title'),p_input->>'category',btrim(coalesce(p_input->>'insurer','')),btrim(coalesce(p_input->>'reference','')),(p_input->>'coverage_cents')::bigint,(p_input->>'deductible_cents')::bigint,(p_input->>'premium_cents')::bigint,p_input->>'premium_period',(p_input->>'starts_on')::date,(p_input->>'ends_on')::date,p_input->>'status',asset,document,schedule,coalesce(p_input->>'notes',''),current_version+1)
   on conflict(id) do update set title=excluded.title,category=excluded.category,insurer=excluded.insurer,reference=excluded.reference,coverage_cents=excluded.coverage_cents,deductible_cents=excluded.deductible_cents,premium_cents=excluded.premium_cents,premium_period=excluded.premium_period,starts_on=excluded.starts_on,ends_on=excluded.ends_on,status=excluded.status,asset_id=excluded.asset_id,document_id=excluded.document_id,schedule_id=excluded.schedule_id,notes=excluded.notes,version=excluded.version,updated_at=clock_timestamp();
 else
  if (p_operation='archive')=(item.archived_at is not null) then raise exception 'state changed' using errcode='PT409';end if;
  update public.wealth_protection_policies set archived_at=case when p_operation='archive' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp() where id=record_id and user_id=actor;
 end if;
 insert into ecosystem_private.wealth_protection_commands(user_id,token,operation,input_hash,result_id) values(actor,command_token,p_operation,fingerprint,record_id);
 return record_id;
end $$;
revoke all on function ecosystem_private.manage_wealth_protection(text,jsonb) from public,anon;
grant execute on function ecosystem_private.manage_wealth_protection(text,jsonb) to authenticated;
create function public.manage_wealth_protection(p_operation text,p_input jsonb) returns uuid
language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_protection(p_operation,p_input)$$;
revoke all on function public.manage_wealth_protection(text,jsonb) from public,anon;
grant execute on function public.manage_wealth_protection(text,jsonb) to authenticated;

create function public.wealth_shield_overview(p_date date,p_page integer default 1,p_filter text default 'current',p_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'shield access denied' using errcode='42501';end if;
 if p_date is null or p_date not between date '1900-01-01' and date '2200-12-31' or p_page is null or p_page not between 1 and 100000 or p_filter is null or p_filter not in ('current','ending','expired','unknown','cancelled','archived') then raise exception 'invalid filters' using errcode='22023';end if;
 with owned as materialized (
  select p.*,case when p.archived_at is not null then 'archived' when p.status='cancelled' then 'cancelled' when p.ends_on<p_date then 'expired'
   when p.starts_on>p_date then 'future' when p.starts_on is null or p.ends_on is null then 'unknown' else 'informed_term' end temporal,
   case when e.id is not null then jsonb_build_object('id',e.id,'title',e.title,'archived',e.archived_at is not null) else null end asset,
   case when d.id is not null then jsonb_build_object('id',d.id,'title',d.title) else null end document,
   case when s.id is not null then jsonb_build_object('id',s.id,'title',s.title,'status',s.status) else null end schedule
  from public.wealth_protection_policies p
  left join public.wealth_entries e on e.id=p.asset_id and e.user_id=actor and e.kind='asset'
  left join public.wealth_documents d on d.id=p.document_id and d.user_id=actor and d.status='active'
  left join public.wealth_recurring_schedules s on s.id=p.schedule_id and s.user_id=actor and s.kind='expense'
  where p.user_id=actor
 ), projected as materialized (
  select o.*,to_jsonb(o)||jsonb_build_object('coverage_cents',o.coverage_cents::text,'deductible_cents',o.deductible_cents::text,'premium_cents',o.premium_cents::text) value from owned o
 ), filtered as materialized (
  select * from projected where case p_filter when 'current' then archived_at is null when 'archived' then archived_at is not null
   when 'ending' then archived_at is null and status='declared' and ends_on between p_date and p_date+30
   when 'expired' then temporal='expired' when 'unknown' then archived_at is null and status='declared' and (starts_on is null or ends_on is null or coverage_cents is null)
   when 'cancelled' then archived_at is null and status='cancelled' end
 ) select jsonb_build_object('date',p_date,'provider_status','NOT_CONFIGURED','count',(select count(*)::text from filtered),
  'summary',jsonb_build_object('current',(select count(*)::text from owned where archived_at is null),
   'ending',(select count(*)::text from owned where archived_at is null and status='declared' and ends_on between p_date and p_date+30),
   'expired',(select count(*)::text from owned where temporal='expired'),
   'unknown',(select count(*)::text from owned where archived_at is null and status='declared' and (starts_on is null or ends_on is null or coverage_cents is null)),
   'missing_document',(select count(*)::text from owned where archived_at is null and status='declared' and document is null)),
  'policies',coalesce((select jsonb_agg(f.value order by f.ends_on nulls last,f.id) from (select * from filtered order by ends_on nulls last,id limit 25 offset (p_page-1)*25) f),'[]'::jsonb),
  'selected',(select value from projected where id=p_id)
 ) into result;
 return result;
end $$;
revoke all on function public.wealth_shield_overview(date,integer,text,uuid) from public,anon;
grant execute on function public.wealth_shield_overview(date,integer,text,uuid) to authenticated;
commit;
