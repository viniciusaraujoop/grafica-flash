-- Wealth Alerts: deterministic current facts plus private user interaction state.
begin;

create table ecosystem_private.wealth_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 minimum_priority text not null default 'info' check(minimum_priority in ('info','attention','urgent')),
 cooldown_hours integer not null default 24 check(cooldown_hours between 1 and 720),
 muted_sources text[] not null default '{}'::text[] check(muted_sources <@ array['recurrence','debt','goal','vault','shield','portfolio','tax','automation']::text[]),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 updated_at timestamptz not null default now()
);

create table ecosystem_private.wealth_alert_state (
 user_id uuid not null references auth.users(id) on delete cascade,
 alert_key text not null check(length(alert_key) between 1 and 240),
 source text not null check(source in ('recurrence','debt','goal','vault','shield','portfolio','tax','automation')),
 entity_id text not null check(length(entity_id) between 1 and 160),
 dismissed_at timestamptz,
 snoozed_until timestamptz,
 last_notified_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,alert_key),
 check(snoozed_until is null or dismissed_at is null)
);
create index wealth_alert_state_owner_updated on ecosystem_private.wealth_alert_state(user_id,updated_at desc,alert_key);

create table ecosystem_private.wealth_alert_commands (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 token uuid not null,
 operation text not null,
 input_hash text not null,
 result jsonb not null,
 recorded_at timestamptz not null default now(),
 unique(user_id,token)
);
create index wealth_alert_commands_owner_history on ecosystem_private.wealth_alert_commands(user_id,recorded_at desc,id);

do $$declare t text;begin
 foreach t in array array['wealth_alert_preferences','wealth_alert_state','wealth_alert_commands'] loop
  execute format('alter table ecosystem_private.%I enable row level security',t);
  execute format('revoke all on ecosystem_private.%I from public,anon,authenticated',t);
  execute format('grant all on ecosystem_private.%I to service_role',t);
 end loop;
end;$$;

create trigger wealth_alert_preferences_audit after insert or update or delete on ecosystem_private.wealth_alert_preferences for each row execute function ecosystem_private.record_change();
create trigger wealth_alert_state_audit after insert or update or delete on ecosystem_private.wealth_alert_state for each row execute function ecosystem_private.record_change();
create trigger wealth_alert_commands_audit after insert on ecosystem_private.wealth_alert_commands for each row execute function ecosystem_private.record_change();

