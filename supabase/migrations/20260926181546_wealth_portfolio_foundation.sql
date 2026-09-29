-- Explicitly applied after Financial Health (190000). Never replay the drifted history.
-- Values live only in wealth_entries; holdings carry quantity, basis and provenance.
begin;
alter table public.wealth_entries drop constraint wealth_entries_amount_cents_check;
alter table public.wealth_entries add constraint wealth_entries_amount_cents_check
 check(amount_cents between 0 and 100000000000000 and (amount_cents>0 or kind in ('asset','liability')));
alter table public.wealth_entries add column valuation_status text not null default 'MANUAL_VALUE',
 add constraint wealth_valuation_status_check check (
 valuation_status in ('MANUAL_VALUE','IMPORTED_VALUE','PROVIDER_MARKET_VALUE','NOT_AVAILABLE')
 and (kind='asset' or valuation_status='MANUAL_VALUE') and (valuation_status<>'NOT_AVAILABLE' or amount_cents=0));

create table public.wealth_portfolios (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 120), kind text not null check(kind in ('real','lab')),
 goal_id uuid references public.wealth_goals(id) on delete set null,
 targets jsonb not null default '{}'::jsonb, lab_positions jsonb not null default '[]'::jsonb,
 version bigint not null default 1 check(version between 1 and 9007199254740991), created_at timestamptz not null default now(),
 check(jsonb_typeof(targets)='object' and jsonb_typeof(lab_positions)='array'),check(kind='lab' or lab_positions='[]'::jsonb)
);
create index wealth_portfolios_owner on public.wealth_portfolios(user_id,id);
create index wealth_portfolios_goal on public.wealth_portfolios(goal_id) where goal_id is not null;
create table public.wealth_holdings (
 id uuid primary key references public.wealth_entries(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 portfolio_id uuid not null references public.wealth_portfolios(id) on delete cascade,
 instrument text not null check(length(btrim(instrument)) between 1 and 80),
 quantity numeric(28,8) not null check(quantity between 0 and 100000000000000),
 cost_basis_cents bigint check(cost_basis_cents between 0 and 100000000000000),
 issuer text check(length(issuer)<=120), sector text check(length(sector)<=80),
 exposure_currency text check(exposure_currency ~ '^[A-Z]{3}$'),
 maturity date check(maturity between date '1900-01-01' and date '2200-12-31'),
 valuation_source text not null check(length(btrim(valuation_source)) between 1 and 240),
 check(quantity<>0 or cost_basis_cents is null or cost_basis_cents=0)
);
create index wealth_holdings_owner on public.wealth_holdings(user_id,id);
create index wealth_holdings_portfolio on public.wealth_holdings(portfolio_id,id);
create table public.wealth_portfolio_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 holding_id uuid not null references public.wealth_holdings(id) on delete cascade,
 destination_id uuid references public.wealth_holdings(id) on delete cascade,
 type text not null check(type in ('buy','sell','contribution','withdrawal','income','dividend','interest','fee','tax','transfer','adjustment')),
 quantity numeric(28,8) not null, amount_cents bigint not null check(amount_cents between 0 and 100000000000000),
 basis_removed_cents bigint, realized_gain_cents bigint, position_before jsonb not null, position_after jsonb not null,
 financial_date date not null check(financial_date between date '1900-01-01' and date '2200-12-31'),
 reference text not null check(length(btrim(reference)) between 1 and 240), created_at timestamptz not null default now(),
 check(destination_id is null or (type='transfer' and destination_id<>holding_id))
);
create index wealth_portfolio_transactions_owner on public.wealth_portfolio_transactions(user_id,created_at desc,id);
create index wealth_portfolio_transactions_holding on public.wealth_portfolio_transactions(holding_id,created_at desc);
create index wealth_portfolio_transactions_destination on public.wealth_portfolio_transactions(destination_id) where destination_id is not null;
create table ecosystem_private.wealth_portfolio_commands (
 user_id uuid not null references auth.users(id) on delete cascade, token uuid not null,
 operation text not null, input jsonb not null, result_id uuid not null, primary key(user_id,token)
);
alter table ecosystem_private.wealth_portfolio_commands enable row level security;
revoke all on ecosystem_private.wealth_portfolio_commands from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['wealth_portfolios','wealth_holdings','wealth_portfolio_transactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy portfolio_owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access(''wealth'',''wealth.read'')))',t);
  execute format('create trigger portfolio_audit after insert or update or delete on public.%I for each row execute function ecosystem_private.record_change()',t);
 end loop;
