-- Wealth Morning/Night deterministic briefing read model. Facts only; no AI/provider inference.
begin;

create function public.wealth_daily_briefing(p_mode text,p_local_date date)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  zone text;
  result jsonb;
begin
  if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then
    raise exception 'wealth read denied' using errcode='42501';
  end if;
  if p_mode not in ('morning','night') or p_local_date is null
     or p_local_date<date '1900-01-01' or p_local_date>date '2200-12-31' then
    raise exception 'Invalid briefing mode or date' using errcode='22023';
  end if;

  select coalesce(nullif(timezone,''),'America/Sao_Paulo') into zone
  from public.wealth_profiles
  where user_id=actor;
  zone:=coalesce(zone,'America/Sao_Paulo');

  with
  day_cash as materialized (
    select
      coalesce(sum(amount_cents) filter(where kind='income' and valuation_status<>'NOT_AVAILABLE'),0)::bigint income,
      coalesce(sum(amount_cents) filter(where kind='expense' and valuation_status<>'NOT_AVAILABLE'),0)::bigint expenses,
      count(*) filter(where kind in ('income','expense'))::bigint records
    from public.wealth_entries
    where user_id=actor and archived_at is null and currency='BRL' and financial_date=p_local_date
  ),
  recurrence as materialized (
    select
      count(*) filter(where status='active' and next_date<p_local_date)::bigint overdue,
      count(*) filter(where status='active' and next_date=p_local_date)::bigint today,
      count(*) filter(where status='active' and next_date=p_local_date+1)::bigint tomorrow,
      count(*) filter(where status='active' and next_date between p_local_date and p_local_date+7)::bigint next7,
      coalesce(sum(amount_cents) filter(where status='active' and kind='expense' and next_date between p_local_date and p_local_date+7),0)::bigint next7_expense
    from public.wealth_recurring_schedules
    where user_id=actor
  ),
  debts as materialized (
    select
      count(*) filter(where e.amount_cents>0)::bigint open_count,
      count(*) filter(where e.amount_cents>0 and d.next_due_date<p_local_date)::bigint overdue,
      count(*) filter(where e.amount_cents>0 and d.next_due_date=p_local_date+1)::bigint tomorrow,
      count(*) filter(where e.amount_cents>0 and d.next_due_date between p_local_date and p_local_date+7)::bigint next7,
      coalesce(sum(d.minimum_cents) filter(where e.amount_cents>0 and d.next_due_date between p_local_date and p_local_date+7),0)::bigint next7_minimum
    from public.wealth_entries e
    join public.wealth_debt_terms d on d.id=e.id
    where e.user_id=actor and e.kind='liability' and e.archived_at is null and e.currency='BRL'
  ),
  goals as materialized (
    select
      count(*) filter(where status='active')::bigint active_count,
      count(*) filter(where status='active' and saved_cents<target_cents and target_date between p_local_date and p_local_date+30)::bigint due30,
      count(*) filter(where status='active' and saved_cents<target_cents and target_date<p_local_date)::bigint past_due,
      coalesce(sum(greatest(target_cents-saved_cents,0)) filter(where status='active' and target_date between p_local_date and p_local_date+30),0)::bigint due30_gap
    from public.wealth_goals
    where user_id=actor and archived_at is null and currency='BRL'
  ),
  shield as materialized (
    select
      count(*) filter(where archived_at is null and status='declared' and ends_on<p_local_date)::bigint expired,
      count(*) filter(where archived_at is null and status='declared' and ends_on between p_local_date and p_local_date+30)::bigint ending30,
      count(*) filter(where archived_at is null and status='declared' and document_id is null)::bigint missing_document
    from public.wealth_protection_policies
    where user_id=actor
  ),
  portfolio as materialized (
    select
      count(*) filter(where p.kind='real')::bigint real_holdings,
      count(*) filter(where p.kind='real' and e.valuation_status='NOT_AVAILABLE')::bigint unknown_valuations,
      count(*) filter(where p.kind='real' and h.maturity between p_local_date and p_local_date+30)::bigint maturity30
    from public.wealth_holdings h
    join public.wealth_entries e on e.id=h.id and e.user_id=actor and e.archived_at is null
    join public.wealth_portfolios p on p.id=h.portfolio_id and p.user_id=actor
    where h.user_id=actor
  ),
  portfolio_day as materialized (
    select count(*)::bigint records,
      coalesce(sum(amount_cents),0)::bigint amount
    from public.wealth_portfolio_transactions
    where user_id=actor and financial_date=p_local_date
  ),
  tax_gap as materialized (
    select count(*)::bigint incomplete
    from public.wealth_portfolio_transactions t
    join public.wealth_holdings h on h.id=t.holding_id and h.user_id=actor
    join public.wealth_portfolios p on p.id=h.portfolio_id and p.user_id=actor and p.kind='real'
    where t.user_id=actor and t.type='sell'
      and t.financial_date between p_local_date-365 and p_local_date
      and (t.basis_removed_cents is null or t.realized_gain_cents is null)
  ),
  tomorrow as materialized (
    select
      (select tomorrow from recurrence)+(select tomorrow from debts)+
      (select count(*) from public.wealth_goals g where g.user_id=actor and g.archived_at is null and g.status='active' and g.target_date=p_local_date+1)+
      (select count(*) from public.wealth_holdings h join public.wealth_entries e on e.id=h.id and e.user_id=actor and e.archived_at is null join public.wealth_portfolios p on p.id=h.portfolio_id and p.user_id=actor and p.kind='real' where h.user_id=actor and h.maturity=p_local_date+1)
      as count
  ),
  raw_items as (
    select 10 priority,'cash' source,'today' kind,
      case when p_mode='morning' then 'Movimentos já registrados hoje' else 'Fechamento dos lançamentos do dia' end title,
      ((select records from day_cash)::text||' lançamento(s) de caixa na data financeira.') observe,
      ('Receitas: '||(select income from day_cash)::text||' centavos; despesas: '||(select expenses from day_cash)::text||' centavos. Isso reflete apenas registros declarados no Wealth.') understand,
      'Abrir lançamentos' action_label,'/apps/wealth/lancamentos' href,
      ((select income from day_cash)-(select expenses from day_cash))::text amount,p_local_date::text event_date,'info' status
    where (select records from day_cash)>0

    union all select 20,'recurrence','overdue','Recorrências com data vencida',
      ((select overdue from recurrence)::text||' agendamento(s) ativo(s) têm próxima data anterior a hoje.'),
      'Data vencida não confirma falta de pagamento; confirma apenas que o agendamento ainda aponta para uma data passada.',
      'Revisar recorrências','/apps/wealth/recorrencias',null,null,'attention'
    where (select overdue from recurrence)>0

    union all select 30,'debt','overdue','Dívidas com vencimento declarado no passado',
      ((select overdue from debts)::text||' dívida(s) aberta(s) têm próximo vencimento declarado anterior a hoje.'),
      'O saldo e o vencimento são declarados por você; o Orçaly não consulta o credor.',
      'Revisar dívidas','/apps/wealth/dividas',null,null,'attention'
    where (select overdue from debts)>0

    union all select 40,'recurrence','next7','Contas recorrentes nos próximos 7 dias',
      ((select next7 from recurrence)::text||' agendamento(s), com '||(select next7_expense from recurrence)::text||' centavos em despesas recorrentes declaradas.'),
      'São previsões de geração de lançamento, não débitos bancários confirmados.',
      'Abrir calendário','/apps/wealth/calendario', (select next7_expense from recurrence)::text,(p_local_date+7)::text,'upcoming'
    where p_mode='morning' and (select next7 from recurrence)>0

    union all select 45,'debt','next7','Vencimentos de dívida nos próximos 7 dias',
      ((select next7 from debts)::text||' dívida(s), com mínimo declarado somando '||(select next7_minimum from debts)::text||' centavos.'),
      'O mínimo é condição declarada; pagamento e saldo do credor não são verificados.',
      'Abrir Central de dívidas','/apps/wealth/dividas',(select next7_minimum from debts)::text,(p_local_date+7)::text,'upcoming'
    where p_mode='morning' and (select next7 from debts)>0

    union all select 50,'goal','due30','Metas próximas do prazo',
      ((select due30 from goals)::text||' meta(s) ativa(s) e incompletas vencem em até 30 dias.'),
      ('A diferença declarada para essas metas soma '||(select due30_gap from goals)::text||' centavos, sem assumir rendimento ou aporte futuro.'),
      'Revisar metas','/apps/wealth/metas',(select due30_gap from goals)::text,(p_local_date+30)::text,'upcoming'
    where (select due30 from goals)>0

    union all select 55,'goal','past_due','Metas com prazo passado',
      ((select past_due from goals)::text||' meta(s) ativa(s) continuam abaixo do valor alvo após a data desejada.'),
      'O status usa somente alvo, reservado declarado e data. Não presume disponibilidade bancária.',
      'Replanejar metas','/apps/wealth/metas',null,null,'attention'
    where (select past_due from goals)>0

    union all select 60,'shield','ending','Proteções perto do fim informado',
      ((select ending30 from shield)::text||' proteção(ões) declarada(s) terminam em até 30 dias.'),
      'O fim informado vem do seu registro; não há consulta automática à seguradora.',
      'Abrir Shield','/apps/wealth/shield',null,(p_local_date+30)::text,'upcoming'
    where (select ending30 from shield)>0

    union all select 65,'shield','expired','Proteções com prazo informado encerrado',
      ((select expired from shield)::text||' proteção(ões) declarada(s) têm data final anterior a hoje.'),
      'Prazo encerrado não prova ausência de cobertura atual; o registro pode precisar de atualização.',
      'Revisar Shield','/apps/wealth/shield',null,null,'attention'
    where (select expired from shield)>0

    union all select 70,'shield','evidence','Proteções sem documento vinculado',
      ((select missing_document from shield)::text||' proteção(ões) declarada(s) não têm documento do Vault vinculado.'),
      'É uma lacuna de evidência dentro do Orçaly, não uma conclusão sobre a existência da apólice.',
      'Revisar documentos','/apps/wealth/shield',null,null,'info'
    where p_mode='morning' and (select missing_document from shield)>0

    union all select 75,'portfolio','coverage','Carteira com avaliações indisponíveis',
      ((select unknown_valuations from portfolio)::text||' posição(ões) reais não têm valor disponível.'),
      'Totais patrimoniais podem ficar parciais; nenhuma cotação externa é inventada.',
      'Revisar carteiras','/apps/wealth/carteiras',null,null,'attention'
    where (select unknown_valuations from portfolio)>0

    union all select 80,'portfolio','maturity','Vencimentos de posições em até 30 dias',
      ((select maturity30 from portfolio)::text||' posição(ões) reais têm vencimento declarado em até 30 dias.'),
      'A data é declarada; valor de resgate e evento de liquidação não são presumidos.',
      'Abrir calendário','/apps/wealth/calendario',null,(p_local_date+30)::text,'upcoming'
    where p_mode='morning' and (select maturity30 from portfolio)>0

    union all select 85,'tax','coverage','Vendas com evidência fiscal incompleta',
      ((select incomplete from tax_gap)::text||' venda(s) reais nos últimos 365 dias não têm base removida ou resultado realizado declarado.'),
      'O Tax Center mantém esses campos ausentes como desconhecidos; não calcula imposto devido.',
      'Abrir Tax Center','/apps/wealth/impostos',null,null,'attention'
    where (select incomplete from tax_gap)>0

    union all select 90,'portfolio','today','Movimentos de carteira registrados hoje',
      ((select records from portfolio_day)::text||' movimento(s) no ledger de Portfolio.'),
      ('Montante agregado dos eventos: '||(select amount from portfolio_day)::text||' centavos. Movimentos de carteira não criam um segundo lançamento de caixa.'),
      'Abrir carteiras','/apps/wealth/carteiras',(select amount from portfolio_day)::text,p_local_date::text,'info'
    where p_mode='night' and (select records from portfolio_day)>0

    union all select 95,'tomorrow','agenda','Amanhã já tem compromissos declarados',
      ((select count from tomorrow)::text||' item(ns) entre recorrências, dívidas, metas e vencimentos de posições.'),
      'São datas registradas no Wealth; não confirmam cobrança, pagamento ou liquidação externa.',
      'Ver amanhã no calendário','/apps/wealth/calendario?view=agenda&days=1&date='||(p_local_date+1)::text,null,(p_local_date+1)::text,'upcoming'
    where p_mode='night' and (select count from tomorrow)>0
  ),
  items as (
    select * from raw_items order by priority,source limit 12
  )
  select jsonb_build_object(
    'mode',p_mode,
    'date',p_local_date,
    'timezone',zone,
    'currency','BRL',
    'coverage','DECLARED_WEALTH_DATA_ONLY',
    'market_provider_status','NOT_CONFIGURED',
    'bank_provider_status','NOT_CONFIGURED',
    'generated_from','CURRENT_READ_MODEL',
    'stats',jsonb_build_object(
      'today_income',(select income from day_cash)::text,
      'today_expenses',(select expenses from day_cash)::text,
      'today_cash_flow',((select income from day_cash)-(select expenses from day_cash))::text,
      'today_cash_records',(select records from day_cash)::text,
      'overdue_recurrences',(select overdue from recurrence)::text,
      'overdue_debts',(select overdue from debts)::text,
      'tomorrow_items',(select count from tomorrow)::text,
      'next7_recurrences',(select next7 from recurrence)::text,
      'next7_debts',(select next7 from debts)::text,
      'active_goals',(select active_count from goals)::text,
      'open_debts',(select open_count from debts)::text,
      'unknown_valuations',(select unknown_valuations from portfolio)::text,
      'tax_gaps',(select incomplete from tax_gap)::text
    ),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'priority',priority,'source',source,'kind',kind,'title',title,
      'observe',observe,'understand',understand,'action_label',action_label,
      'href',href,'amount_cents',amount,'event_date',event_date,'status',status
    ) order by priority,source) from items),'[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke all on function public.wealth_daily_briefing(text,date) from public,anon;
grant execute on function public.wealth_daily_briefing(text,date) to authenticated;

commit;
