import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {timelineQuery,timelinePageHref}=await import('../lib/wealth/timeline.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))

await db.exec(`create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(current_setting('storage.operation',true),'storage.','')=any(ops)$$;
create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select storage.allow_any_operation(array[op])$$;`)
await db.exec(readFileSync('supabase/migrations/20260926214929_wealth_documents_vault.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926220404_wealth_documents_storage_read_compatibility.sql','utf8'))

await db.exec(readFileSync('supabase/migrations/20260926222248_wealth_timeline_read_model.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926222931_wealth_timeline_transaction_binding.sql','utf8'))
const read=async(from='2024-02-29',to=from,page=1,source=null,operation=null,asOf=null)=>(await db.query('select wealth_timeline($1,$2,$3,$4,$5,$6) data',[from,to,page,source,operation,asOf])).rows[0].data
let aEntry,bEntry
test('timeline domain bounds leap years, invalid filters, repeated parameters and stable paging cutoff',()=>{
 const q=timelineQuery({from:'2024-01-01',to:'2024-12-31',source:'documents'},'2024-12-31');assert.equal(q.page,1)
 assert.throws(()=>timelineQuery({from:'2024-01-01',to:'2025-01-01'},'2024-12-31'));assert.throws(()=>timelineQuery({source:['entries','goals']},'2024-01-01'));assert.throws(()=>timelineQuery({operation:'pay'},'2024-01-01'));assert.throws(()=>timelineQuery({from:'2024-02-30'},'2024-03-01'))
 assert.equal(timelineQuery({},'2024-03-01').from,'2023-12-03')
 const href=new URL('https://example.test/'+timelinePageHref(q,'2024-12-31T20:00:00+00:00',2));assert.equal(href.searchParams.get('asOf'),'2024-12-31T20:00:00+00:00');assert.equal(href.searchParams.get('source'),'documents')
})
test('timeline owner-only audit with current context, no amounts or raw entity IDs',async()=>{
 await asUser(db,ids.a);aEntry=(await db.query("insert into wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values($1,'income','Original title','other',100,'2027-01-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 await db.query("update wealth_entries set title='Current title',amount_cents=200 where id=$1",[aEntry])
 await asUser(db,ids.b);bEntry=(await db.query("insert into wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values($1,'income','Foreign secret','other',999,'2027-01-01',gen_random_uuid()) returning id",[ids.b])).rows[0].id
 await asAdmin(db);await db.query("update ecosystem_audit_events set recorded_at='2024-02-29T12:00:00Z'")
 await asUser(db,ids.a);const r=await read();assert.equal(r.total,'2');assert.equal(r.items.length,2);assert.ok(r.items.every(e=>e.title==='Current title'&&!('entity_id'in e)&&!('amount_cents'in e)));assert.ok(!JSON.stringify(r).includes('Foreign secret'));assert.equal(r.items[0].href,`/apps/wealth/lancamentos/${aEntry}`)
 assert.equal((await read('2024-02-29','2024-02-29',1,'entries','insert')).total,'1')
 await assert.rejects(()=>db.query('select * from ecosystem_audit_events'),/permission denied/)
})
test('local timezone midnight and leap day use timestamp bounds, not financial date',async()=>{
 await asAdmin(db);await db.query("insert into wealth_profiles(user_id,timezone) values($1,'America/Sao_Paulo')",[ids.a]);await db.query("update ecosystem_audit_events set recorded_at='2024-03-01T02:59:59Z' where entity_id=$1",[aEntry]);await asUser(db,ids.a)
 assert.equal((await read()).total,'2');assert.equal((await read('2024-03-01')).total,'0')
 await asAdmin(db);await db.query("update ecosystem_audit_events set recorded_at='2024-03-01T03:00:00Z' where entity_id=$1",[aEntry]);await asUser(db,ids.a);assert.equal((await read()).total,'0');assert.equal((await read('2024-03-01')).total,'2')
})
test('pagination orders tied timestamps by unique ID and pins asOf across new activities',async()=>{
 await asAdmin(db);await db.query("insert into ecosystem_audit_events(actor_id,event_type,entity_id,recorded_at) select $1,'wealth_entries.update',$2,'2024-02-29T12:00:00Z' from generate_series(1,65)",[ids.a,aEntry]);await asUser(db,ids.a)
 const first=await read(),second=await read('2024-02-29','2024-02-29',2);assert.equal(first.items.length,50);assert.equal(second.items.length,15);assert.equal(new Set([...first.items,...second.items].map(e=>e.id)).size,65)
 assert.equal((await read('2024-02-29','2024-02-29',1,null,null,'2024-02-29T11:00:00Z')).total,'0')
 for(const args of [['2024-01-01','2025-01-01'],['2024-02-29','2024-02-28'],['2024-02-29','2024-02-29',0],['2024-02-29','2024-02-29',1,'other'],['2024-02-29','2024-02-29',1,null,'payment']])await assert.rejects(()=>read(...args),e=>e.code==='22023')
})
test('malformed or foreign contexts never reveal foreign titles/paths; unrelated audit excluded',async()=>{
 await asAdmin(db);for(const [kind,ref] of [['wealth_entries.update',bEntry],['wealth_entries.update','invalid-id'],['ecosystem_product_entitlements.update',ids.a]])await db.query("insert into ecosystem_audit_events(actor_id,event_type,entity_id,recorded_at) values($1,$2,$3,'2024-02-28T12:00:00Z')",[ids.a,kind,ref]);await asUser(db,ids.a)
 const result=await read('2024-02-28');assert.equal(result.total,'2');assert.ok(result.items.every(e=>e.title==='Registro indisponível'&&e.href===null&&e.contextState==='unavailable'));assert.ok(!JSON.stringify(result).includes(bEntry))
})
test('every supported source resolves bounded owned context, including missing/deleted records',async()=>{
 await asAdmin(db)
 const sources=['wealth_entries','wealth_goals','wealth_profiles','wealth_recurring_schedules','wealth_bill_details','wealth_debt_terms','wealth_net_worth_snapshots','wealth_portfolios','wealth_holdings','wealth_portfolio_transactions','wealth_goal_funding','wealth_life_plans','wealth_documents']
 for(const source of sources)await db.query("insert into ecosystem_audit_events(actor_id,event_type,entity_id,recorded_at) values($1,$2,$3,'2024-02-27T12:00:00Z')",[ids.a,source+'.update',randomUUID()])
 await asUser(db,ids.a);const r=await read('2024-02-27');assert.equal(r.items.length,sources.length);assert.ok(r.items.every(e=>e.contextState==='unavailable'&&e.href===null))
})
test('read-only allowed; write-only, revoked, company member and anonymous denied',async()=>{
 for(const permissions of [['wealth.read'],['wealth.write'],[]]){await asAdmin(db);await db.query('update ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.a]);await asUser(db,ids.a);if(permissions.includes('wealth.read'))assert.equal((await read()).total,'65');else await assert.rejects(()=>read(),e=>e.code==='42501')}
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501');await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
})
