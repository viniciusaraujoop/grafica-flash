import assert from 'node:assert/strict'
import {test,before,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,ids,asUser,asAdmin} from './helpers/ecosystem-test-db.mjs'
let db,id
before(async()=>{db=await createTestDatabase();await db.exec(readFileSync('supabase/migrations/20260926165000_wealth_debt_center.sql','utf8'));await db.exec(readFileSync('supabase/migrations/20260926171000_wealth_debt_conflict_response.sql','utf8'))})
after(async()=>{await db?.close()})
const input=(extra={})=>({title:'Dívida QA',balance_cents:10029,principal_cents:10000,monthly_rate_bps:150,minimum_cents:500,installment_count:12,remaining_installments:10,next_due_date:'2026-10-05',priority:1,financial_date:'2026-09-26',idempotency_key:randomUUID(),confirmed:'yes',...extra})
const save=async(p,entry=null,version=null)=>(await db.query('select public.save_wealth_debt($1,$2,$3) id',[p,entry,version])).rows[0].id
const entry=async(key)=>(await db.query('select * from public.wealth_entries where id=$1',[key])).rows[0]
test('debt creates exactly one liability, ignores forged owner and is idempotent',async()=>{
 await asUser(db,ids.a);const p=input({user_id:ids.b});id=await save(p);assert.equal(await save(p),id)
 assert.equal((await entry(id)).user_id,ids.a);assert.equal((await entry(id)).amount_cents,10029)
 await assert.rejects(()=>save({...p,balance_cents:1}),/idempotency conflict/)
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,1)
 await asUser(db,ids.b);assert.equal(await entry(id),undefined)
 assert.equal((await db.query('select * from public.wealth_debt_terms where id=$1',[id])).rows.length,0)
 await assert.rejects(()=>save(input(),id,1),/unavailable/)
 assert.equal((await db.query('select public.settle_wealth_debt($1,1,true) result',[id])).rows[0].result,false)
})
test('invalid terms roll back the liability; direct table DML and kind changes are denied',async()=>{
 await asUser(db,ids.a)
 await assert.rejects(()=>save(input({remaining_installments:13})),/wealth_debt_installments/)
 await assert.rejects(()=>save(input({monthly_rate_bps:-1})),/Invalid debt/)
 await assert.rejects(()=>save(input({confirmed:'no'})),/confirmation/)
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,1)
 await assert.rejects(()=>db.query('update public.wealth_debt_terms set monthly_rate_bps=0 where id=$1',[id]),/permission denied/)
 await assert.rejects(()=>db.query("update public.wealth_entries set kind='income' where id=$1",[id]),/remain a liability/)
})
test('terms and balance edit atomically; stale/null version, archived entry and anonymous calls fail',async()=>{
 await asUser(db,ids.a)
 assert.equal(await save(input({balance_cents:9029}),id,1),id)
 assert.equal((await entry(id)).version,2)
 await assert.rejects(()=>save(input(),id,1),error=>error.code==='PT409'&&/version conflict/.test(error.message))
 await assert.rejects(()=>save(input(),id,null),/version conflict/)
 await db.query('update public.wealth_entries set archived_at=now() where id=$1',[id])
 await assert.rejects(()=>save(input(),id,3),/version conflict/)
 await db.query('update public.wealth_entries set archived_at=null where id=$1',[id])
 await asUser(db,null);await assert.rejects(()=>save(input()),/permission denied/)
})
test('payoff is an owner declaration with version checking, no second balance or expense',async()=>{
 await asUser(db,ids.a)
 assert.equal((await db.query('select public.settle_wealth_debt($1,4,true) result',[id])).rows[0].result,true)
 assert.equal((await entry(id)).amount_cents,0)
 assert.equal((await db.query('select remaining_installments from public.wealth_debt_terms where id=$1',[id])).rows[0].remaining_installments,0)
 assert.equal((await db.query('select public.settle_wealth_debt($1,4,true) result',[id])).rows[0].result,false)
 assert.equal((await db.query("select count(*) n from public.wealth_entries where kind='expense'")).rows[0].n,0)
 const summary=(await db.query("select public.wealth_summary('2026-09-01') result")).rows[0].result
 assert.equal(summary.liabilities,'0')
})
test('existing liability can be extended without duplication; permission revocation blocks private entry points',async()=>{
 await asUser(db,ids.b)
 const row=(await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'liability','Existente','loan',55,'2026-09-26',gen_random_uuid()) returning id",[ids.b])).rows[0]
 await save(input({title:'Existente',balance_cents:55}),row.id,1)
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,1)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'] where user_id=$1",[ids.b])
 await asUser(db,ids.b);await assert.rejects(()=>save(input(),row.id,2),/write denied/)
 await assert.rejects(()=>db.query('select ecosystem_private.settle_wealth_debt($1,2,true)',[row.id]),/write denied/)
 await asAdmin(db);const audit=(await db.query("select * from public.ecosystem_audit_events where event_type like 'wealth_debt_terms.%'")).rows
 assert.ok(audit.length>=4);assert.ok(audit.every(row=>row.entity_id))
})
