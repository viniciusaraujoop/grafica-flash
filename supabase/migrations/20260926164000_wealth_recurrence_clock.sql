-- Bounded, Wealth-only clock primitive. Scheduling is an explicit environment operation,
-- never a side effect of applying this migration. No network calls or legacy queue work.
begin;
create function ecosystem_private.run_wealth_recurrence_batch(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.background_jobs; result jsonb; worker text:='wealth-clock-'||gen_random_uuid()::text;
 n integer:=greatest(1,least(coalesce(p_limit,25),50)); recovered integer:=0;
 generated integer:=0; skipped integer:=0; retrying integer:=0; attention integer:=0;
begin
 if not pg_try_advisory_xact_lock(208762,640) then return jsonb_build_object('busy',true); end if;
 -- Recovery is restricted to this job type and never touches company jobs.
 with stale as (
  select id from public.background_jobs
  where job_type='wealth.recurrence' and company_id is null and status='running'
   and (locked_at is null or locked_at<=now()-interval '5 minutes')
  order by locked_at nulls first,id for update skip locked limit n
 )
 update public.background_jobs b set
  status=case when b.attempts>=b.max_attempts then 'needs_attention' else 'retrying' end,
  run_after=case when b.attempts>=b.max_attempts then b.run_after else now()+interval '30 seconds' end,
  locked_at=null,locked_by=null,
  completed_at=case when b.attempts>=b.max_attempts then now() else null end,
  last_error='wealth_stale_worker_recovered',metadata=b.metadata||jsonb_build_object('stale_recovered_at',now())
 from stale where b.id=stale.id;
 get diagnostics recovered=row_count;
 for j in select * from public.background_jobs
  where job_type='wealth.recurrence' and company_id is null and status in ('queued','retrying') and run_after<=now()
  order by run_after,created_at,id for update skip locked limit n
 loop
  if j.attempts>=j.max_attempts then
   update public.background_jobs set status='needs_attention',completed_at=now(),last_error='wealth_attempts_exhausted' where id=j.id;
   attention:=attention+1;continue;
  end if;
  update public.background_jobs set status='running',attempts=attempts+1,locked_at=now(),locked_by=worker,started_at=coalesce(started_at,now()) where id=j.id;
  begin
   result:=public.process_wealth_recurrence(j.id,worker);
   perform public.settle_background_job(j.id,worker,'completed',null,null,result);
   if result->>'status'='generated' then generated:=generated+1;else skipped:=skipped+1;end if;
  exception when others then
   -- Nested transaction rolls back every financial write before recording retry.
   if j.attempts+1>=j.max_attempts or sqlstate in ('22023','22P02','23502','23503','23514') then
    perform public.settle_background_job(j.id,worker,'needs_attention',null,'wealth_recurrence_failed','{}'::jsonb);attention:=attention+1;
   else
    perform public.settle_background_job(j.id,worker,'retrying',now()+make_interval(secs=>least(3600,30*(2^least(j.attempts,7)))::integer),'wealth_recurrence_retry','{}'::jsonb);retrying:=retrying+1;
   end if;
  end;
 end loop;
 return jsonb_build_object('busy',false,'generated',generated,'skipped',skipped,'retrying',retrying,'needs_attention',attention,'stale_recovered',recovered);
end;
$$;
revoke all on function ecosystem_private.run_wealth_recurrence_batch(integer) from public,anon,authenticated;
grant execute on function ecosystem_private.run_wealth_recurrence_batch(integer) to service_role;
comment on function ecosystem_private.run_wealth_recurrence_batch(integer) is 'Trusted clock only; bounded Wealth-only claim/recovery. Register clock separately per environment. No external calls.';
commit;
