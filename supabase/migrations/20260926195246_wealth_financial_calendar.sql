-- Calendar is a read model. No payment state, second balance, clock or external call.
begin;
create table public.wealth_bill_details (
 id uuid primary key references public.wealth_recurring_schedules(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 bill_type text not null check(bill_type in ('subscription','utility','rent','salary','installment','contribution','income','expense','renewal')),
 provider text not null default '' check(length(provider)<=120),
 predecessor_id uuid references public.wealth_recurring_schedules(id) on delete set null,
 reviewed_at timestamptz not null default now(),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 check(predecessor_id is distinct from id)
);
create index wealth_bill_details_owner on public.wealth_bill_details(user_id,id);
create unique index wealth_bill_details_predecessor on public.wealth_bill_details(predecessor_id) where predecessor_id is not null;
alter table public.wealth_bill_details enable row level security;
revoke all on public.wealth_bill_details from public,anon,authenticated;
grant select on public.wealth_bill_details to authenticated;
grant all on public.wealth_bill_details to service_role;
create policy wealth_bill_details_read on public.wealth_bill_details for select to authenticated
 using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access('wealth','wealth.read')));
create trigger wealth_bill_details_audit after insert or update or delete on public.wealth_bill_details
 for each row execute function ecosystem_private.record_change();

create function ecosystem_private.save_wealth_bill(p_id uuid,p_version bigint,p_type text,p_provider text,p_predecessor uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); s public.wealth_recurring_schedules; old public.wealth_recurring_schedules; d public.wealth_bill_details; result bigint;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 -- Metadata never changes a schedule or obtains a job lock. Serialize revisions per owner.
 perform pg_advisory_xact_lock(hashtextextended('wealth-bill:'||actor::text,0));
 select * into s from public.wealth_recurring_schedules where id=p_id and user_id=actor;
 if not found then raise exception 'schedule unavailable' using errcode='42501';end if;
 select * into d from public.wealth_bill_details where id=p_id and user_id=actor;
 if p_version is null or p_version<>coalesce(d.version,0) then raise exception 'bill changed' using errcode='PT409';end if;
 if p_predecessor is not null then
  select * into old from public.wealth_recurring_schedules where id=p_predecessor and user_id=actor;
  if not found or old.status<>'cancelled' or old.created_at>=s.created_at or old.kind<>s.kind or old.currency<>s.currency
   or old.frequency<>s.frequency or old.interval_count<>s.interval_count then raise exception 'incomparable predecessor' using errcode='22023';end if;
 end if;
 insert into public.wealth_bill_details(id,user_id,bill_type,provider,predecessor_id) values(p_id,actor,p_type,btrim(p_provider),p_predecessor)
 on conflict(id) do update set bill_type=excluded.bill_type,provider=excluded.provider,predecessor_id=excluded.predecessor_id,reviewed_at=clock_timestamp(),version=wealth_bill_details.version+1
 returning version into result;
 return result;
