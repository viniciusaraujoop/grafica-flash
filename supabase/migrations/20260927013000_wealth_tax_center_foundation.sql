-- Tax Center foundation: declared Portfolio ledger facts only. No jurisdiction, tax rule, liability calculation, filing or provider side effect.
begin;
create index wealth_portfolio_tax_dates on public.wealth_portfolio_transactions(user_id,financial_date desc,id)
 where type in ('tax','income','dividend','interest','sell');

create function public.wealth_tax_center(p_from date,p_to date,p_page integer default 1,p_portfolio uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); selected jsonb; result jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2200-12-31'
 or p_to<p_from or p_to-p_from>365 or p_page is null or p_page not between 1 and 100000 then
  raise exception 'Invalid tax center interval or page' using errcode='22023';end if;
 if p_portfolio is not null then
  select jsonb_build_object('id',p.id,'name',p.name,'kind',p.kind) into selected
  from public.wealth_portfolios p where p.id=p_portfolio and p.user_id=actor;
  if selected is null then raise exception 'Portfolio unavailable' using errcode='42501';end if;
 end if;
 with portfolios as materialized (
  select p.id,p.name from public.wealth_portfolios p
  where p.user_id=actor and p.kind='real' and (p_portfolio is null or p.id=p_portfolio)
 ), source as materialized (
  select t.id,t.holding_id,t.type,t.amount_cents,t.basis_removed_cents,t.realized_gain_cents,t.financial_date,t.reference,
   e.title,e.archived_at,p.id portfolio_id,p.name portfolio_name
  from public.wealth_portfolio_transactions t
  join public.wealth_holdings h on h.id=t.holding_id and h.user_id=actor
  join public.wealth_entries e on e.id=h.id and e.user_id=actor and e.kind='asset' and e.currency='BRL'
  join portfolios p on p.id=h.portfolio_id
  where t.user_id=actor and t.type in ('tax','income','dividend','interest','sell') and t.financial_date between p_from and p_to
 ), groups as (
  select p.id,p.name,count(s.id) records,
   coalesce(sum(s.amount_cents) filter(where s.type='tax'),0) taxes,
   coalesce(sum(s.amount_cents) filter(where s.type in ('income','dividend','interest')),0) income,
   coalesce(sum(s.amount_cents) filter(where s.type='sell'),0) sell_proceeds,
   coalesce(sum(s.basis_removed_cents) filter(where s.type='sell' and s.basis_removed_cents is not null),0) basis_removed,
   coalesce(sum(s.realized_gain_cents) filter(where s.type='sell' and s.realized_gain_cents is not null),0) realized_gain,
   count(*) filter(where s.type='sell' and (s.basis_removed_cents is null or s.realized_gain_cents is null)) incomplete_sells
  from portfolios p left join source s on s.portfolio_id=p.id group by p.id,p.name
 )
 select jsonb_build_object(
  'from',p_from,'to',p_to,'days',p_to-p_from+1,'page',p_page,'currency','BRL','selected',selected,
  'coverage','DECLARED_LEDGER_ONLY','tax_provider_status','NOT_CONFIGURED','tax_rules_status','NOT_CONFIGURED',
  'jurisdiction_status','UNSPECIFIED','filing_status','NOT_CONFIGURED',
  'taxes',coalesce((select sum(amount_cents) from source where type='tax'),0)::text,
  'income',coalesce((select sum(amount_cents) from source where type in ('income','dividend','interest')),0)::text,
  'sell_proceeds',coalesce((select sum(amount_cents) from source where type='sell'),0)::text,
  'basis_removed',coalesce((select sum(basis_removed_cents) from source where type='sell' and basis_removed_cents is not null),0)::text,
  'realized_gain',coalesce((select sum(realized_gain_cents) from source where type='sell' and realized_gain_cents is not null),0)::text,
  'record_count',(select count(*)::text from source),
  'tax_count',(select count(*)::text from source where type='tax'),
  'income_count',(select count(*)::text from source where type in ('income','dividend','interest')),
  'sell_count',(select count(*)::text from source where type='sell'),
  'complete_sell_count',(select count(*)::text from source where type='sell' and basis_removed_cents is not null and realized_gain_cents is not null),
  'incomplete_sell_count',(select count(*)::text from source where type='sell' and (basis_removed_cents is null or realized_gain_cents is null)),
  'holding_count',(select count(distinct holding_id)::text from source),
  'portfolio_count',(select count(*)::text from portfolios),
  'covered_portfolios',(select count(distinct portfolio_id)::text from source),
  'lab_count',(select count(*)::text from public.wealth_portfolios p where p.user_id=actor and p.kind='lab' and (p_portfolio is null or p.id=p_portfolio)),
  'portfolios',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'records',g.records::text,'taxes',g.taxes::text,
   'income',g.income::text,'sell_proceeds',g.sell_proceeds::text,'basis_removed',g.basis_removed::text,'realized_gain',g.realized_gain::text,
   'incomplete_sells',g.incomplete_sells::text) order by g.name,g.id)
   from (select * from groups order by name,id limit 25 offset (p_page-1)*25) g),'[]'::jsonb),
  'months',coalesce((select jsonb_agg(jsonb_build_object('month',m.month_key,'taxes',m.taxes::text,'income',m.income::text,
   'sell_proceeds',m.sell_proceeds::text,'basis_removed',m.basis_removed::text,'realized_gain',m.realized_gain::text,
   'records',m.records::text,'incomplete_sells',m.incomplete_sells::text) order by m.month_key)
   from (select to_char(financial_date,'YYYY-MM') as month_key,
    coalesce(sum(amount_cents) filter(where type='tax'),0) taxes,
    coalesce(sum(amount_cents) filter(where type in ('income','dividend','interest')),0) income,
    coalesce(sum(amount_cents) filter(where type='sell'),0) sell_proceeds,
    coalesce(sum(basis_removed_cents) filter(where type='sell' and basis_removed_cents is not null),0) basis_removed,
    coalesce(sum(realized_gain_cents) filter(where type='sell' and realized_gain_cents is not null),0) realized_gain,
    count(*) records,count(*) filter(where type='sell' and (basis_removed_cents is null or realized_gain_cents is null)) incomplete_sells
    from source group by 1) m),'[]'::jsonb),
  'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'holding_id',r.holding_id,'portfolio_id',r.portfolio_id,'portfolio_name',r.portfolio_name,
   'title',r.title,'archived',r.archived_at is not null,'type',r.type,'amount_cents',r.amount_cents::text,
   'basis_removed_cents',r.basis_removed_cents::text,'realized_gain_cents',r.realized_gain_cents::text,
   'financial_date',r.financial_date,'reference',r.reference) order by r.financial_date desc,r.id)
   from (select * from source order by financial_date desc,id limit 25 offset (p_page-1)*25) r),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.wealth_tax_center(date,date,integer,uuid) from public,anon;
grant execute on function public.wealth_tax_center(date,date,integer,uuid) to authenticated;
commit;
