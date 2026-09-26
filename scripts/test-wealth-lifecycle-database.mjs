import assert from 'node:assert/strict'
import {test,before,after} from 'node:test'
import {createTestDatabase,ids,asUser,asAdmin} from './helpers/ecosystem-test-db.mjs'
let db,entry,goal
before(async()=>{db=await createTestDatabase()})
after(async()=>{await db?.close()})
const summary=async()=> (await db.query("select public.wealth_summary('2026-09-01') as result")).rows[0].result
test('complete aggregates include 1205 entries and 105 goals beyond UI/REST limits',async()=>{
 await asUser(db,ids.a)
 await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) select $1,'income','QA aggregate','salary',29,'2026-09-26',gen_random_uuid() from generate_series(1,1205)",[ids.a])
 await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,target_date,idempotency_key) select $1,'QA goal',100,25,'2027-09-26',gen_random_uuid() from generate_series(1,105)",[ids.a])
 const totals=await summary();assert.equal(totals.income,'34945');assert.equal(totals.entryCount,'1205');assert.equal(totals.goalCount,'105');assert.equal(totals.goalTarget,'10500');assert.equal(totals.goalSaved,'2625');assert.equal(totals.months.length,12)
 entry=(await db.query('select * from public.wealth_entries limit 1')).rows[0];goal=(await db.query('select * from public.wealth_goals limit 1')).rows[0]
})
test('archive excludes totals, keeps row, increments version; restore invalidates stale version',async()=>{
 const archived=(await db.query("update public.wealth_entries set archived_at=now(),version=999 where id=$1 and version=1 returning *",[entry.id])).rows[0]
 assert.equal(Number(archived.version),2);assert.ok(archived.archived_at);assert.equal((await summary()).income,'34916')
 assert.equal((await db.query('update public.wealth_entries set archived_at=null where id=$1 and version=1 returning id',[entry.id])).rows.length,0)
 await assert.rejects(()=>db.query("update public.wealth_entries set amount_cents=10 where id=$1",[entry.id]),/restore before editing/)
 await db.query('update public.wealth_entries set archived_at=null where id=$1 and version=2',[entry.id]);assert.equal((await summary()).income,'34945')
 assert.equal((await db.query("update public.wealth_entries set title='stale' where id=$1 and version=1 returning id",[entry.id])).rows.length,0)
})
test('goal edit/completion constraints, archive/restore and immutable identity are enforced by DB',async()=>{
 await assert.rejects(()=>db.query("update public.wealth_goals set status='completed' where id=$1",[goal.id]),/check constraint/)
 await db.query("update public.wealth_goals set saved_cents=100,status='completed' where id=$1 and version=1",[goal.id])
 assert.equal((await summary()).completedGoals,'1')
 await db.query('update public.wealth_goals set archived_at=now() where id=$1 and version=2',[goal.id]);assert.equal((await summary()).goalCount,'104')
 await assert.rejects(()=>db.query('update public.wealth_goals set archived_at=null,target_cents=200 where id=$1',[goal.id]),/archive transitions/)
 await db.query('update public.wealth_goals set archived_at=null where id=$1 and version=3',[goal.id]);assert.equal((await summary()).goalCount,'105')
 await assert.rejects(()=>db.query('update public.wealth_goals set id=gen_random_uuid() where id=$1',[goal.id]),/immutable/)
})
test('summary and lifecycle respect cross-user and read-only entitlements',async()=>{
 await asUser(db,ids.b);assert.equal((await summary()).entryCount,'0');assert.equal((await summary()).goalCount,'0')
 assert.equal((await db.query('update public.wealth_entries set archived_at=now() where id=$1 returning id',[entry.id])).rows.length,0)
 assert.equal((await db.query('update public.wealth_goals set archived_at=now() where id=$1 returning id',[goal.id])).rows.length,0)
 await asUser(db,ids.member);await assert.rejects(()=>summary(),/wealth read denied/)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'] where user_id=$1",[ids.a])
 await asUser(db,ids.a);assert.equal((await summary()).entryCount,'1205');assert.equal((await db.query('update public.wealth_entries set archived_at=now() where id=$1 returning id',[entry.id])).rows.length,0)
})
test('huge aggregate totals return exact strings and anonymous RPC is denied',async()=>{
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write'] where user_id=$1",[ids.a])
 await asUser(db,ids.a);await db.query('update public.wealth_entries set amount_cents=100000000000000')
 const result=await summary();assert.equal(result.income,'120500000000000000');assert.equal(result.categories[0].amount,result.income)
 await assert.rejects(()=>db.query("select public.wealth_summary('2300-01-01')"),/invalid month/)
 await asUser(db,null);await assert.rejects(()=>summary(),/permission denied/)
})
test('archive/restore/completion have private semantic audit events and RPC is invoker',async()=>{
 await asAdmin(db);const events=(await db.query('select distinct event_type from public.ecosystem_audit_events')).rows.map(r=>r.event_type)
 for(const event of ['wealth.entry.archived','wealth.entry.restored','wealth.goal.archived','wealth.goal.restored','wealth.goal.completed'])assert.ok(events.includes(event),event)
 const fn=(await db.query("select prosecdef,proconfig from pg_proc where oid='public.wealth_summary(date)'::regprocedure")).rows[0];assert.equal(fn.prosecdef,false);assert.ok(fn.proconfig.includes('search_path=""'))
})