end $$;

-- Invoker trigger distinguishes authenticated direct DML from the guarded private RPC.
create function ecosystem_private.guard_wealth_holding_entry() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if current_user not in ('postgres','service_role') and exists(select 1 from public.wealth_holdings where id=old.id) then raise exception 'Archive Portfolio positions instead' using errcode='42501';end if;
  return old;
 end if;
 if current_user not in ('postgres','service_role') then
  if (tg_op='INSERT' and new.valuation_status<>'MANUAL_VALUE') or
   (tg_op='UPDATE' and (new.valuation_status is distinct from old.valuation_status or exists(select 1 from public.wealth_holdings where id=old.id))) then
   raise exception 'Use Portfolio to change this position' using errcode='42501';
  end if;
 end if;
 if tg_op='UPDATE' and new.kind<>'asset' and exists(select 1 from public.wealth_holdings where id=old.id) then raise exception 'Holding must remain an asset' using errcode='23514';end if;
 return new;
end $$;
revoke all on function ecosystem_private.guard_wealth_holding_entry() from public,anon,authenticated;
create trigger wealth_holding_entry_guard before insert or update or delete on public.wealth_entries for each row execute function ecosystem_private.guard_wealth_holding_entry();

create function ecosystem_private.manage_wealth_portfolio(p_operation text,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); token uuid; receipt ecosystem_private.wealth_portfolio_commands;
 p public.wealth_portfolios; h public.wealth_holdings; dst public.wealth_holdings;
 e public.wealth_entries; de public.wealth_entries; result uuid; goal uuid;
 amount bigint; basis bigint; removed bigint; gain bigint; q numeric; tx text; dated date; label text; source text; status text;
 targets jsonb; labs jsonb; item record; pos jsonb; weights integer:=0;
 classes text[]:=array['cash','checking','savings','investment','fixed_income','stock','fund','ETF','FII','pension','crypto','real_estate','vehicle','business_equity','receivable','other'];
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or p_input->>'confirmed' is distinct from 'yes' then raise exception 'Confirmation required' using errcode='22023';end if;
 token:=(p_input->>'idempotency_key')::uuid;if token is null then raise exception 'Idempotency required' using errcode='22023';end if;
 -- Serialize this owner's commands, including transfers; no cross-owner locks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,710));
 select * into receipt from ecosystem_private.wealth_portfolio_commands c where c.user_id=actor and c.token=(p_input->>'idempotency_key')::uuid;
 if found then
  if receipt.operation is distinct from p_operation or receipt.input is distinct from p_input then raise exception 'Idempotency conflict' using errcode='23505';end if;
  return receipt.result_id;
 end if;
 if p_operation in ('create','configure') then
  label:=btrim(p_input->>'name');goal:=nullif(p_input->>'goal_id','')::uuid;
  if label is null or length(label) not between 1 and 120 then raise exception 'Invalid portfolio name' using errcode='22023';end if;
  if goal is not null and not exists(select 1 from public.wealth_goals where id=goal and user_id=actor and archived_at is null) then raise exception 'Goal unavailable' using errcode='42501';end if;
  targets:=coalesce(p_input->'targets','{}'::jsonb);labs:=coalesce(p_input->'lab_positions','[]'::jsonb);
  if jsonb_typeof(targets)<>'object' or jsonb_typeof(labs)<>'array' or jsonb_array_length(labs)>50 then raise exception 'Invalid scenario' using errcode='22023';end if;
  for item in select * from jsonb_each_text(targets) loop
   if not item.key=any(classes) or item.value!~'^\d{1,5}$' or item.value::integer>10000 then raise exception 'Invalid target' using errcode='22023';end if;
   weights:=weights+item.value::integer;
  end loop;
  if targets<>'{}'::jsonb and weights<>10000 then raise exception 'Targets must total 100 percent' using errcode='22023';end if;
  for pos in select value from jsonb_array_elements(labs) loop
   if jsonb_typeof(pos)<>'object' or (pos->>'class') is null or not (pos->>'class')=any(classes) or (pos->>'amount') is null or (pos->>'amount')!~'^\d{1,15}$' or (pos->>'amount')::numeric>100000000000000 then raise exception 'Invalid hypothetical position' using errcode='22023';end if;
  end loop;
  if (select count(*)<>count(distinct value->>'class') from jsonb_array_elements(labs)) then raise exception 'One hypothetical position per class' using errcode='22023';end if;
  if p_operation='create' then
   insert into public.wealth_portfolios(user_id,name,kind,goal_id,targets,lab_positions) values(actor,label,p_input->>'kind',goal,targets,labs) returning id into result;
  else
   update public.wealth_portfolios set name=label,goal_id=goal,targets=targets,lab_positions=labs,version=version+1
   where id=(p_input->>'portfolio_id')::uuid and user_id=actor and version=(p_input->>'version')::bigint returning id into result;
   if not found then raise exception 'Portfolio version conflict' using errcode='PT409';end if;
  end if;
 elsif p_operation in ('holding','link') then
  select * into p from public.wealth_portfolios where id=(p_input->>'portfolio_id')::uuid and user_id=actor and kind='real';
  if not found then raise exception 'Real portfolio unavailable' using errcode='42501';end if;
  if coalesce(p_input->>'quantity','')!~'^\d{1,15}(\.\d{1,8})?$' then raise exception 'Invalid quantity' using errcode='22023';end if;
  q:=(p_input->>'quantity')::numeric;basis:=nullif(p_input->>'cost_basis_cents','')::bigint;
  source:=btrim(p_input->>'valuation_source');status:=p_input->>'valuation_status';
  if p_operation='holding' then
   if status is null or status not in ('MANUAL_VALUE','IMPORTED_VALUE','NOT_AVAILABLE') then raise exception 'Market provider not configured' using errcode='22023';end if;
   insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,recurrence,idempotency_key,position_class,liquidity,valuation_status)
   values(actor,'asset',btrim(p_input->>'title'),'investment',(p_input->>'amount_cents')::bigint,(p_input->>'financial_date')::date,'none',token,p_input->>'position_class',p_input->>'liquidity',status) returning * into e;
  else
   select * into e from public.wealth_entries where id=(p_input->>'entry_id')::uuid and user_id=actor and kind='asset' and archived_at is null for update;
   if not found or e.version is distinct from (p_input->>'version')::bigint then raise exception 'Position version conflict' using errcode='PT409';end if;
   if exists(select 1 from public.wealth_holdings where id=e.id) then raise exception 'Position already linked' using errcode='23505';end if;
   -- The current value/date/class are preserved; linking never creates another balance.
   update public.wealth_entries set title=title where id=e.id;
  end if;
  if q=0 and e.amount_cents<>0 then raise exception 'Empty position must have zero value' using errcode='22023';end if;
  insert into public.wealth_holdings(id,user_id,portfolio_id,instrument,quantity,cost_basis_cents,issuer,sector,exposure_currency,maturity,valuation_source)
  values(e.id,actor,p.id,btrim(p_input->>'instrument'),q,basis,nullif(btrim(p_input->>'issuer'),''),nullif(btrim(p_input->>'sector'),''),nullif(p_input->>'exposure_currency',''),nullif(p_input->>'maturity','')::date,source);
  result:=e.id;
 elsif p_operation in ('value','transaction','archive','restore') then
  select * into h from public.wealth_holdings where id=(p_input->>'holding_id')::uuid and user_id=actor;
  if not found then raise exception 'Holding unavailable' using errcode='42501';end if;
  -- Stable ordering also covers the two entry rows of a transfer.
  perform 1 from public.wealth_entries where user_id=actor and id in (h.id,nullif(p_input->>'destination_id','')::uuid) order by id for update;
  select * into e from public.wealth_entries where id=h.id and user_id=actor;
  if e.version is distinct from (p_input->>'version')::bigint then raise exception 'Position version conflict' using errcode='PT409';end if;
  if p_operation in ('archive','restore') then
   update public.wealth_entries set archived_at=case when p_operation='archive' then now() else null end where id=e.id;
   result:=e.id;
  else
   if e.archived_at is not null then raise exception 'Restore before editing' using errcode='22023';end if;
   dated:=(p_input->>'financial_date')::date;source:=btrim(p_input->>'reference');
   if dated is null or dated not between date '1900-01-01' and date '2200-12-31' then raise exception 'Invalid financial date' using errcode='22023';end if;
   if p_operation='value' then
    status:=p_input->>'valuation_status';amount:=(p_input->>'amount_cents')::bigint;
    if status is null or status not in ('MANUAL_VALUE','IMPORTED_VALUE','NOT_AVAILABLE') then raise exception 'Market provider not configured' using errcode='22023';end if;
    if h.quantity=0 and amount<>0 then raise exception 'Empty position must have zero value' using errcode='22023';end if;
    update public.wealth_entries set amount_cents=amount,financial_date=dated,valuation_status=status,position_class=p_input->>'position_class',liquidity=p_input->>'liquidity' where id=e.id;
    update public.wealth_holdings set valuation_source=source,issuer=nullif(btrim(p_input->>'issuer'),''),sector=nullif(btrim(p_input->>'sector'),''),exposure_currency=nullif(p_input->>'exposure_currency',''),maturity=nullif(p_input->>'maturity','')::date where id=h.id;
    result:=e.id;
   else
    tx:=p_input->>'type';amount:=(p_input->>'amount_cents')::bigint;
    if coalesce(p_input->>'quantity','')!~'^-?\d{1,15}(\.\d{1,8})?$' then raise exception 'Invalid quantity' using errcode='22023';end if;
    q:=(p_input->>'quantity')::numeric;
    if tx in ('buy','sell','contribution','withdrawal','transfer') and q<=0 then raise exception 'Positive quantity required' using errcode='22023';end if;
    if tx in ('income','dividend','interest','fee','tax') and q<>0 then raise exception 'Cash event cannot change quantity' using errcode='22023';end if;
    if tx='adjustment' and (amount<>0 or not p_input ? 'cost_basis_cents') then raise exception 'Adjustment needs declared replacement basis and zero cash' using errcode='22023';end if;
    if tx='transfer' and amount<>0 then raise exception 'Internal transfer has no cash proceeds' using errcode='22023';end if;
    basis:=h.cost_basis_cents;
    if tx in ('sell','withdrawal','transfer') then
     if q>h.quantity then raise exception 'Insufficient quantity' using errcode='22023';end if;
     removed:=case when basis is null then null when q=h.quantity then basis else round(basis::numeric*q/h.quantity)::bigint end;
     basis:=basis-removed;
     if tx='sell' then gain:=amount-removed;end if;
     if tx='transfer' then
      select * into dst from public.wealth_holdings where id=(p_input->>'destination_id')::uuid and user_id=actor and id<>h.id;
      select * into de from public.wealth_entries where id=dst.id and user_id=actor and archived_at is null;
      if dst.id is null or de.id is null or dst.instrument<>h.instrument or dst.exposure_currency is distinct from h.exposure_currency then raise exception 'Compatible owned destination required' using errcode='42501';end if;
      if de.version is distinct from (p_input->>'destination_version')::bigint then raise exception 'Destination version conflict' using errcode='PT409';end if;
      update public.wealth_holdings set quantity=quantity+q,cost_basis_cents=cost_basis_cents+removed,valuation_source='Movimentação: reavaliar saldo' where id=dst.id;
      update public.wealth_entries set amount_cents=0,valuation_status='NOT_AVAILABLE',financial_date=dated where id=dst.id;
     end if;
     update public.wealth_holdings set quantity=quantity-q,cost_basis_cents=basis where id=h.id;
    elsif tx in ('buy','contribution') then
     update public.wealth_holdings set quantity=quantity+q,cost_basis_cents=cost_basis_cents+amount where id=h.id;
    elsif tx='adjustment' then
     update public.wealth_holdings set quantity=quantity+q,cost_basis_cents=nullif(p_input->>'cost_basis_cents','')::bigint where id=h.id;
    end if;
    if tx in ('buy','sell','contribution','withdrawal','transfer') or (tx='adjustment' and q<>0) then
     update public.wealth_holdings set valuation_source='Movimentação: reavaliar saldo' where id=h.id;
     update public.wealth_entries set amount_cents=0,valuation_status=case when (select quantity from public.wealth_holdings where id=h.id)=0 then 'MANUAL_VALUE' else 'NOT_AVAILABLE' end,financial_date=dated where id=e.id;
    else update public.wealth_entries set title=title where id=e.id;end if;
    insert into public.wealth_portfolio_transactions(user_id,holding_id,destination_id,type,quantity,amount_cents,basis_removed_cents,realized_gain_cents,financial_date,reference,position_before,position_after)
    values(actor,h.id,case when tx='transfer' then dst.id else null end,tx,q,amount,removed,gain,dated,source,
     jsonb_build_object('quantity',h.quantity::text,'basis',h.cost_basis_cents::text,'value',e.amount_cents::text,'valuation',e.valuation_status),
     (select jsonb_build_object('quantity',wh.quantity::text,'basis',wh.cost_basis_cents::text,'value',we.amount_cents::text,'valuation',we.valuation_status) from public.wealth_holdings wh join public.wealth_entries we on we.id=wh.id where wh.id=h.id)) returning id into result;
   end if;
  end if;
 else raise exception 'Unknown operation' using errcode='22023';end if;
 insert into ecosystem_private.wealth_portfolio_commands values(actor,token,p_operation,p_input,result);
 return result;
