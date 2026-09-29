-- New forward-only migration. Apply to the approved staging first; never replay history.
begin;
alter table public.wealth_entries
 add column archived_at timestamptz,
 add column updated_at timestamptz not null default now(),
 add column version bigint not null default 1 check (version between 1 and 9007199254740991);
alter table public.wealth_goals
 add column archived_at timestamptz,
 add column updated_at timestamptz not null default now(),
 add column version bigint not null default 1 check (version between 1 and 9007199254740991),
 add column status text not null default 'active' check (status in ('active','paused','completed')),
 add constraint wealth_goal_completed_funded check (status <> 'completed' or saved_cents >= target_cents);

create function ecosystem_private.guard_wealth_lifecycle() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare old_values jsonb; new_values jsonb;
begin
 if tg_op = 'INSERT' then
  new.version := 1; new.archived_at := null;
 else
  if new.user_id is distinct from old.user_id then raise exception 'row-level security: owner is immutable' using errcode='42501'; end if;
  if new.id is distinct from old.id or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at then
   raise exception 'immutable record identity' using errcode='42501';
  end if;
  old_values := to_jsonb(old) - array['archived_at','updated_at','version'];
  new_values := to_jsonb(new) - array['archived_at','updated_at','version'];
  if (old.archived_at is not null or new.archived_at is distinct from old.archived_at) and old_values is distinct from new_values then
   raise exception 'restore before editing; archive transitions cannot change financial values' using errcode='23514';
  end if;
  if old.archived_at is not null and new.archived_at is not null then new.archived_at := old.archived_at;
  elsif old.archived_at is null and new.archived_at is not null then new.archived_at := clock_timestamp(); end if;
  new.version := old.version + 1;
 end if;
 new.updated_at := clock_timestamp();
 return new;
end;
$$;
revoke all on function ecosystem_private.guard_wealth_lifecycle() from public, anon, authenticated;
create trigger wealth_lifecycle_guard before insert or update on public.wealth_entries for each row execute function ecosystem_private.guard_wealth_lifecycle();
create trigger wealth_lifecycle_guard before insert or update on public.wealth_goals for each row execute function ecosystem_private.guard_wealth_lifecycle();
create index wealth_entries_active_owner_date on public.wealth_entries(user_id,financial_date desc,id) where archived_at is null;
create index wealth_goals_active_owner_date on public.wealth_goals(user_id,target_date,id) where archived_at is null;

-- Existing audit contract is retained; archive/restore and goal completion get semantic names.
create or replace function ecosystem_private.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare record_key text; event_name text; before_row jsonb; after_row jsonb;
begin
 before_row := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
 after_row := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
 record_key := coalesce(after_row->>'id',after_row->>'user_id',before_row->>'id',before_row->>'user_id');
 event_name := tg_table_name || '.' || lower(tg_op);
 if tg_op = 'UPDATE' and tg_table_name in ('wealth_entries','wealth_goals') then
  if (before_row->>'archived_at') is null and (after_row->>'archived_at') is not null then
   event_name := case when tg_table_name='wealth_entries' then 'wealth.entry.archived' else 'wealth.goal.archived' end;
  elsif (before_row->>'archived_at') is not null and (after_row->>'archived_at') is null then
   event_name := case when tg_table_name='wealth_entries' then 'wealth.entry.restored' else 'wealth.goal.restored' end;
  elsif tg_table_name='wealth_goals' and before_row->>'status' is distinct from 'completed' and after_row->>'status'='completed' then
   event_name := 'wealth.goal.completed';
  end if;
 end if;
 insert into public.ecosystem_audit_events(actor_id,event_type,entity_id) values(auth.uid(),event_name,record_key);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function ecosystem_private.record_change() from public, anon, authenticated;

create function public.wealth_summary(p_month date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; actor uuid := auth.uid(); month_start date := date_trunc('month',p_month)::date;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501'; end if;
 if p_month is null or p_month < date '1900-01-01' or p_month > date '2200-12-31' then raise exception 'invalid month' using errcode='22023'; end if;
 with owned as materialized (
  select kind,category,amount_cents,financial_date from public.wealth_entries where user_id=actor and archived_at is null
 ), totals as (
  select count(*) as count,
   coalesce(sum(amount_cents) filter(where kind='income' and financial_date>=month_start and financial_date<month_start+interval '1 month'),0) as income,
   coalesce(sum(amount_cents) filter(where kind='expense' and financial_date>=month_start and financial_date<month_start+interval '1 month'),0) as expenses,
   coalesce(sum(amount_cents) filter(where kind='asset'),0) as assets,
   coalesce(sum(amount_cents) filter(where kind='liability'),0) as liabilities from owned
 ), goals as (
  select count(*) as count,count(*) filter(where status='completed') as completed,
   coalesce(sum(target_cents),0) as target,coalesce(sum(least(saved_cents,target_cents)),0) as saved,
   coalesce(sum(monthly_contribution_cents) filter(where status='active'),0) as contributions
  from public.wealth_goals where user_id=actor and archived_at is null
 ), months as (
  select m::date as month,coalesce(sum(e.amount_cents) filter(where e.kind='income'),0) as income,
   coalesce(sum(e.amount_cents) filter(where e.kind='expense'),0) as expenses
  from generate_series(month_start-interval '11 months',month_start,interval '1 month') m
  left join owned e on e.financial_date>=m and e.financial_date<m+interval '1 month' and e.kind in ('income','expense') group by m
 ), categories as (
  select kind,category,sum(amount_cents) as amount from owned
  where financial_date>=month_start and financial_date<month_start+interval '1 month' and kind in ('income','expense') group by kind,category
 )
 select jsonb_build_object('currency','BRL','month',to_char(month_start,'YYYY-MM'),
  'income',t.income::text,'expenses',t.expenses::text,'assets',t.assets::text,'liabilities',t.liabilities::text,
  'netWorth',(t.assets-t.liabilities)::text,'cashFlow',(t.income-t.expenses)::text,'entryCount',t.count::text,
  'goalCount',g.count::text,'completedGoals',g.completed::text,'goalTarget',g.target::text,'goalSaved',g.saved::text,'goalContributions',g.contributions::text,
  'reserveTarget',coalesce((select monthly_budget_cents::numeric*emergency_months from public.wealth_profiles where user_id=actor),0)::text,
  'contributionCapacity',coalesce((select greatest(monthly_income_cents::numeric-monthly_budget_cents,0) from public.wealth_profiles where user_id=actor),0)::text,
  'months',(select jsonb_agg(jsonb_build_object('month',to_char(month,'YYYY-MM'),'income',income::text,'expenses',expenses::text,'cashFlow',(income-expenses)::text) order by month) from months),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'category',category,'amount',amount::text) order by kind,category) from categories),'[]'::jsonb)
 ) into result from totals t cross join goals g;
 return result;
end;
$$;
revoke all on function public.wealth_summary(date) from public, anon;
grant execute on function public.wealth_summary(date) to authenticated;
comment on function public.wealth_summary(date) is 'Own active records only; RLS/invoker, exact integer-cent text totals, independent of pagination. No market valuations.';
commit;