create function ecosystem_private.wealth_alert_candidates(p_actor uuid,p_date date)
returns table(
 alert_key text,priority text,priority_rank integer,source text,reason text,entity_id text,
 title text,detail text,deep_link text,event_date date
)
language sql stable security definer set search_path='' as $$
 with goal_base as materialized (
  select g.*,
   greatest(0,(extract(year from age(g.target_date,p_date))*12+extract(month from age(g.target_date,p_date)))::integer) months_remaining,
   greatest(g.target_cents-g.saved_cents,0)::bigint gap
  from public.wealth_goals g
  where g.user_id=p_actor and g.archived_at is null and g.status='active' and g.currency='BRL' and g.saved_cents<g.target_cents
 ),
 candidates as (
  select
   'recurrence:'||s.id::text||':overdue:'||s.next_date::text alert_key,
   case when p_date-s.next_date>=7 then 'urgent' else 'attention' end priority,
   case when p_date-s.next_date>=7 then 3 else 2 end priority_rank,
   'recurrence' source,'recurrence_overdue' reason,s.id::text entity_id,
   'Recorrência com data vencida' title,
   s.title||' ainda aponta próxima data para '||s.next_date::text||'. Isso não confirma falta de pagamento.' detail,
   '/apps/wealth/recorrencias' deep_link,s.next_date event_date
  from public.wealth_recurring_schedules s
  where s.user_id=p_actor and s.status='active' and s.next_date<p_date

  union all
  select
   'debt:'||e.id::text||':overdue:'||d.next_due_date::text,
   case when p_date-d.next_due_date>=7 then 'urgent' else 'attention' end,
   case when p_date-d.next_due_date>=7 then 3 else 2 end,
   'debt','debt_overdue',e.id::text,
   'Dívida com vencimento declarado no passado',
   e.title||' tem saldo aberto de '||e.amount_cents::text||' centavos e vencimento declarado em '||d.next_due_date::text||'. O credor não é consultado.',
   '/apps/wealth/dividas',d.next_due_date
  from public.wealth_entries e join public.wealth_debt_terms d on d.id=e.id
  where e.user_id=p_actor and e.kind='liability' and e.archived_at is null and e.currency='BRL' and e.amount_cents>0 and d.next_due_date<p_date

  union all
  select
   'goal:'||g.id::text||':past_due:'||g.target_date::text,
   'urgent',3,'goal','goal_past_due',g.id::text,
   'Meta ativa após o prazo declarado',
   g.title||' continua com '||g.gap::text||' centavos até o objetivo depois de '||g.target_date::text||'.',
   '/apps/wealth/metas/'||g.id::text,g.target_date
  from goal_base g where g.target_date<p_date

  union all
  select
   'goal:'||g.id::text||':pacing:'||g.target_date::text,
   'attention',2,'goal','goal_pacing',g.id::text,
   'Aporte declarado abaixo do ritmo da meta',
   g.title||': faltam '||g.gap::text||' centavos em '||g.months_remaining::text||' mês(es) completos; aporte mensal declarado '||g.monthly_contribution_cents::text||' centavos. Sem rendimento presumido.',
   '/apps/wealth/metas/'||g.id::text,g.target_date
  from goal_base g
  where g.target_date>=p_date and g.target_date<=p_date+365 and g.months_remaining>0
    and g.monthly_contribution_cents*greatest(g.months_remaining,1)<g.gap

  union all
  select
   'vault:'||d.id::text||':expiry:'||d.expires_on::text,
   case when d.expires_on<p_date then 'urgent' else 'attention' end,
   case when d.expires_on<p_date then 3 else 2 end,
   'vault',case when d.expires_on<p_date then 'document_expired' else 'document_expiring' end,d.id::text,
   case when d.expires_on<p_date then 'Documento com validade declarada encerrada' else 'Documento perto da validade declarada' end,
   d.title||' tem validade declarada até '||d.expires_on::text||'. A data foi informada pelo usuário; o arquivo não é verificado por emissor.',
   '/apps/wealth/documentos/'||d.id::text,d.expires_on
  from public.wealth_documents d
  where d.user_id=p_actor and d.status='active' and d.expires_on is not null and d.expires_on<=p_date+30

  union all
  select
   'shield:'||p.id::text||':expiry:'||p.ends_on::text,
   case when p.ends_on<p_date then 'urgent' else 'attention' end,
   case when p.ends_on<p_date then 3 else 2 end,
   'shield',case when p.ends_on<p_date then 'protection_expired' else 'protection_expiring' end,p.id::text,
   case when p.ends_on<p_date then 'Proteção com prazo declarado encerrado' else 'Proteção perto do fim declarado' end,
   p.title||' tem término declarado em '||p.ends_on::text||'. Isso não confirma a situação atual junto à seguradora.',
   '/apps/wealth/shield',p.ends_on
  from public.wealth_protection_policies p
  where p.user_id=p_actor and p.archived_at is null and p.status='declared' and p.ends_on is not null and p.ends_on<=p_date+30

  union all
  select
   'portfolio:'||h.id::text||':coverage:'||e.version::text,
   'attention',2,'portfolio','valuation_unavailable',h.id::text,
   'Posição real sem avaliação disponível',
   e.title||' está com valuation_status=NOT_AVAILABLE. Totais patrimoniais podem permanecer parciais.',
   '/apps/wealth/carteiras/'||h.portfolio_id::text,e.financial_date
  from public.wealth_holdings h
  join public.wealth_entries e on e.id=h.id and e.user_id=p_actor and e.archived_at is null
  join public.wealth_portfolios p on p.id=h.portfolio_id and p.user_id=p_actor and p.kind='real'
  where h.user_id=p_actor and e.valuation_status='NOT_AVAILABLE'

  union all
  select
   'tax:'||t.id::text||':evidence',
   'attention',2,'tax','tax_evidence_gap',t.id::text,
   'Venda real com evidência fiscal incompleta',
   'A venda de '||t.financial_date::text||' não tem base removida ou resultado realizado declarado. O Orçaly não calcula imposto devido.',
   '/apps/wealth/impostos',t.financial_date
  from public.wealth_portfolio_transactions t
  join public.wealth_holdings h on h.id=t.holding_id and h.user_id=p_actor
  join public.wealth_portfolios p on p.id=h.portfolio_id and p.user_id=p_actor and p.kind='real'
  where t.user_id=p_actor and t.type='sell' and t.financial_date between p_date-365 and p_date and (t.basis_removed_cents is null or t.realized_gain_cents is null)

  union all
  select
   'automation:'||b.id::text||':attention:'||b.attempts::text,
   case when b.attempts>=5 then 'urgent' else 'attention' end,
   case when b.attempts>=5 then 3 else 2 end,
   'automation','automation_needs_attention',b.id::text,
   'Automação precisa de revisão',
   s.title||' está em needs_attention após '||b.attempts::text||' tentativa(s). Nenhuma nova tentativa é executada por este alerta.',
   '/apps/wealth/automacoes',s.next_date
  from public.background_jobs b
  join public.wealth_recurring_schedules s on s.id::text=b.payload->>'recurrence_id'
  where b.company_id is null and b.job_type='wealth.recurrence' and b.status='needs_attention' and s.user_id=p_actor and s.status='active'
 )
 select * from candidates
 where length(alert_key)<=240 and deep_link like '/apps/wealth/%'
