import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {automationCommand}=await import('../lib/wealth/automation.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const name of ['20260926110128_wealth_recurring_schedules','20260926153138_wealth_recurrence_rpc_boundary','20260926164000_wealth_recurrence_clock','20260926233156_wealth_automation_center'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'))
const input=(extra={})=>({idempotency_key:randomUUID(),confirmed:'yes',...extra})
const cmd=async(op,data=input())=>(await db.query('select manage_wealth_automation($1,$2) data',[op,data])).rows[0].data
const read=async(page=1,days=null,status=null)=>(await db.query('select wealth_automation_overview($1,$2,$3) data',[page,days,status])).rows[0].data
const create=async(extra={})=>(await db.query('select create_wealth_recurrence($1) id',[{title:'Automation synthetic',kind:'expense',category:'housing',amount_cents:29,frequency:'monthly',interval_count:1,start_date:'2024-01-31',max_occurrences:3,timezone:'America/Sao_Paulo',...input(),...extra}])).rows[0].id
let schedule,foreign,job
test('domain requires explicit confirmation and validates preference windows and identifiers',()=>{
 const f=new FormData();for(const [k,v] of Object.entries(input({operation:'configure',version:0,history_days:30})))f.set(k,String(v));assert.equal(automationCommand(f).input.show_inactive,false);f.set('history_days','8');assert.throws(()=>automationCommand(f));f.set('operation','run');f.delete('confirmed');assert.throws(()=>automationCommand(f))
})
test('overview is owner-bound, bounded, read-only and does not invent clock availability',async()=>{
 await asUser(db,ids.a);schedule=await create();await asUser(db,ids.b);foreign=await create({title:'Foreign private'});await asUser(db,ids.a)
 const v=await read();assert.equal(v.clock,'NOT_CONFIGURED');assert.equal(v.schedule_count,'1');assert.equal(v.summary.due,'1');assert.equal(v.schedules[0].id,schedule);assert.ok(!JSON.stringify(v).includes('Foreign private'));assert.ok(!('payload'in v.schedules[0].job));assert.ok(!('last_error'in v.schedules[0].job));assert.deepEqual(v.commands,[])
 for(const args of [[0],[1,8],[1,30,'invalid']])await assert.rejects(()=>read(...args),e=>e.code==='22023')
 await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_automation_preferences'),/permission denied/);await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_automation_commands'),/permission denied/)
 await assert.rejects(()=>cmd('run',input({user_id:ids.b})),e=>e.code==='22023')
})
test('preferences CAS/replay persist query defaults and cannot overwrite a stale version',async()=>{
 const p=input({version:0,history_days:90,show_inactive:true}),a=await cmd('configure',p);assert.deepEqual(await cmd('configure',p),a)
 await assert.rejects(()=>cmd('configure',{...p,history_days:7}),e=>e.code==='23505');await assert.rejects(()=>cmd('configure',input({version:0,history_days:7,show_inactive:false})),e=>e.code==='PT409')
 const v=await read();assert.equal(v.days,90);assert.equal(v.preferences.version,1);assert.equal(v.preferences.show_inactive,true);assert.equal(v.commands.length,1)
 await asUser(db,ids.b);assert.equal((await read()).preferences.version,0);await asUser(db,ids.a)
})
test('manual batch uses existing engine and exact receipt replay never advances the next occurrence',async()=>{
 const p=input(),a=await cmd('run',p);assert.equal(a.generated,1);assert.deepEqual(await cmd('run',p),a)
 assert.equal((await read()).occurrence_count,'1');assert.equal((await db.query('select sum(amount_cents)::text n from wealth_entries')).rows[0].n,'29')
 assert.equal((await cmd('run')).generated,1);assert.equal((await read()).occurrence_count,'2')
 await asUser(db,ids.b);assert.equal((await read()).occurrence_count,'0');await asUser(db,ids.a)
})
test('pause/resume/cancel reuse schedule CAS; no owner override or direct queue mutations',async()=>{
 const before=(await read()).schedules[0];assert.equal((await cmd('pause',input({id:schedule,version:before.version}))).status,'paused');assert.equal((await cmd('run')).generated,0)
 await assert.rejects(()=>cmd('resume',input({id:schedule,version:before.version})),e=>e.code==='PT409')
 await assert.rejects(()=>cmd('pause',input({id:foreign,version:1})),e=>e.code==='PT409')
 const now=(await read()).schedules[0];assert.equal((await cmd('resume',input({id:schedule,version:now.version}))).status,'active');assert.equal((await cmd('run')).generated,1)
 const done=(await read()).schedules[0];assert.equal(done.status,'completed');assert.equal((await read(1,30,'active')).schedule_count,'0')
 await assert.rejects(()=>db.query("update background_jobs set status='retrying'"),/permission denied/)
})
test('retry is scoped to an unleased current needs-attention job, preserves attempts and rejects stale commands',async()=>{
 const id=await create({max_occurrences:1});await asAdmin(db);job=(await db.query("update background_jobs set status='needs_attention',attempts=5,max_attempts=5,completed_at=now() where payload->>'recurrence_id'=$1 returning id",[id])).rows[0].id
 await asUser(db,ids.b);await assert.rejects(()=>cmd('retry',input({id:job,attempts:5})),e=>e.code==='42501');await asUser(db,ids.a)
 const v=await read();assert.ok(v.schedules.find(s=>s.id===id).job.can_retry)
 await assert.rejects(()=>cmd('retry',input({id:job,attempts:4})),e=>e.code==='PT409')
 const p=input({id:job,attempts:5});await cmd('retry',p);await cmd('retry',p)
 await assert.rejects(()=>cmd('retry',input({id:job,attempts:5})),e=>e.code==='PT409')
 await asAdmin(db);const j=(await db.query('select * from background_jobs where id=$1',[job])).rows[0];assert.equal(j.attempts,5);assert.equal(j.max_attempts,6);assert.equal(j.status,'retrying');await asUser(db,ids.a)
 assert.equal((await cmd('run')).generated,1)
 await asAdmin(db);await db.query("update background_jobs set status='needs_attention',attempts=25,max_attempts=25 where id=$1",[job]);await asUser(db,ids.a);await assert.rejects(()=>cmd('retry',input({id:job,attempts:25})))
})
test('failed generation is atomic and reported as retry, not a successful financial write',async()=>{
 await create({max_occurrences:1});await asAdmin(db);const before=(await db.query('select count(*)::int n from wealth_entries where user_id=$1',[ids.a])).rows[0].n
 await db.exec("create function public.qa_automation_failure() returns trigger language plpgsql as $$begin raise exception 'fixture transient' using errcode='40001';end;$$;create trigger qa_automation_failure before insert on transactional_outbox for each row execute function public.qa_automation_failure()")
 await asUser(db,ids.a);const result=await cmd('run');assert.equal(result.generated,0);assert.equal(result.retrying,1)
 await asAdmin(db);assert.equal((await db.query('select count(*)::int n from wealth_entries where user_id=$1',[ids.a])).rows[0].n,before);await db.exec('drop trigger qa_automation_failure on transactional_outbox;drop function public.qa_automation_failure()')
})
test('all consumers recheck entitlement, including replay; clock inspection has no activation side effect',async()=>{
 await asUser(db,ids.a);const p=input();await cmd('run',p)
 for(const permissions of [[],['wealth.write'],['wealth.read']]){await asAdmin(db);await db.query('update ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.a]);await asUser(db,ids.a);await assert.rejects(()=>cmd('run',p),e=>e.code==='42501');if(!permissions.includes('wealth.read'))await assert.rejects(()=>read(),e=>e.code==='42501');else assert.ok((await read()).schedules.length)}
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501');await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
 await asAdmin(db);await db.query("update ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write'] where user_id=$1",[ids.a]);await db.exec("create schema cron;create table cron.job(active boolean,command text);insert into cron.job values(false,'select ecosystem_private.run_wealth_recurrence_batch(25)')");await asUser(db,ids.a);assert.equal((await read()).clock,'PAUSED');await asAdmin(db);assert.equal((await db.query('select active from cron.job')).rows[0].active,false)
})
test('leased jobs and the absolute attempt cap cannot be overridden; history is paginated',async()=>{
 await asUser(db,ids.a);const id=await create({max_occurrences:1});await asAdmin(db)
 const row=(await db.query("update background_jobs set status='needs_attention',attempts=25,max_attempts=25 where payload->>'recurrence_id'=$1 returning id",[id])).rows[0]
 await asUser(db,ids.a);await assert.rejects(()=>cmd('retry',input({id:row.id,attempts:25})),e=>e.code==='54000')
 await asAdmin(db);await db.query("update background_jobs set attempts=1,locked_by='live-worker',locked_at=now() where id=$1",[row.id]);await asUser(db,ids.a);await assert.rejects(()=>cmd('retry',input({id:row.id,attempts:1})),e=>e.code==='PT409')
 for(let i=0;i<26;i++){const pref=(await read()).preferences;await cmd('configure',input({version:pref.version,history_days:30,show_inactive:true}))}
 const a=await read(),b=await read(2);assert.equal(a.commands.length,25);assert.ok(b.commands.length>0);assert.ok(b.commands.every(c=>!a.commands.some(d=>d.id===c.id)))
})
