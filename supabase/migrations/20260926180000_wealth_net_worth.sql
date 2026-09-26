-- Forward only. Declared positions, no quotes, historical reconstruction or scheduled jobs.
begin;
alter table public.wealth_entries
 add column position_class text,
 add column liquidity text not null default 'unknown',
 add constraint wealth_position_class_check check (
  position_class is null or
  (kind='asset' and position_class in ('cash','checking','savings','investment','fixed_income','stock','fund','ETF','FII','pension','crypto','real_estate','vehicle','business_equity','receivable','other')) or
  (kind='liability' and position_class in ('credit_card','personal_loan','payroll_loan','vehicle_financing','mortgage','tax','installment','other_debt'))
 ),
 add constraint wealth_liquidity_check check (liquidity in ('immediate','short_term','medium_term','illiquid','unknown') and (kind in ('asset','liability') or liquidity='unknown'));

create function public.wealth_net_worth() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; zone text;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 select timezone into zone from public.wealth_profiles where user_id=actor;
 zone:=coalesce(zone,'America/Sao_Paulo');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
 with owned as materialized (
  select id,title,kind,amount_cents,coalesce(position_class,'unclassified') as class,liquidity
  from public.wealth_entries where user_id=actor and archived_at is null and kind in ('asset','liability')
 ), totals as (
  select count(*) as count,coalesce(sum(amount_cents) filter(where kind='asset'),0) as assets,
   coalesce(sum(amount_cents) filter(where kind='liability'),0) as liabilities from owned
 ), classes as (
  select kind,class,sum(amount_cents) as amount,count(*) as count from owned group by kind,class
 ), liquidity_groups as (
  select liquidity,sum(amount_cents) as amount,count(*) as count from owned where kind='asset' group by liquidity
 ), largest as (
  select *,row_number() over(partition by kind order by amount_cents desc,id) as rank from owned
 )
 select jsonb_build_object('currency','BRL','source','owner_declared','capturedAt',statement_timestamp(),
  'timezone',zone,'localDate',(statement_timestamp() at time zone zone)::date,
  'assets',assets::text,'liabilities',liabilities::text,'netWorth',(assets-liabilities)::text,'positionCount',count::text,
  'classes',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'class',class,'amount',amount::text,'count',count::text) order by kind,class) from classes),'[]'::jsonb),
  'liquidity',coalesce((select jsonb_agg(jsonb_build_object('liquidity',liquidity,'amount',amount::text,'count',count::text) order by liquidity) from liquidity_groups),'[]'::jsonb),
  'largest',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'kind',kind,'amount',amount_cents::text,'class',class,'liquidity',liquidity) order by kind,rank) from largest where rank<=10),'[]'::jsonb)
 ) into result from totals;
 return result;
end;$$;
revoke all on function public.wealth_net_worth() from public,anon,authenticated;
grant execute on function public.wealth_net_worth() to authenticated;

create function public.classify_wealth_position(p_entry_id uuid,p_version bigint,p_class text,p_liquidity text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 update public.wealth_entries set position_class=nullif(p_class,'unclassified'),liquidity=p_liquidity
 where id=p_entry_id and user_id=auth.uid() and kind in ('asset','liability') and archived_at is null and version=p_version;
 if not found then raise exception 'Position version conflict or unavailable' using errcode='PT409';end if;
 return true;
end;$$;
revoke all on function public.classify_wealth_position(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.classify_wealth_position(uuid,bigint,text,text) to authenticated;

create table public.wealth_net_worth_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 idempotency_key uuid not null,
 captured_at timestamptz not null,
 local_date date not null,
 timezone text not null,
 source text not null check(source='owner_declared'),
 composition jsonb not null check(jsonb_typeof(composition)='object'),
 unique(user_id,idempotency_key)
);
create index wealth_net_worth_snapshots_owner_date on public.wealth_net_worth_snapshots(user_id,captured_at desc,id);
alter table public.wealth_net_worth_snapshots enable row level security;
revoke all on public.wealth_net_worth_snapshots from anon,authenticated;
grant select on public.wealth_net_worth_snapshots to authenticated;
grant all on public.wealth_net_worth_snapshots to service_role;
create policy wealth_snapshot_read on public.wealth_net_worth_snapshots for select to authenticated
 using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access('wealth','wealth.read')));
create trigger wealth_snapshot_audit after insert or delete on public.wealth_net_worth_snapshots for each row execute function ecosystem_private.record_change();

create function ecosystem_private.capture_wealth_net_worth(p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid; snapshot jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 if p_idempotency_key is null then raise exception 'Idempotency required' using errcode='22023';end if;
 -- Same request returns its original capture even if current balances have changed.
 select id into result from public.wealth_net_worth_snapshots where user_id=actor and idempotency_key=p_idempotency_key;
 if found then return result;end if;
 snapshot:=public.wealth_net_worth();
 insert into public.wealth_net_worth_snapshots(user_id,idempotency_key,captured_at,local_date,timezone,source,composition)
 values(actor,p_idempotency_key,(snapshot->>'capturedAt')::timestamptz,(snapshot->>'localDate')::date,snapshot->>'timezone','owner_declared',snapshot)
 on conflict(user_id,idempotency_key) do nothing returning id into result;
 if result is null then select id into result from public.wealth_net_worth_snapshots where user_id=actor and idempotency_key=p_idempotency_key;end if;
 return result;
end;$$;
revoke all on function ecosystem_private.capture_wealth_net_worth(uuid) from public,anon,authenticated;
grant execute on function ecosystem_private.capture_wealth_net_worth(uuid) to authenticated;
create function public.capture_wealth_net_worth(p_idempotency_key uuid) returns uuid
language sql security invoker set search_path='' as $$select ecosystem_private.capture_wealth_net_worth(p_idempotency_key)$$;
revoke all on function public.capture_wealth_net_worth(uuid) from public,anon,authenticated;
grant execute on function public.capture_wealth_net_worth(uuid) to authenticated;
comment on table public.wealth_net_worth_snapshots is 'Explicit immutable user captures from deployment forward. No backfill, market prices or customer data copied. Totals/classes cover all active positions; largest is top ten per kind only.';
commit;
