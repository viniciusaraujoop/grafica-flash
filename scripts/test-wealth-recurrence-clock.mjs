import assert from 'node:assert/strict'
import {test,beforeEach,afterEach} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,ids,asUser,asAdmin} from './helpers/ecosystem-test-db.mjs'
let db
beforeEach(async()=>{
 db=await createTestDatabase()
 for(const path of ['scripts/fixtures/wealth-queue-baseline.sql','supabase/migrations/20260926110128_wealth_recurring_schedules.sql','supabase/migrations/20260926153138_wealth_recurrence_rpc_boundary.sql','supabase/migrations/20260926164000_wealth_recurrence_clock.sql'])await db.exec(readFileSync(path,'utf8'))
})
afterEach(async()=>{await db?.close()})
async function create(extra={}){
 await asUser(db,ids.a)
 const input={title:'Clock fixture',kind:'expense',category:'housing',amount_cents:29,frequency:'monthly',interval_count:1,start_date:'2026-01-31',max_occurrences:2,timezone:'America/Sao_Paulo',idempotency_key:randomUUID(),confirmed:'yes',...extra}
 return (await db.query('select public.create_wealth_recurrence($1) id',[input])).rows[0].id
}
async function tick(n=25){await asAdmin(db);await db.exec('set role service_role');return (await db.query('select ecosystem_private.run_wealth_recurrence_batch($1) result',[n])).rows[0].result}
async function jobs(){await asAdmin(db);return (await db.query('select * from public.background_jobs order by created_at,id')).rows}

test('clock is private, bounded and never claims unrelated or company jobs; repeated ticks cannot duplicate',async()=>{
 const id=await create()
 await assert.rejects(()=>db.query('select ecosystem_private.run_wealth_recurrence_batch()'),/permission denied/)
 await asUser(db,null);await assert.rejects(()=>db.query('select ecosystem_private.run_wealth_recurrence_batch()'),/permission denied/)
 await asAdmin(db)
 const untouched=(await db.query("insert into public.background_jobs(job_type,company_id) values ('billing.charge',null),('wealth.recurrence',$1) returning id",[ids.companyA])).rows
 assert.equal((await tick(1)).generated,1)
 assert.equal((await tick(1)).generated,1)
 assert.equal((await tick(1)).generated,0)
 const rows=await jobs();assert.ok(rows.filter(row=>untouched.some(x=>x.id===row.id)).every(row=>row.status==='queued'&&row.attempts===0))
 assert.equal((await db.query('select count(*) n from public.wealth_recurrence_occurrences where schedule_id=$1',[id])).rows[0].n,2)
 assert.equal((await db.query('select sum(amount_cents) cents from public.wealth_entries')).rows[0].cents,'58')
})

test('clock recovers only stale Wealth leases and quarantines exhausted/invalid jobs',async()=>{
 const id=await create({max_occurrences:1})
 await asAdmin(db)
 await db.query("update public.background_jobs set status='running',attempts=1,locked_at=now()-interval '10 minutes',locked_by='dead-worker' where payload->>'recurrence_id'=$1",[id])
 const other=(await db.query("insert into public.background_jobs(job_type,status,attempts,locked_at,locked_by) values ('external.webhook','running',1,now()-interval '10 minutes','legacy') returning id")).rows[0]
 assert.equal((await tick()).stale_recovered,1)
 let recovered=(await jobs()).find(row=>row.payload.recurrence_id===id);assert.equal(recovered.status,'retrying');assert.equal(recovered.locked_by,null)
 assert.equal((await db.query('select status from public.background_jobs where id=$1',[other.id])).rows[0].status,'running')
 await db.query('update public.background_jobs set run_after=now() where id=$1',[recovered.id]);assert.equal((await tick()).generated,1)
 await asAdmin(db)
 await db.exec("insert into public.background_jobs(job_type,status,attempts,max_attempts,payload) values ('wealth.recurrence','queued',2,2,'{}'),('wealth.recurrence','queued',0,5,'{\"recurrence_id\":\"invalid\"}')")
 assert.equal((await tick()).needs_attention,2)
 assert.equal((await tick()).generated,0)
})

test('transient failure rolls back all financial writes, retries once; revoked owner is paused',async()=>{
 const id=await create({max_occurrences:1})
 await asAdmin(db)
 await db.exec("create function public.qa_outbox_failure() returns trigger language plpgsql as $$ begin raise exception 'test transient failure' using errcode='40001';end;$$;create trigger qa_outbox_failure before insert on public.transactional_outbox for each row execute function public.qa_outbox_failure();")
 assert.equal((await tick()).retrying,1)
 await asAdmin(db)
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,0)
 assert.equal((await db.query('select count(*) n from public.event_idempotency')).rows[0].n,0)
 assert.equal((await db.query('select next_index from public.wealth_recurring_schedules where id=$1',[id])).rows[0].next_index,0)
 await db.exec('drop trigger qa_outbox_failure on public.transactional_outbox;drop function public.qa_outbox_failure();update public.background_jobs set run_after=now();')
 assert.equal((await tick()).generated,1);assert.equal((await tick()).generated,0)
 const revoked=await create({max_occurrences:1})
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a])
 assert.equal((await tick()).skipped,1)
 await asAdmin(db)
 assert.equal((await db.query('select status from public.wealth_recurring_schedules where id=$1',[revoked])).rows[0].status,'paused')
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,1)
})