$$;
revoke all on function ecosystem_private.wealth_alert_candidates(uuid,date) from public,anon,authenticated;

create function ecosystem_private.manage_wealth_alerts(p_operation text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); token uuid; fingerprint text; receipt ecosystem_private.wealth_alert_commands;
 pref ecosystem_private.wealth_alert_preferences; candidate record; result jsonb; muted text[]:='{}'; zone text; local_date date; hours integer;
 keys text[]:=array['idempotency_key','confirmed'];
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'alerts denied' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('configure','dismiss','snooze','restore') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid alert command' using errcode='22023';end if;
 if p_operation='configure' then keys:=keys||array['version','enabled','minimum_priority','cooldown_hours','muted_sources'];
 else keys:=keys||array['alert_key'];if p_operation='snooze' then keys:=keys||array['snooze_hours'];end if;end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 token:=(p_input->>'idempotency_key')::uuid;if token is null then raise exception 'missing token' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-alerts:'||actor::text,0));
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into receipt from ecosystem_private.wealth_alert_commands where user_id=actor and wealth_alert_commands.token=token;
 if found then
  if receipt.operation<>p_operation or receipt.input_hash<>fingerprint then raise exception 'command reused' using errcode='23505';end if;
  return receipt.result;
 end if;

 if p_operation='configure' then
  select * into pref from ecosystem_private.wealth_alert_preferences where user_id=actor for update;
  if coalesce(p_input->>'version','')!~'^\d{1,16}$' or (p_input->>'version')::bigint<>coalesce(pref.version,0) then raise exception 'preferences changed' using errcode='PT409';end if;
  if jsonb_typeof(p_input->'enabled') is distinct from 'boolean' or p_input->>'minimum_priority' not in ('info','attention','urgent')
     or coalesce(p_input->>'cooldown_hours','')!~'^\d{1,3}$' or (p_input->>'cooldown_hours')::integer not in (1,6,12,24,48,72,168,720)
     or jsonb_typeof(p_input->'muted_sources') is distinct from 'array' or jsonb_array_length(p_input->'muted_sources')>8 then raise exception 'invalid alert preferences' using errcode='22023';end if;
  select coalesce(array_agg(value order by value),'{}'::text[]) into muted from jsonb_array_elements_text(p_input->'muted_sources') x(value);
  if exists(select 1 from unnest(muted) s where s not in ('recurrence','debt','goal','vault','shield','portfolio','tax','automation'))
     or cardinality(muted)<>(select count(distinct x) from unnest(muted) x) then raise exception 'invalid muted sources' using errcode='22023';end if;
  insert into ecosystem_private.wealth_alert_preferences(user_id,enabled,minimum_priority,cooldown_hours,muted_sources)
   values(actor,(p_input->>'enabled')::boolean,p_input->>'minimum_priority',(p_input->>'cooldown_hours')::integer,muted)
  on conflict(user_id) do update set enabled=excluded.enabled,minimum_priority=excluded.minimum_priority,cooldown_hours=excluded.cooldown_hours,muted_sources=excluded.muted_sources,version=wealth_alert_preferences.version+1,updated_at=clock_timestamp();
  result=jsonb_build_object('status','configured');
 else
  if coalesce(p_input->>'alert_key','')='' or length(p_input->>'alert_key')>240 then raise exception 'invalid alert key' using errcode='22023';end if;
  select coalesce(nullif(timezone,''),'America/Sao_Paulo') into zone from public.wealth_profiles where user_id=actor;
  zone:=coalesce(zone,'America/Sao_Paulo');if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
  local_date:=(statement_timestamp() at time zone zone)::date;
  select * into candidate from ecosystem_private.wealth_alert_candidates(actor,local_date) c where c.alert_key=p_input->>'alert_key';
  if not found then raise exception 'alert changed or unavailable' using errcode='PT409';end if;
  if not exists(select 1 from ecosystem_private.wealth_alert_state where user_id=actor and alert_key=candidate.alert_key) and (select count(*) from ecosystem_private.wealth_alert_state where user_id=actor)>=5000 then raise exception 'alert state capacity reached' using errcode='54000';end if;
  if p_operation='dismiss' then
   insert into ecosystem_private.wealth_alert_state(user_id,alert_key,source,entity_id,dismissed_at,snoozed_until,updated_at)
   values(actor,candidate.alert_key,candidate.source,candidate.entity_id,clock_timestamp(),null,clock_timestamp())
   on conflict(user_id,alert_key) do update set source=excluded.source,entity_id=excluded.entity_id,dismissed_at=excluded.dismissed_at,snoozed_until=null,updated_at=clock_timestamp();
   result=jsonb_build_object('status','dismissed','alert_key',candidate.alert_key);
  elsif p_operation='snooze' then
   if coalesce(p_input->>'snooze_hours','')!~'^\d{1,3}$' then raise exception 'invalid snooze' using errcode='22023';end if;
   hours:=(p_input->>'snooze_hours')::integer;if hours not in (1,6,24,72,168,720) then raise exception 'invalid snooze' using errcode='22023';end if;
   insert into ecosystem_private.wealth_alert_state(user_id,alert_key,source,entity_id,dismissed_at,snoozed_until,updated_at)
   values(actor,candidate.alert_key,candidate.source,candidate.entity_id,null,clock_timestamp()+make_interval(hours=>hours),clock_timestamp())
   on conflict(user_id,alert_key) do update set source=excluded.source,entity_id=excluded.entity_id,dismissed_at=null,snoozed_until=excluded.snoozed_until,updated_at=clock_timestamp();
   result=jsonb_build_object('status','snoozed','alert_key',candidate.alert_key,'hours',hours);
  else
   insert into ecosystem_private.wealth_alert_state(user_id,alert_key,source,entity_id,dismissed_at,snoozed_until,updated_at)
   values(actor,candidate.alert_key,candidate.source,candidate.entity_id,null,null,clock_timestamp())
   on conflict(user_id,alert_key) do update set source=excluded.source,entity_id=excluded.entity_id,dismissed_at=null,snoozed_until=null,updated_at=clock_timestamp();
   result=jsonb_build_object('status','active','alert_key',candidate.alert_key);
  end if;
 end if;
 result:=result||jsonb_build_object('command_id',gen_random_uuid());
 insert into ecosystem_private.wealth_alert_commands(id,user_id,token,operation,input_hash,result)
 values((result->>'command_id')::uuid,actor,token,p_operation,fingerprint,result);
 return result;
