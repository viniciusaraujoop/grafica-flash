import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
registerHooks({resolve(s,c,next){return next(s==='./core'&&c.parentURL?.endsWith('/fees.ts')?'./core.ts':s,c)}})
const {feeFilters,readFeeAnalysis}=await import('../lib/wealth/fees.ts')
const db=await createTestDatabase();after(()=>db.close())
for(const f of ['20260926165000_wealth_debt_center.sql','20260926171000_wealth_debt_conflict_response.sql','20260926180000_wealth_net_worth.sql','20260926181546_wealth_portfolio_foundation.sql','20260926185024_wealth_portfolio_target_binding.sql','20260926190250_wealth_portfolio_blind_dml_guard.sql','20260927001122_wealth_fee_analyzer.sql'])await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'))
const input=v=>({confirmed:'yes',idempotency_key:randomUUID(),...v}),rpc=async(op,v)=>(await db.query('select public.manage_wealth_portfolio($1,$2) id',[op,input(v)])).rows[0].id
const read=async(from='2024-02-01',to='2024-02-29',page=1,p=null)=>readFeeAnalysis((await db.query('select public.wealth_fee_analysis($1,$2,$3,$4) v',[from,to,page,p])).rows[0].v)
let portfolio,holding,foreign,lab
test('declared costs reuse immutable ledger, preserve cents, distinguish taxes and dates, include archived positions',async()=>{
 await asUser(db,ids.a);portfolio=await rpc('create',{name:'Custos QA',kind:'real'})
 holding=await rpc('holding',{portfolio_id:portfolio,title:'Posição QA',instrument:'QA',quantity:'1',cost_basis_cents:'100',amount_cents:'100',financial_date:'2024-01-01',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Synthetic'})
 for(const [type,amount_cents,financial_date] of [['fee','101','2024-02-29'],['tax','29','2024-02-01'],['fee','13','2024-01-03'],['fee','500','2024-01-02'],['income','999','2024-02-20'],['fee','777','2024-03-01']]){
  const version=(await db.query('select version from public.wealth_entries where id=$1',[holding])).rows[0].version
  await rpc('transaction',{holding_id:holding,version,type,quantity:'0',amount_cents,financial_date,reference:'Custo sintético'})
 }
 const v=await read();assert.equal(v.fees,'101');assert.equal(v.taxes,'29');assert.equal(v.record_count,'2');assert.deepEqual(v.previous,{from:'2024-01-03',to:'2024-01-31',fees:'13',taxes:'0',records:'1'});assert.equal(v.months[0].fees,'101')
 const version=(await db.query('select version from public.wealth_entries where id=$1',[holding])).rows[0].version
 await rpc('archive',{holding_id:holding,version});assert.ok((await read()).records.every(r=>r.archived));assert.equal((await read()).fees,'101')
 assert.equal((await db.query("select count(*) n from public.wealth_entries where kind in ('income','expense')")).rows[0].n,0)
})
test('Lab and empty portfolios are explicit coverage gaps, not assumed fee-free investments',async()=>{
 const empty=await rpc('create',{name:'Sem histórico',kind:'real'});lab=await rpc('create',{name:'Hipótese',kind:'lab'})
 const v=await read();assert.equal(v.portfolio_count,'2');assert.equal(v.covered_portfolios,'1');assert.equal(v.lab_count,'1');assert.equal(v.portfolios.find(p=>p.id===empty).records,'0')
 const hypothetical=await read('2024-02-01','2024-02-29',1,lab);assert.equal(hypothetical.selected.kind,'lab');assert.equal(hypothetical.portfolio_count,'0');assert.equal(hypothetical.fees,'0');assert.equal(hypothetical.coverage,'DECLARED_ONLY');assert.equal(hypothetical.external_status,'NOT_CONFIGURED')
})
test('bounded intervals, leap years, timezones and lower date boundary do not invent a partial comparison',async()=>{
 assert.equal((await read('1900-01-01','1900-01-31')).previous,null)
 assert.equal((await read('2024-01-01','2024-12-31')).days,366)
 for(const args of [['2024-01-01','2025-01-01'],['2024-02-29','2024-02-01'],['1899-12-31','1900-01-01'],['2200-12-31','2201-01-01'],[null,'2024-02-01'],['2024-02-01','2024-02-29',0],['2024-02-01','2024-02-29',100001]])await assert.rejects(()=>read(...args),e=>e.code==='22023')
 await db.exec("set timezone='Pacific/Kiritimati'");const one=await read();await db.exec("set timezone='America/Los_Angeles'");assert.deepEqual(await read(),one)
 assert.equal(feeFilters({from:'2024-02-29',to:'2024-02-29'},'2024-02-29').from,'2024-02-29')
 for(const raw of [{from:'2023-02-29'},{from:'2024-02-29',to:'2024-02-01'},{from:'2024-01-01',to:'2025-01-01'},{page:0},{from:['2024-02-01']},{portfolio:'evil'}])assert.throws(()=>feeFilters(raw,'2024-02-29'))
})
test('RLS, explicit ownership, no cross-user/company access, and INVOKER grants',async()=>{
 await asUser(db,ids.b);foreign=await rpc('create',{name:'Private B',kind:'real'});assert.equal((await read()).record_count,'0');await assert.rejects(()=>read('2024-02-01','2024-02-29',1,portfolio),e=>e.code==='42501')
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501');await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
 await asAdmin(db);assert.equal((await db.query("select prosecdef from pg_proc where proname='wealth_fee_analysis'")).rows[0].prosecdef,false)
 // Simulate an inconsistent admin-imported owner reference: all joins must reject it.
 await db.query("insert into public.wealth_portfolio_transactions(user_id,holding_id,type,quantity,amount_cents,financial_date,reference,position_before,position_after) values ($1,$2,'fee',0,99999,'2024-02-15','Foreign binding','{}','{}')",[ids.b,holding]);await asUser(db,ids.b);assert.equal((await read()).record_count,'0')
 await asUser(db,ids.a);assert.equal((await read()).fees,'101')
})
test('complete aggregate exceeds API and JS number limits, pagination stable and independent of totals',async()=>{
 await asAdmin(db)
 await db.query("insert into public.wealth_portfolio_transactions(user_id,holding_id,type,quantity,amount_cents,financial_date,reference,position_before,position_after) select $1,$2,'fee',0,100000000000000,'2025-12-31','Bulk QA','{}','{}' from generate_series(1,1005)",[ids.a,holding]);await asUser(db,ids.a)
 const v=await read('2025-12-31','2025-12-31'),second=await read('2025-12-31','2025-12-31',2),last=await read('2025-12-31','2025-12-31',41)
 assert.equal(v.fees,'100500000000000000');assert.equal(v.record_count,'1005');assert.equal(v.records.length,25);assert.equal(last.records.length,5);assert.equal(v.fees,second.fees);assert.equal(new Set([...v.records,...second.records].map(r=>r.id)).size,50)
 assert.equal((await read('2025-12-31','2025-12-31',42)).records.length,0)
 assert.throws(()=>readFeeAnalysis({...v,fees:'100500000000000001'}),/Histórico incompleto/)
})
test('entitlement expiry/revocation is checked on every read; read-only works, write-only does not',async()=>{
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'] where user_id=$1",[ids.a]);await asUser(db,ids.a);assert.equal((await read()).fees,'101')
 for(const change of ["permissions=array['wealth.write']","permissions=array['wealth.read'],status='revoked'","status='active',starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'"]){await asAdmin(db);await db.query(`update public.ecosystem_product_entitlements set ${change} where user_id=$1`,[ids.a]);await asUser(db,ids.a);await assert.rejects(()=>read(),e=>e.code==='42501')}
})
