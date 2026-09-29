-- Read model over existing identifier-only audit. No new financial records or balances.
begin;
create function ecosystem_private.wealth_timeline(p_from date,p_to date,p_page integer,p_source text,p_operation text,p_as_of timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); tz text; cutoff timestamptz:=coalesce(p_as_of,now()); result jsonb; item jsonb; items jsonb:='[]'; record_id uuid; title text; href text; context_state text;
 sources text[]:=array['entries','goals','profile','recurrence','bills','debt','snapshots','portfolios','holdings','transactions','funding','plans','documents'];
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'timeline read denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from<date '1900-01-01' or p_to>date '2200-12-31' or p_to<p_from or p_to-p_from>365 or p_page is null or p_page not between 1 and 100000 or (p_source is not null and not p_source=any(sources)) or (p_operation is not null and p_operation not in ('insert','update','delete','archived','restored','completed')) or cutoff>now() then raise exception 'invalid timeline range or filter' using errcode='22023';end if;
 select timezone into tz from public.wealth_profiles where user_id=actor;
 tz:=coalesce(tz,'America/Sao_Paulo');
 with mapped as (
  select id,entity_id,recorded_at,
   case split_part(event_type,'.',1)
    when 'wealth_entries' then 'entries' when 'wealth_goals' then 'goals' when 'wealth_profiles' then 'profile'
    when 'wealth_recurring_schedules' then 'recurrence' when 'wealth_bill_details' then 'bills' when 'wealth_debt_terms' then 'debt'
    when 'wealth_net_worth_snapshots' then 'snapshots' when 'wealth_portfolios' then 'portfolios' when 'wealth_holdings' then 'holdings'
    when 'wealth_portfolio_transactions' then 'transactions' when 'wealth_goal_funding' then 'funding' when 'wealth_life_plans' then 'plans'
    when 'wealth_documents' then 'documents'
    when 'wealth' then case split_part(event_type,'.',2) when 'entry' then 'entries' when 'goal' then 'goals' end
   end as source,regexp_replace(event_type,'^.*\.','') as operation
  from public.ecosystem_audit_events
  where actor_id=actor and recorded_at >= (p_from::timestamp at time zone tz)
   and recorded_at < ((p_to+1)::timestamp at time zone tz) and recorded_at<=cutoff
 ), filtered as (
  select * from mapped where source=any(sources) and operation in ('insert','update','delete','archived','restored','completed')
   and (p_source is null or source=p_source) and (p_operation is null or operation=p_operation)
 ), paged as (select * from filtered order by recorded_at desc,id desc limit 50 offset (p_page-1)*50)
 select jsonb_build_object('total',(select count(*)::text from filtered),'page',p_page,'pageSize',50,'timezone',tz,'asOf',cutoff,
  'items',coalesce((select jsonb_agg(to_jsonb(p) order by recorded_at desc,id desc) from paged p),'[]')) into result;
 -- Resolve at most 50 contexts with explicit ownership, without exposing the audit table.
 for item in select * from jsonb_array_elements(result->'items') loop
  title:=null;href:=null;context_state:=null;record_id:=null;
  if item->>'entity_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then record_id:=(item->>'entity_id')::uuid;end if;
  case item->>'source'
   when 'entries' then select e.title,'/apps/wealth/lancamentos/'||e.id,case when archived_at is null then 'current' else 'archived' end into title,href,context_state from public.wealth_entries e where id=record_id and user_id=actor;
   when 'goals','funding' then select g.title,'/apps/wealth/metas/'||g.id,case when archived_at is null then 'current' else 'archived' end into title,href,context_state from public.wealth_goals g where id=record_id and user_id=actor;
   when 'profile' then select 'Perfil pessoal','/apps/wealth','current' into title,href,context_state from public.wealth_profiles where user_id=record_id and user_id=actor;
   when 'recurrence','bills' then select r.title,'/apps/wealth/recorrencias#'||r.id,'current' into title,href,context_state from public.wealth_recurring_schedules r where id=record_id and user_id=actor;
   when 'debt' then select e.title,'/apps/wealth/dividas/'||e.id,'current' into title,href,context_state from public.wealth_entries e where id=record_id and user_id=actor and kind='liability';
   when 'snapshots' then select 'Patrimônio capturado em '||s.local_date::text,'/apps/wealth/patrimonio','snapshot' into title,href,context_state from public.wealth_net_worth_snapshots s where id=record_id and user_id=actor;
   when 'portfolios' then select p.name,'/apps/wealth/carteiras/'||p.id,case when kind='lab' then 'hypothetical' else 'current' end into title,href,context_state from public.wealth_portfolios p where id=record_id and user_id=actor;
   when 'holdings' then select e.title,'/apps/wealth/carteiras/'||h.portfolio_id||'?holding='||h.id,'current' into title,href,context_state from public.wealth_holdings h join public.wealth_entries e on e.id=h.id and e.user_id=actor where h.id=record_id and h.user_id=actor;
   when 'transactions' then select 'Movimento em '||p.name,'/apps/wealth/carteiras/'||p.id,'recorded' into title,href,context_state from public.wealth_portfolio_transactions t join public.wealth_portfolios p on p.id=t.portfolio_id and p.user_id=actor where t.id=record_id and t.user_id=actor;
   when 'plans' then select p.title,'/apps/wealth/planejamento/'||p.id,'hypothetical' into title,href,context_state from public.wealth_life_plans p where id=record_id and user_id=actor;
   when 'documents' then select case when status='deleted' then 'Documento removido' else d.title end,case when status='deleted' then null else '/apps/wealth/documentos/'||d.id end,case when status='deleted' then 'removed' else 'current' end into title,href,context_state from public.wealth_documents d where id=record_id and user_id=actor;
   else null;
  end case;
  items:=items||jsonb_build_array((item-'entity_id')||jsonb_build_object('title',coalesce(title,'Registro indisponível'),'href',href,'contextState',coalesce(context_state,'unavailable')));
 end loop;
 return jsonb_set(result,'{items}',items);
end;$$;
revoke all on function ecosystem_private.wealth_timeline(date,date,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function ecosystem_private.wealth_timeline(date,date,integer,text,text,timestamptz) to authenticated;
create function public.wealth_timeline(p_from date,p_to date,p_page integer default 1,p_source text default null,p_operation text default null,p_as_of timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$select ecosystem_private.wealth_timeline(p_from,p_to,p_page,p_source,p_operation,p_as_of);$$;
revoke all on function public.wealth_timeline(date,date,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.wealth_timeline(date,date,integer,text,text,timestamptz) to authenticated;
commit;