end;$$;
revoke all on function ecosystem_private.manage_wealth_alerts(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_alerts(text,jsonb) to authenticated;
create function public.manage_wealth_alerts(p_operation text,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_alerts(p_operation,p_input)$$;
revoke all on function public.manage_wealth_alerts(text,jsonb) from public,anon;
grant execute on function public.manage_wealth_alerts(text,jsonb) to authenticated;

create function ecosystem_private.mark_wealth_alert_notified(p_user uuid,p_alert_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare zone text;local_date date;c record;
begin
 if current_user not in ('postgres','service_role') then raise exception 'internal only' using errcode='42501';end if;
 select coalesce(nullif(timezone,''),'America/Sao_Paulo') into zone from public.wealth_profiles where user_id=p_user;
 zone:=coalesce(zone,'America/Sao_Paulo');if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
 local_date:=(statement_timestamp() at time zone zone)::date;
 select * into c from ecosystem_private.wealth_alert_candidates(p_user,local_date) x where x.alert_key=p_alert_key;
 if not found then return false;end if;
 insert into ecosystem_private.wealth_alert_state(user_id,alert_key,source,entity_id,last_notified_at,updated_at)
 values(p_user,c.alert_key,c.source,c.entity_id,clock_timestamp(),clock_timestamp())
 on conflict(user_id,alert_key) do update set source=excluded.source,entity_id=excluded.entity_id,last_notified_at=excluded.last_notified_at,updated_at=clock_timestamp();
 return true;
end;$$;
revoke all on function ecosystem_private.mark_wealth_alert_notified(uuid,text) from public,anon,authenticated;
grant execute on function ecosystem_private.mark_wealth_alert_notified(uuid,text) to service_role;

create function ecosystem_private.wealth_alerts_overview(p_page integer default 1,p_view text default 'active') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();pref ecosystem_private.wealth_alert_preferences;zone text;local_date date;result jsonb;min_rank integer;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'alerts read denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_view is null or p_view not in ('active','snoozed','dismissed','muted','all') then raise exception 'invalid alert filters' using errcode='22023';end if;
 select * into pref from ecosystem_private.wealth_alert_preferences where user_id=actor;
 select coalesce(nullif(timezone,''),'America/Sao_Paulo') into zone from public.wealth_profiles where user_id=actor;
 zone:=coalesce(zone,'America/Sao_Paulo');if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='America/Sao_Paulo';end if;
 local_date:=(statement_timestamp() at time zone zone)::date;
 min_rank:=case coalesce(pref.minimum_priority,'info') when 'urgent' then 3 when 'attention' then 2 else 1 end;
 with candidates as materialized (
  select c.*,s.dismissed_at,s.snoozed_until,s.last_notified_at,
   case
    when not coalesce(pref.enabled,true) or c.source=any(coalesce(pref.muted_sources,'{}'::text[])) or c.priority_rank<min_rank then 'muted'
    when s.dismissed_at is not null then 'dismissed'
    when s.snoozed_until>statement_timestamp() then 'snoozed'
    else 'active'
   end state
  from ecosystem_private.wealth_alert_candidates(actor,local_date) c
  left join ecosystem_private.wealth_alert_state s on s.user_id=actor and s.alert_key=c.alert_key
 ), projected as materialized (
  select *,
   state='active' and (last_notified_at is null or last_notified_at+make_interval(hours=>coalesce(pref.cooldown_hours,24))<=statement_timestamp()) notification_eligible,
   case when last_notified_at is null then null else last_notified_at+make_interval(hours=>coalesce(pref.cooldown_hours,24)) end cooldown_until
  from candidates
 ), filtered as materialized (
  select * from projected where p_view='all' or state=p_view
 )
 select jsonb_build_object(
  'date',local_date,'timezone',zone,
  'preferences',jsonb_build_object('enabled',coalesce(pref.enabled,true),'minimum_priority',coalesce(pref.minimum_priority,'info'),'cooldown_hours',coalesce(pref.cooldown_hours,24),'muted_sources',coalesce(to_jsonb(pref.muted_sources),'[]'::jsonb),'version',coalesce(pref.version,0)),
  'summary',jsonb_build_object(
   'active',(select count(*)::text from projected where state='active'),
   'urgent',(select count(*)::text from projected where state='active' and priority='urgent'),
   'attention',(select count(*)::text from projected where state='active' and priority='attention'),
   'snoozed',(select count(*)::text from projected where state='snoozed'),
   'dismissed',(select count(*)::text from projected where state='dismissed'),
   'muted',(select count(*)::text from projected where state='muted')
  ),
  'source_coverage',jsonb_build_object('recurrence','ACTIVE','debt','ACTIVE','goal','ACTIVE','vault','ACTIVE','shield','ACTIVE','portfolio','ACTIVE','tax','ACTIVE','automation','ACTIVE'),
  'view',p_view,'count',(select count(*)::text from filtered),
  'alerts',coalesce((select jsonb_agg(to_jsonb(x) order by priority_rank desc,event_date nulls last,source,alert_key) from (
   select alert_key,priority,source,reason,entity_id,title,detail,deep_link,event_date,state,notification_eligible,cooldown_until,snoozed_until,dismissed_at
   from filtered order by priority_rank desc,event_date nulls last,source,alert_key limit 25 offset (p_page-1)*25
  )x),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function ecosystem_private.wealth_alerts_overview(integer,text) from public,anon,authenticated;
grant execute on function ecosystem_private.wealth_alerts_overview(integer,text) to authenticated;
create function public.wealth_alerts_overview(p_page integer default 1,p_view text default 'active') returns jsonb
language sql stable security invoker set search_path='' as $$select ecosystem_private.wealth_alerts_overview(p_page,p_view)$$;
revoke all on function public.wealth_alerts_overview(integer,text) from public,anon;
grant execute on function public.wealth_alerts_overview(integer,text) to authenticated;

comment on function public.wealth_alerts_overview(integer,text) is 'Current factual Wealth alerts. Pull UI only; notification eligibility honors cooldown but does not deliver messages.';
commit;
