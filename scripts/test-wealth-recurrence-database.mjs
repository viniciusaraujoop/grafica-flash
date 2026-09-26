import assert from 'node:assert/strict'
import {test,before,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,ids,asUser,asAdmin} from './helpers/ecosystem-test-db.mjs'
let db
before(async()=>{
 db=await createTestDatabase()
 await db.exec(readFileSync(new URL('./fixtures/wealth-queue-baseline.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/20260926110128_wealth_recurring_schedules.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/20260926153138_wealth_recurrence_rpc_boundary.sql',import.meta.url),'utf8'))
})
after(async()=>{await db?.close()})
const payload=(extra={})=>({title:'Aluguel sintético',kind:'expense',category:'housing',amount_cents:120050,frequency:'monthly',interval_count:1,start_date:'2026-01-31',max_occurrences:3,timezone:'America/Sao_Paulo',idempotency_key:randomUUID(),confirmed:'yes',...extra})
async function create(input){return (await db.query('select public.create_wealth_recurrence($1) id',[input])).rows[0].id}
async function schedule(id){return (await db.query('select * from public.wealth_recurring_schedules where id=$1',[id])).rows[0]}
async function worker(){await asAdmin(db);await db.exec('set role service_role')}
async function claim(){return (await db.query("select * from public.claim_background_jobs('qa-worker',1)")).rows[0]}
async function processJob(job,workerId='qa-worker'){return (await db.query('select public.process_wealth_recurrence($1,$2) result',[job.id,workerId])).rows[0].result}
async function settle(job,status='completed'){return (await db.query('select public.settle_background_job($1,$2,$3)',[job.id,'qa-worker',status])).rows[0]}
let recurrence
test('creation is owner scoped, atomic and idempotent; invalid requests cannot queue work',async()=>{
 await asUser(db,ids.a)
 const input=payload({user_id:ids.b});recurrence=await create(input)
 assert.equal(await create(input),recurrence)
 assert.equal((await schedule(recurrence)).user_id,ids.a)
 await assert.rejects(()=>create({...input,amount_cents:1}),/idempotency conflict/)
 await assert.rejects(()=>create(payload({timezone:'Invalid/Zone'})),/invalid timezone/)
 await assert.rejects(()=>create(payload({confirmed:'no'})),/invalid recurrence/)
 await assert.rejects(()=>db.query("update public.wealth_recurring_schedules set user_id=$1",[ids.b]),/permission denied/)
 await assert.rejects(()=>db.query("select public.process_wealth_recurrence(gen_random_uuid(),'forged')"),/permission denied/)
 await asUser(db,ids.b);assert.equal(await schedule(recurrence),undefined)
 assert.equal((await db.query("select public.change_wealth_recurrence($1,1,'pause') changed",[recurrence])).rows[0].changed,false)
 await asAdmin(db);assert.equal((await db.query("select count(*) n from public.background_jobs where job_type='wealth.recurrence'")).rows[0].n,1)
})
test('worker generates exactly one declared entry per occurrence, preserving month-end anchor',async()=>{
 await worker()
 const dates=[]
 for(let i=0;i<3;i++){
  const job=await claim();assert.ok(job)
  await assert.rejects(()=>processJob(job,'stale-worker'),/worker lease lost/)
  const result=await processJob(job);assert.equal(result.status,'generated')
  assert.equal((await processJob(job)).status,i===2?'completed':'superseded')
  dates.push((await db.query('select financial_date::text from public.wealth_entries where id=$1',[result.entry_id])).rows[0].financial_date)
  await settle(job)
 }
 assert.deepEqual(dates,['2026-01-31','2026-02-28','2026-03-31'])
 assert.equal((await schedule(recurrence)).status,'completed');assert.equal(await claim(),undefined)
 assert.equal((await db.query("select count(*) n from public.event_idempotency where provider='wealth_recurrence'")).rows[0].n,3)
 assert.equal((await db.query("select count(*) n from public.transactional_outbox where event_type='wealth.recurrence.generated'")).rows[0].n,3)
 await asUser(db,ids.b);assert.equal((await db.query('select * from public.wealth_recurrence_occurrences')).rows.length,0)
 await asUser(db,ids.a);assert.equal((await db.query('select * from public.wealth_recurrence_occurrences')).rows.length,3)
})
test('pause/resume/cancel require current version; denied access pauses without generating money',async()=>{
 await asUser(db,ids.a);const id=await create(payload({max_occurrences:1}))
 const change=async(v,op)=>(await db.query('select public.change_wealth_recurrence($1,$2,$3) result',[id,v,op])).rows[0].result
 assert.equal(await change(null,'pause'),false);assert.equal(await change(1,'pause'),true);assert.equal(await change(1,'resume'),false)
 await worker();const paused=await claim();assert.equal((await processJob(paused)).status,'paused');await settle(paused)
 await asUser(db,ids.a);assert.equal(await change(2,'resume'),true)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a])
 await worker();const blocked=await claim();assert.equal((await processJob(blocked)).status,'access_unavailable');await settle(blocked)
 assert.equal((await schedule(id)).pause_reason,'access_unavailable')
 await asUser(db,ids.a);await assert.rejects(()=>change(4,'resume'),/wealth write denied/)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='active' where user_id=$1",[ids.a])
 await asUser(db,ids.a);assert.equal(await change(4,'cancel'),true);assert.equal(await change(5,'resume'),false)
})
test('future execution is fenced, timezone follows DST and leap-day anchors remain stable',async()=>{
 await asUser(db,ids.a);const id=await create(payload({start_date:'2199-03-10',timezone:'America/New_York'}))
 await worker();const s=await schedule(id);assert.equal(new Date(s.next_run_at).getUTCHours(),16)
 const job=(await db.query("update public.background_jobs set status='running',locked_by='qa-worker' where payload->>'recurrence_id'=$1 returning *",[id])).rows[0]
 await assert.rejects(()=>processJob(job),/occurrence not due/)
 await settle(job,'failed')
 await asAdmin(db)
 const dates=(await db.query("select ecosystem_private.wealth_recurrence_date('2024-02-29','yearly',1,1)::text a, ecosystem_private.wealth_recurrence_date('2024-02-29','yearly',1,4)::text b")).rows[0]
 assert.deepEqual(dates,{a:'2025-02-28',b:'2028-02-29'})
 const offsets=(await db.query("select extract(hour from ('2026-03-07 12:00'::timestamp at time zone 'America/New_York') at time zone 'UTC')::int a, extract(hour from ('2026-03-08 12:00'::timestamp at time zone 'America/New_York') at time zone 'UTC')::int b")).rows[0]
 assert.deepEqual(offsets,{a:17,b:16})
})
test('stale leases recover through existing jobs; commit-before-settlement replay never duplicates',async()=>{
 await asUser(db,ids.a);const id=await create(payload({max_occurrences:1}))
 await worker();const job=await claim();assert.equal((await processJob(job)).status,'generated')
 await db.query("update public.background_jobs set locked_at=now()-interval '10 minutes' where id=$1",[job.id])
 assert.equal((await db.query('select public.recover_stale_background_jobs(60,10) n')).rows[0].n,1)
 await assert.rejects(()=>processJob(job),/worker lease lost/)
 await db.query("update public.background_jobs set run_after=now() where id=$1",[job.id])
 const retry=await claim();assert.equal(retry.id,job.id);assert.equal((await processJob(retry)).status,'completed');await settle(retry)
 assert.equal((await db.query('select count(*) n from public.wealth_recurrence_occurrences where schedule_id=$1',[id])).rows[0].n,1)
})
test('owner refresh never processes another user and rolls back all money on transient failure',async()=>{
 await asUser(db,ids.b);const foreign=await create(payload({max_occurrences:1}))
 await asUser(db,ids.a);const own=await create(payload({max_occurrences:1}))
 await asAdmin(db)
 await db.exec("create function public.qa_fail_outbox() returns trigger language plpgsql as $$ begin raise exception 'synthetic transient failure' using errcode='40001'; end $$; create trigger qa_fail_outbox before insert on public.transactional_outbox for each row execute function public.qa_fail_outbox();")
 await asUser(db,ids.a)
 const failed=(await db.query('select public.run_my_wealth_recurrences() result')).rows[0].result
 assert.equal(failed.retrying,1);assert.equal(failed.generated,0)
 assert.equal((await db.query('select * from public.wealth_recurrence_occurrences where schedule_id=$1',[own])).rows.length,0)
 await asAdmin(db)
 assert.equal((await db.query("select count(*) n from public.event_idempotency where event_id=$1",[own+':0'])).rows[0].n,0)
 assert.equal((await schedule(foreign)).next_index,0)
 await db.exec('drop trigger qa_fail_outbox on public.transactional_outbox; drop function public.qa_fail_outbox();')
 await db.query("update public.background_jobs set run_after=now() where payload->>'recurrence_id'=$1",[own])
 await asUser(db,ids.a)
 assert.equal((await db.query('select public.run_my_wealth_recurrences() result')).rows[0].result.generated,1)
 assert.equal((await db.query('select public.run_my_wealth_recurrences() result')).rows[0].result.generated,0)
 await asAdmin(db);assert.equal((await schedule(foreign)).next_index,0)
})
test('public RPCs are invoker, privileged implementations remain private and anonymous execution is denied',async()=>{
 await asAdmin(db)
 const rows=(await db.query("select n.nspname schema,p.proname name,p.prosecdef definer,p.proconfig config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('create_wealth_recurrence','change_wealth_recurrence','run_my_wealth_recurrences')")).rows
 assert.equal(rows.length,6)
 for(const row of rows){assert.equal(row.definer,row.schema==='ecosystem_private');assert.ok(row.config.includes('search_path=\"\"'))}
 await asUser(db,null)
 await assert.rejects(()=>create(payload()),/permission denied/)
 await assert.rejects(()=>db.query('select public.run_my_wealth_recurrences()'),/permission denied/)
 await asUser(db,ids.member);await assert.rejects(()=>create(payload()),/wealth write denied/)
 await assert.rejects(()=>db.query('select ecosystem_private.run_my_wealth_recurrences()'),/wealth write denied/)
})
