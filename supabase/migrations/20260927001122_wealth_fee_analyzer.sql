-- Read model only: declared Portfolio costs, never another balance or payment engine.
begin;
create index wealth_portfolio_cost_dates on public.wealth_portfolio_transactions(user_id,financial_date desc,id)
 where type in ('fee','tax');

create function public.wealth_fee_analysis(p_from date,p_to date,p_page integer default 1,p_portfolio uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); previous_from date; previous_to date; comparable boolean; selected jsonb; result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2200-12-31'
 or p_to<p_from or p_to-p_from>365 or p_page is null or p_page not between 1 and 100000 then
  raise exception 'Invalid fee analysis interval or page' using errcode='22023';end if;
 if p_portfolio is not null then
  select jsonb_build_object('id',p.id,'name',p.name,'kind',p.kind) into selected from public.wealth_portfolios p where p.id=p_portfolio and p.user_id=actor;
  if selected is null then raise exception 'Portfolio unavailable' using errcode='42501';end if;
 end if;
 previous_to:=p_from-1;previous_from:=p_from-(p_to-p_from+1);comparable:=previous_from>=date '1900-01-01';
 with portfolios as materialized (
  select p.id,p.name from public.wealth_portfolios p where p.user_id=actor and p.kind='real' and (p_portfolio is null or p.id=p_portfolio)
 ), source as materialized (
  select t.id,t.holding_id,t.type,t.amount_cents,t.financial_date,t.reference,e.title,e.archived_at,p.id portfolio_id,p.name portfolio_name
  from public.wealth_portfolio_transactions t join public.wealth_holdings h on h.id=t.holding_id and h.user_id=actor
  join public.wealth_entries e on e.id=h.id and e.user_id=actor and e.kind='asset' and e.currency='BRL'
  join portfolios p on p.id=h.portfolio_id
  where t.user_id=actor and t.type in ('fee','tax') and t.financial_date between (case when comparable then previous_from else p_from end) and p_to
 ), current_records as materialized (select * from source where financial_date between p_from and p_to),
 groups as (select p.id,p.name,count(c.id) records,coalesce(sum(c.amount_cents) filter(where c.type='fee'),0) fees,
  coalesce(sum(c.amount_cents) filter(where c.type='tax'),0) taxes
  from portfolios p left join current_records c on c.portfolio_id=p.id group by p.id,p.name)
 select jsonb_build_object(
  'from',p_from,'to',p_to,'days',p_to-p_from+1,'page',p_page,'currency','BRL','selected',selected,
  'coverage','DECLARED_ONLY','external_status','NOT_CONFIGURED',
  'previous',case when comparable then jsonb_build_object('from',previous_from,'to',previous_to,
   'fees',coalesce((select sum(amount_cents) from source where financial_date<p_from and type='fee'),0)::text,
   'taxes',coalesce((select sum(amount_cents) from source where financial_date<p_from and type='tax'),0)::text,
   'records',(select count(*)::text from source where financial_date<p_from)) else null end,
  'fees',coalesce((select sum(amount_cents) from current_records where type='fee'),0)::text,
  'taxes',coalesce((select sum(amount_cents) from current_records where type='tax'),0)::text,
  'record_count',(select count(*)::text from current_records),
  'holding_count',(select count(distinct holding_id)::text from current_records),
  'portfolio_count',(select count(*)::text from portfolios),
  'covered_portfolios',(select count(distinct portfolio_id)::text from current_records),
  'lab_count',(select count(*)::text from public.wealth_portfolios p where p.user_id=actor and p.kind='lab' and (p_portfolio is null or p.id=p_portfolio)),
  'portfolios',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'records',g.records::text,'fees',g.fees::text,'taxes',g.taxes::text) order by g.name,g.id)
   from (select * from groups order by name,id limit 25 offset (p_page-1)*25) g),'[]'::jsonb),
  'months',coalesce((select jsonb_agg(jsonb_build_object('month',m.month,'fees',m.fees::text,'taxes',m.taxes::text,'records',m.records::text) order by m.month)
   from (select to_char(financial_date,'YYYY-MM') as month,coalesce(sum(amount_cents) filter(where type='fee'),0) fees,
    coalesce(sum(amount_cents) filter(where type='tax'),0) taxes,count(*) records from current_records group by 1) m),'[]'::jsonb),
  'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'holding_id',r.holding_id,'portfolio_id',r.portfolio_id,'portfolio_name',r.portfolio_name,
   'title',r.title,'archived',r.archived_at is not null,'type',r.type,'amount_cents',r.amount_cents::text,'financial_date',r.financial_date,'reference',r.reference)
   order by r.financial_date desc,r.id) from (select * from current_records order by financial_date desc,id limit 25 offset (p_page-1)*25) r),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.wealth_fee_analysis(date,date,integer,uuid) from public,anon;
grant execute on function public.wealth_fee_analysis(date,date,integer,uuid) to authenticated;
commit;