end $$;
revoke all on function ecosystem_private.manage_wealth_portfolio(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_portfolio(text,jsonb) to authenticated;
create function public.manage_wealth_portfolio(p_operation text,p_input jsonb) returns uuid
language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_portfolio(p_operation,p_input)$$;
revoke all on function public.manage_wealth_portfolio(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_wealth_portfolio(text,jsonb) to authenticated;

create function public.wealth_portfolio_view(p_id uuid,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); p public.wealth_portfolios; result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000000 then raise exception 'Invalid page' using errcode='22023';end if;
 select * into p from public.wealth_portfolios where id=p_id and user_id=actor;
 if not found then raise exception 'Portfolio unavailable' using errcode='42501';end if;
 with owned as materialized (
  select h.*,e.title,e.amount_cents,e.financial_date,e.valuation_status,coalesce(e.position_class,'unclassified') as class,e.liquidity,e.version,e.archived_at
  from public.wealth_holdings h join public.wealth_entries e on e.id=h.id where h.portfolio_id=p.id and h.user_id=actor and e.user_id=actor
 ), active as materialized (select * from owned where archived_at is null),
 totals as (select coalesce(sum(amount_cents),0) as value,count(*) as count,
  count(*) filter(where valuation_status='NOT_AVAILABLE') as unavailable,
  count(*) filter(where cost_basis_cents is null) as unknown_basis,coalesce(sum(cost_basis_cents),0) as known_basis,
  coalesce(sum(cost_basis_cents) filter(where valuation_status<>'NOT_AVAILABLE'),0) as comparable_basis,
  coalesce(sum(amount_cents) filter(where valuation_status<>'NOT_AVAILABLE' and cost_basis_cents is not null),0) as comparable_value
  from active), groups as (
  select d.dimension,d.label,sum(a.amount_cents)::text as amount,count(*)::text as count from active a
  cross join lateral (values('class',a.class),('asset',a.instrument),('issuer',coalesce(a.issuer,'Não informado')),('sector',coalesce(a.sector,'Não informado')),('currency',coalesce(a.exposure_currency,'Não informada')),('liquidity',a.liquidity),('maturity',coalesce(a.maturity::text,'Não informado'))) d(dimension,label)
  group by d.dimension,d.label
 ), ledger as materialized (
  select t.* from public.wealth_portfolio_transactions t where t.user_id=actor and
   (t.holding_id in (select id from owned) or t.destination_id in(select id from owned))
 )
 select jsonb_build_object('portfolio',to_jsonb(p),'marketStatus','NOT_CONFIGURED',
  'goalTitle',(select title from public.wealth_goals where id=p.goal_id and user_id=actor and archived_at is null),
  'value',value::text,'activeCount',count::text,'unknownValuations',unavailable::text,'unknownBasis',unknown_basis::text,
  'knownBasis',known_basis::text,'comparableBasis',comparable_basis::text,'comparableValue',comparable_value::text,'gain',(comparable_value-comparable_basis)::text,
  'holdingCount',(select count(*)::text from owned),'transactionCount',(select count(*)::text from ledger),
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by dimension,amount::numeric desc,label) from groups g),'[]'::jsonb),
  'holdings',coalesce((select jsonb_agg(to_jsonb(s) order by id) from (
   select id,title,portfolio_id,instrument,quantity::text,cost_basis_cents::text,amount_cents::text,financial_date,valuation_status,valuation_source,class,liquidity,version,archived_at,issuer,sector,exposure_currency,maturity from owned order by id limit 25 offset (p_page-1)*25
  )s),'[]'::jsonb),
  'transactions',coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc,id) from (
   select id,holding_id,destination_id,type,quantity::text,amount_cents::text,basis_removed_cents::text,realized_gain_cents::text,financial_date,reference,created_at from ledger order by created_at desc,id limit 25 offset (p_page-1)*25
  )s),'[]'::jsonb),
  'cashFlows',coalesce((select jsonb_agg(to_jsonb(g)) from (select type,sum(amount_cents)::text as amount,count(*)::text as count from ledger group by type)g),'[]'::jsonb)
 ) into result from totals;
 return result;