end;$$;
revoke all on function ecosystem_private.save_wealth_bill(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function ecosystem_private.save_wealth_bill(uuid,bigint,text,text,uuid) to authenticated;
create function public.save_wealth_bill(p_id uuid,p_version bigint,p_type text,p_provider text,p_predecessor uuid default null) returns bigint
language sql security invoker set search_path='' as $$ select ecosystem_private.save_wealth_bill(p_id,p_version,p_type,p_provider,p_predecessor); $$;
revoke all on function public.save_wealth_bill(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.save_wealth_bill(uuid,bigint,text,text,uuid) to authenticated;

-- Jump to the requested period rather than expanding all dates since the anchor.
-- At most 368 candidates per daily schedule; month/year use their original anchor.
create function ecosystem_private.wealth_schedule_dates(p_id uuid,p_from date,p_to date)
returns table(occurrence_index integer,financial_date date)
language plpgsql stable security invoker set search_path='' as $$
declare s public.wealth_recurring_schedules; lo integer; hi integer; a integer; b integer;
begin
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2200-12-31' or p_to<p_from or p_to-p_from>366 then raise exception 'invalid date window' using errcode='22023';end if;
 select * into s from public.wealth_recurring_schedules where id=p_id and user_id=auth.uid();
 if not found then return;end if;
 if s.frequency in ('daily','weekly') then
  a:=(p_from-s.start_date)/(s.interval_count*case when s.frequency='weekly' then 7 else 1 end);
  b:=(p_to-s.start_date)/(s.interval_count*case when s.frequency='weekly' then 7 else 1 end);
 else
  a:=((extract(year from p_from)::int-extract(year from s.start_date)::int)*12+extract(month from p_from)::int-extract(month from s.start_date)::int)/(s.interval_count*case when s.frequency='yearly' then 12 else 1 end);
  b:=((extract(year from p_to)::int-extract(year from s.start_date)::int)*12+extract(month from p_to)::int-extract(month from s.start_date)::int)/(s.interval_count*case when s.frequency='yearly' then 12 else 1 end);
 end if;
 lo:=greatest(0,a-1);hi:=least(200000,coalesce(s.max_occurrences-1,200000),b+1);
 return query select i,dt from generate_series(lo,hi) i cross join lateral
 (select ecosystem_private.wealth_recurrence_date(s.start_date,s.frequency,s.interval_count,i) dt) d
 where dt between p_from and p_to and (s.end_date is null or dt<=s.end_date);
end;$$;
revoke all on function ecosystem_private.wealth_schedule_dates(uuid,date,date) from public,anon,authenticated;
grant execute on function ecosystem_private.wealth_schedule_dates(uuid,date,date) to authenticated;
-- The existing pure date helper takes caller-supplied values and reads no data.
grant execute on function ecosystem_private.wealth_recurrence_date(date,text,integer,integer) to authenticated;

create index wealth_portfolio_transactions_calendar on public.wealth_portfolio_transactions(user_id,financial_date,id);
create function public.wealth_calendar(p_from date,p_to date,p_page integer default 1,p_source text default '',p_direction text default '',p_portfolio uuid default null,p_status text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); zone text; today date; result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2200-12-31' or p_to<p_from or p_to-p_from>366 or p_page is null or p_page not between 1 and 100000
 or p_source is null or p_source not in ('','entry','recurrence','debt','goal','holding','portfolio') or p_direction is null or p_direction not in ('','income','expense','neutral')
 or p_status is null or p_status not in ('','REALIZED','SCHEDULED','RECURRING','EXPECTED','HYPOTHETICAL','OVERDUE','CANCELLED') then raise exception 'invalid calendar filters' using errcode='22023';end if;
 select timezone into zone from public.wealth_profiles where user_id=actor;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
 today:=(now() at time zone zone)::date;
 with events as (
  select 'entry:'||e.id as event_id,e.id source_id,'entry'::text source_type,e.kind event_type,e.financial_date event_at,zone timezone,
   case when e.valuation_status='NOT_AVAILABLE' then null else e.amount_cents::text end amount,e.currency,
   case when e.financial_date>today then 'SCHEDULED' else 'REALIZED' end status,'DECLARED'::text certainty,
   case when e.kind in ('income','expense') then e.kind else 'neutral' end direction,e.title,h.portfolio_id,
   case when h.id is not null then '/apps/wealth/carteiras/'||h.portfolio_id||'?holding='||h.id else '/apps/wealth/lancamentos/'||e.id end href,
   jsonb_build_object('scope','personal','recurring',exists(select 1 from public.wealth_recurrence_occurrences o where o.entry_id=e.id),'cash',e.kind in ('income','expense')) context
  from public.wealth_entries e left join public.wealth_holdings h on h.id=e.id
  where e.user_id=actor and e.archived_at is null and e.financial_date between p_from and p_to
  union all
  select 'recurrence:'||s.id||':'||d.occurrence_index,s.id,'recurrence',s.kind,d.financial_date,s.timezone,s.amount_cents::text,s.currency,
   case when (d.financial_date+time '12:00') at time zone s.timezone<now() then 'OVERDUE' else 'RECURRING' end,'SCHEDULE',s.kind,s.title,null,
   '/apps/wealth/recorrencias?schedule='||s.id,jsonb_build_object('scope','personal','recurring',true,'cash',false,'index',d.occurrence_index)
  from public.wealth_recurring_schedules s cross join lateral ecosystem_private.wealth_schedule_dates(s.id,p_from,p_to) d
  where s.user_id=actor and s.status='active' and d.occurrence_index>=s.next_index
   and not exists(select 1 from public.wealth_recurrence_occurrences o where o.schedule_id=s.id and o.occurrence_index=d.occurrence_index)
  union all
  select 'cancelled:'||s.id,s.id,'recurrence',s.kind,s.next_date,s.timezone,s.amount_cents::text,s.currency,'CANCELLED','SCHEDULE',s.kind,s.title,null,
   '/apps/wealth/recorrencias?schedule='||s.id,jsonb_build_object('scope','personal','cash',false,'recurring',true)
  from public.wealth_recurring_schedules s where s.user_id=actor and s.status='cancelled' and s.next_date between p_from and p_to
  union all
  select 'debt:'||e.id,e.id,'debt','due',d.next_due_date,zone,d.minimum_cents::text,e.currency,
   case when d.next_due_date<today then 'OVERDUE' else 'EXPECTED' end,'DECLARED','expense',e.title,null,
   '/apps/wealth/dividas/'||e.id,jsonb_build_object('scope','personal','cash',false,'meaning','declared_minimum')
  from public.wealth_debt_terms d join public.wealth_entries e on e.id=d.id where e.user_id=actor and e.archived_at is null and e.amount_cents>0 and d.next_due_date between p_from and p_to
  union all
  select 'goal:'||g.id,g.id,'goal','milestone',g.target_date,zone,greatest(0,g.target_cents-g.saved_cents)::text,g.currency,
   case when g.target_date<today then 'OVERDUE' else 'EXPECTED' end,'DECLARED','neutral',g.title,null,
   '/apps/wealth/metas/'||g.id,jsonb_build_object('scope','personal','cash',false,'meaning','goal_gap')
  from public.wealth_goals g where g.user_id=actor and g.archived_at is null and g.status='active' and g.target_date between p_from and p_to
  union all
  select 'holding:'||h.id,h.id,'holding','maturity',h.maturity,zone,null,'BRL','EXPECTED','UNKNOWN','neutral',e.title,h.portfolio_id,
   '/apps/wealth/carteiras/'||h.portfolio_id||'?holding='||h.id,jsonb_build_object('scope','personal','cash',false,'meaning','no_redemption_value')
  from public.wealth_holdings h join public.wealth_entries e on e.id=h.id where h.user_id=actor and e.archived_at is null and h.quantity>0 and h.maturity between p_from and p_to
  union all
  select 'portfolio:'||t.id,t.id,'portfolio',t.type,t.financial_date,zone,t.amount_cents::text,'BRL',
   case when t.financial_date>today then 'SCHEDULED' else 'REALIZED' end,'DECLARED',
   case when t.type in ('income','dividend','interest','sell','withdrawal') then 'income' when t.type in ('buy','contribution','fee','tax') then 'expense' else 'neutral' end,
   e.title,h.portfolio_id,'/apps/wealth/carteiras/'||h.portfolio_id||'?holding='||h.id,jsonb_build_object('scope','personal','cash',false,'meaning','investment_ledger')
  from public.wealth_portfolio_transactions t join public.wealth_holdings h on h.id=t.holding_id join public.wealth_entries e on e.id=h.id
  where t.user_id=actor and t.financial_date between p_from and p_to
 ), filtered as materialized (
  select * from events where (p_source='' or source_type=p_source) and (p_direction='' or direction=p_direction)
   and (p_portfolio is null or portfolio_id=p_portfolio) and (p_status='' or status=p_status)
 ), numbered as (select * from filtered order by event_at,event_id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('from',p_from,'to',p_to,'localDate',today,'timezone',zone,'count',(select count(*)::text from filtered),'page',p_page,
  'days',coalesce((select jsonb_agg(jsonb_build_object('date',d.event_at,'count',d.n::text) order by d.event_at) from (select event_at,count(*) n from filtered group by event_at) d),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(n) order by event_at,event_id) from numbered n),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.wealth_calendar(date,date,integer,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.wealth_calendar(date,date,integer,text,text,uuid,text) to authenticated;

create function public.wealth_bills(p_month date,p_page integer default 1,p_status text default '',p_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); zone text; today date; last_date date; result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 if p_month is null or p_month<date '1900-01-01' or p_month>date '2199-12-01' or extract(day from p_month)<>1 or p_page is null or p_page not between 1 and 100000 or p_status is null or p_status not in ('','active','paused','cancelled','completed') then raise exception 'invalid bill filters' using errcode='22023';end if;
 select timezone into zone from public.wealth_profiles where user_id=actor;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
 today:=(now() at time zone zone)::date;last_date:=(today+interval '1 year')::date-1;
 with all_bills as materialized (
  select s.*,d.bill_type,d.provider,d.predecessor_id,d.reviewed_at,coalesce(d.version,0) detail_version,
   case when old.id is not null then (s.amount_cents-old.amount_cents)::text end price_change,
   case when old.id is not null then old.amount_cents::text end previous_amount,
   coalesce(annual.n,0)*s.amount_cents::numeric annual_amount,coalesce(monthly.n,0)*s.amount_cents::numeric month_amount,
   case when d.provider<>'' and s.status='active' then ((count(*) filter(where s.status='active') over(partition by lower(d.provider),d.bill_type,s.kind,s.frequency,s.interval_count,s.amount_cents))-1)::text else '0' end duplicate_candidates
  from public.wealth_recurring_schedules s left join public.wealth_bill_details d on d.id=s.id
  left join public.wealth_recurring_schedules old on old.id=d.predecessor_id and old.user_id=actor
  left join lateral(select count(*) n from ecosystem_private.wealth_schedule_dates(s.id,today,last_date)) annual on s.status='active'
  left join lateral(select count(*) n from ecosystem_private.wealth_schedule_dates(s.id,p_month,(p_month+interval '1 month')::date-1)) monthly on s.status='active'
  where s.user_id=actor
 ), selected as materialized(select * from all_bills where (p_status='' or status=p_status) and (p_id is null or id=p_id)),
 page_rows as(select * from selected order by case status when 'active' then 0 when 'paused' then 1 else 2 end,next_date,id limit 25 offset (p_page-1)*25)
 select jsonb_build_object('today',today,'annualEnd',last_date,'month',p_month,'count',(select count(*)::text from selected),'page',p_page,
  'totals',(select jsonb_build_object('active',count(*) filter(where status='active')::text,'paused',count(*) filter(where status='paused')::text,'cancelled',count(*) filter(where status='cancelled')::text,
    'annualExpense',coalesce(sum(annual_amount) filter(where kind='expense'),0)::text,'annualIncome',coalesce(sum(annual_amount) filter(where kind='income'),0)::text,
    'monthExpense',coalesce(sum(month_amount) filter(where kind='expense'),0)::text,'monthIncome',coalesce(sum(month_amount) filter(where kind='income'),0)::text) from all_bills),
  'bills',coalesce((select jsonb_agg((to_jsonb(r)-'amount_cents'-'annual_amount'-'month_amount'-'user_id'-'idempotency_key'-'source_entry_id')||jsonb_build_object('amount_cents',r.amount_cents::text,'annual_amount',r.annual_amount::text,'month_amount',r.month_amount::text)) from page_rows r),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.wealth_bills(date,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.wealth_bills(date,integer,text,uuid) to authenticated;
commit;
