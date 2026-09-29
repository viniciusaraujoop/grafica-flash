import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
registerHooks({resolve(s,c,next){return next(s==='./core'&&c.parentURL?.endsWith('/tax.ts')?'./core.ts':s,c)}})
const {taxFilters,readTaxCenter}=await import('../lib/wealth/tax.ts')
const db=await createTestDatabase();after(()=>db.close())
for(const f of ['20260926165000_wealth_debt_center.sql','20260926171000_wealth_debt_conflict_response.sql','20260926180000_wealth_net_worth.sql','20260926181546_wealth_portfolio_foundation.sql','20260926185024_wealth_portfolio_target_binding.sql','20260926190250_wealth_portfolio_blind_dml_guard.sql','20260927013000_wealth_tax_center_foundation.sql'])await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'))
const input=v=>({confirmed:'yes',idempotency_key:randomUUID(),...v}),rpc=async(op,v)=>(await db.query('select public.manage_wealth_portfolio($1,$2) id',[op,input(v)])).rows[0].id
const read=async(from='2026-09-01',to='2026-09-30',page=1,p=null)=>readTaxCenter((await db.query('select public.wealth_tax_center($1,$2,$3,$4) v',[from,to,page,p])).rows[0].v)
let portfolio,holding,lab
test('Tax Center reuses the immutable Portfolio ledger without creating a second cash or tax engine',async()=>{
 await asUser(db,ids.a);portfolio=await rpc('create',{name:'Fiscal QA',kind:'real'})
 holding=await rpc('holding',{portfolio_id:portfolio,title:'Ativo Fiscal',instrument:'QA',quantity:'10',cost_basis_cents:'1000',amount_cents:'1000',financial_date:'2026-09-01',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Synthetic'})
 const tx=async(type,amount,reference=type)=>{
  const version=(await db.query('select version from public.wealth_entries where id=$1',[holding])).rows[0].version
  return rpc('transaction',{holding_id:holding,version,type,quantity:type==='sell'?'3':'0',amount_cents:String(amount),financial_date:'2026-09-26',reference})
 }
 await tx('sell',450,'Venda QA');await tx('income',100);await tx('dividend',200);await tx('interest',50);await tx('tax',29);await tx('fee',999)
 const v=await read();assert.equal(v.taxes,'29');assert.equal(v.income,'350');assert.equal(v.sell_proceeds,'450');assert.equal(v.basis_removed,'300');assert.equal(v.realized_gain,'150')
 assert.equal(v.record_count,'5');assert.equal(v.tax_count,'1');assert.equal(v.income_count,'3');assert.equal(v.sell_count,'1');assert.equal(v.complete_sell_count,'1');assert.equal(v.incomplete_sell_count,'0')
 assert.equal(v.coverage,'DECLARED_LEDGER_ONLY');assert.equal(v.tax_provider_status,'NOT_CONFIGURED');assert.equal(v.tax_rules_status,'NOT_CONFIGURED');assert.equal(v.jurisdiction_status,'UNSPECIFIED');assert.equal(v.filing_status,'NOT_CONFIGURED')
 assert.equal((await db.query("select count(*) n from public.wealth_entries where kind in ('income','expense')")).rows[0].n,0)
 const version=(await db.query('select version from public.wealth_entries where id=$1',[holding])).rows[0].version;await rpc('archive',{holding_id:holding,version})
 assert.ok((await read()).records.every(r=>r.archived))
})
test('missing declared basis/gain remains explicit instead of being fabricated',async()=>{
 await asAdmin(db)
 await db.query("insert into public.wealth_portfolio_transactions(user_id,holding_id,type,quantity,amount_cents,basis_removed_cents,realized_gain_cents,financial_date,reference,position_before,position_after) values ($1,$2,'sell',0,700,null,null,'2026-09-20','Imported incomplete sale','{}','{}')",[ids.a,holding])
 await asUser(db,ids.a);const v=await read();assert.equal(v.sell_count,'2');assert.equal(v.complete_sell_count,'1');assert.equal(v.incomplete_sell_count,'1');assert.equal(v.sell_proceeds,'1150');assert.equal(v.basis_removed,'300');assert.equal(v.realized_gain,'150')
 const row=v.records.find(r=>r.reference==='Imported incomplete sale');assert.equal(row.basis_removed_cents,null);assert.equal(row.realized_gain_cents,null)
})
test('Lab and empty real portfolios are coverage gaps, never taxable assumptions',async()=>{
 const empty=await rpc('create',{name:'Sem eventos',kind:'real'});lab=await rpc('create',{name:'Cenário fiscal',kind:'lab'})
 const v=await read();assert.equal(v.portfolio_count,'2');assert.equal(v.covered_portfolios,'1');assert.equal(v.lab_count,'1');assert.equal(v.portfolios.find(p=>p.id===empty).records,'0')
 const hypothetical=await read('2026-09-01','2026-09-30',1,lab);assert.equal(hypothetical.selected.kind,'lab');assert.equal(hypothetical.portfolio_count,'0');assert.equal(hypothetical.record_count,'0');assert.equal(hypothetical.realized_gain,'0')
})
test('filters are bounded, leap-safe and timezone independent',async()=>{
 assert.equal((await read('2024-01-01','2024-12-31')).days,366)
 for(const args of [['2024-01-01','2025-01-01'],['2026-09-30','2026-09-01'],['1899-12-31','1900-01-01'],['2200-12-31','2201-01-01'],[null,'2026-09-01'],['2026-09-01','2026-09-30',0],['2026-09-01','2026-09-30',100001]])await assert.rejects(()=>read(...args),e=>e.code==='22023')
 await db.exec("set timezone='Pacific/Kiritimati'");const one=await read();await db.exec("set timezone='America/Los_Angeles'");assert.deepEqual(await read(),one)
 assert.equal(taxFilters({},'2026-09-26').from,'2026-01-01')
 for(const raw of [{from:'2023-02-29'},{from:'2026-09-30',to:'2026-09-01'},{from:'2025-01-01',to:'2026-09-01'},{page:0},{from:['2026-09-01']},{portfolio:'evil'}])assert.throws(()=>taxFilters(raw,'2026-09-26'))
})
test('RLS and ownership block cross-user and cross-product reads; function remains INVOKER',async()=>{
 await asUser(db,ids.b);const foreign=await rpc('create',{name:'Private B',kind:'real'});assert.equal((await read()).record_count,'0');await assert.rejects(()=>read('2026-09-01','2026-09-30',1,portfolio),e=>e.code==='42501')
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501');await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
 await asAdmin(db);assert.equal((await db.query("select prosecdef from pg_proc where proname='wealth_tax_center'")).rows[0].prosecdef,false)
 await db.query("insert into public.wealth_portfolio_transactions(user_id,holding_id,type,quantity,amount_cents,financial_date,reference,position_before,position_after) values ($1,$2,'tax',0,99999,'2026-09-15','Foreign owner binding','{}','{}')",[ids.b,holding])
 await asUser(db,ids.b);assert.equal((await read()).record_count,'0');await asUser(db,ids.a);assert.equal((await read()).taxes,'29')
 assert.ok(foreign)
})
test('aggregates stay exact beyond JavaScript Number and API pagination',async()=>{
 await asAdmin(db)
 await db.query("insert into public.wealth_portfolio_transactions(user_id,holding_id,type,quantity,amount_cents,financial_date,reference,position_before,position_after) select $1,$2,'tax',0,100000000000000,'2025-12-31','Bulk tax QA','{}','{}' from generate_series(1,1005)",[ids.a,holding])
 await asUser(db,ids.a);const first=await read('2025-12-31','2025-12-31'),second=await read('2025-12-31','2025-12-31',2),last=await read('2025-12-31','2025-12-31',41)
 assert.equal(first.taxes,'100500000000000000');assert.equal(first.record_count,'1005');assert.equal(first.records.length,25);assert.equal(second.taxes,first.taxes);assert.equal(last.records.length,5);assert.equal(new Set([...first.records,...second.records].map(r=>r.id)).size,50)
 assert.equal((await read('2025-12-31','2025-12-31',42)).records.length,0)
 assert.throws(()=>readTaxCenter({...first,taxes:'100500000000000001'}),/Histórico fiscal incompleto/)
})
test('entitlement is checked on every read',async()=>{
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'],status='active',starts_at=now()-interval '1 day',expires_at=null where user_id=$1",[ids.a]);await asUser(db,ids.a);assert.equal((await read()).taxes,'29')
 for(const change of ["permissions=array['wealth.write']","permissions=array['wealth.read'],status='revoked'","status='active',starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'"]){await asAdmin(db);await db.query(`update public.ecosystem_product_entitlements set ${change} where user_id=$1`,[ids.a]);await asUser(db,ids.a);await assert.rejects(()=>read(),e=>e.code==='42501')}
})