end $$;
revoke all on function public.wealth_portfolio_view(uuid,integer) from public,anon,authenticated;
grant execute on function public.wealth_portfolio_view(uuid,integer) to authenticated;
comment on table public.wealth_holdings is 'One holding extends one asset. BRL valuations are declarations, never quotes. Unknown value uses zero storage plus explicit NOT_AVAILABLE, not a claim of zero wealth.';
comment on table public.wealth_portfolio_transactions is 'Immutable owner investment ledger. No bank payment, cash entry, quote or external side effect. Weighted average declared basis; not a tax calculation.';
create or replace function public.wealth_net_worth() returns jsonb
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
  'assets',assets::text,'liabilities',liabilities::text,'netWorth',(assets-liabilities)::text,'positionCount',count::text,'unknownValuations',(select count(*)::text from public.wealth_entries where user_id=actor and archived_at is null and valuation_status='NOT_AVAILABLE'),
  'classes',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'class',class,'amount',amount::text,'count',count::text) order by kind,class) from classes),'[]'::jsonb),
  'liquidity',coalesce((select jsonb_agg(jsonb_build_object('liquidity',liquidity,'amount',amount::text,'count',count::text) order by liquidity) from liquidity_groups),'[]'::jsonb),
  'largest',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'kind',kind,'amount',amount_cents::text,'class',class,'liquidity',liquidity) order by kind,rank) from largest where rank<=10),'[]'::jsonb)
 ) into result from totals;
 return result;
end;$$;
create or replace function public.wealth_summary(p_month date) returns jsonb
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
  'netWorth',(t.assets-t.liabilities)::text,'cashFlow',(t.income-t.expenses)::text,'entryCount',t.count::text,'unknownValuations',(select count(*)::text from public.wealth_entries where user_id=actor and archived_at is null and valuation_status='NOT_AVAILABLE'),
  'goalCount',g.count::text,'completedGoals',g.completed::text,'goalTarget',g.target::text,'goalSaved',g.saved::text,'goalContributions',g.contributions::text,
  'reserveTarget',coalesce((select monthly_budget_cents::numeric*emergency_months from public.wealth_profiles where user_id=actor),0)::text,
  'contributionCapacity',coalesce((select greatest(monthly_income_cents::numeric-monthly_budget_cents,0) from public.wealth_profiles where user_id=actor),0)::text,
  'months',(select jsonb_agg(jsonb_build_object('month',to_char(month,'YYYY-MM'),'income',income::text,'expenses',expenses::text,'cashFlow',(income-expenses)::text) order by month) from months),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'category',category,'amount',amount::text) order by kind,category) from categories),'[]'::jsonb)
 ) into result from totals t cross join goals g;
 return result;
end;
$$;
commit;
