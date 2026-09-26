-- Read-only, explainable inputs. No scoring, payments or new balances.
begin;
create function public.wealth_health_inputs() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); positions jsonb; period date; debts jsonb; recurring jsonb; captures jsonb;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') then raise exception 'wealth read denied' using errcode='42501';end if;
 positions:=public.wealth_net_worth();period:=date_trunc('month',(positions->>'localDate')::date)::date;
 select jsonb_build_object('openCount',count(*)::text,'detailedCount',count(t.id)::text,
  'minimum',coalesce(sum(t.minimum_cents),0)::text,'balance',coalesce(sum(e.amount_cents),0)::text)
 into debts from public.wealth_entries e left join public.wealth_debt_terms t on t.id=e.id
 where e.user_id=actor and e.kind='liability' and e.archived_at is null and e.amount_cents>0;
 -- Each active expense contributes only its next pending occurrence, not a monthly equivalent.
 select jsonb_build_object('activeCount',count(*)::text,'nextPendingTotal',coalesce(sum(amount_cents),0)::text,
  'overdueCount',count(*) filter(where next_run_at<statement_timestamp())::text,
  'next30Count',count(*) filter(where next_run_at>=statement_timestamp() and next_run_at<statement_timestamp()+interval '30 days')::text,
  'next30Amount',coalesce(sum(amount_cents) filter(where next_run_at>=statement_timestamp() and next_run_at<statement_timestamp()+interval '30 days'),0)::text)
 into recurring from public.wealth_recurring_schedules where user_id=actor and kind='expense' and status='active';
 select coalesce(jsonb_agg(composition order by captured_at desc,id),'[]'::jsonb) into captures
 from (select id,captured_at,composition from public.wealth_net_worth_snapshots where user_id=actor order by captured_at desc,id limit 2) s;
 return jsonb_build_object('positions',positions,'summary',public.wealth_summary(period),'debts',debts,'recurring',recurring,'snapshots',captures);
end;$$;
revoke all on function public.wealth_health_inputs() from public,anon,authenticated;
grant execute on function public.wealth_health_inputs() to authenticated;
comment on function public.wealth_health_inputs() is 'Own RLS-protected aggregate inputs only. Current month in owner timezone, all active debts/expenses, next pending expense once per schedule, latest two explicit snapshots. No score or invented history.';
commit;
