import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(specifier,ctx,next){return next(['./core','./summary','./net-worth'].includes(specifier)?new URL(`../lib/wealth/${specifier.slice(2)}.ts`,import.meta.url).href:specifier,ctx)}})
const {readHealthInputs,healthIndicators,healthRatio}=await import('../lib/wealth/health.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const file of ['20260926110128_wealth_recurring_schedules.sql','20260926165000_wealth_debt_center.sql','20260926171000_wealth_debt_conflict_response.sql','20260926180000_wealth_net_worth.sql','20260926190000_wealth_financial_health.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
const inputs=async()=>readHealthInputs((await db.query('select public.wealth_health_inputs() value')).rows[0].value)
test('zero denominators and absent history are explicit, with ten explained indicators including the scenario',async()=>{
 await asUser(db,ids.a);const result=await inputs(),indicators=healthIndicators(result)
 assert.equal(indicators.length,9);assert.ok(indicators.every(i=>['title','value','source','period','rule','interpretation','limitation'].every(k=>i[k])))
 assert.match(indicators.find(i=>i.id==='reserve').value,/Não calculável/);assert.match(indicators.find(i=>i.id==='trend').value,/dois snapshots/)
 assert.equal(healthRatio(1n,0n),null);assert.equal(healthRatio(-1n,3n,100),'-33,33');assert.equal(healthRatio(300000000000000000n,100000000000000000n),'3,00')
})
test('complete inputs use owner month, all debts and only the next expense per active schedule',async()=>{
 await asAdmin(db)
 await db.query(`insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,position_class,liquidity,idempotency_key) values
 ($1,'asset','Reserva','investment',60000,current_date,'savings','immediate',gen_random_uuid()),
 ($1,'income','Renda','salary',20000,current_date,null,'unknown',gen_random_uuid()),
 ($1,'expense','Despesa atual','other',5000,current_date,null,'unknown',gen_random_uuid()),
 ($1,'expense','Despesa anterior','other',30000,(date_trunc('month',current_date)-interval '1 month')::date,null,'unknown',gen_random_uuid()),
 ($1,'liability','Sem termos','loan',100,current_date,null,'unknown',gen_random_uuid())`,[ids.a])
 await db.query(`insert into public.wealth_recurring_schedules(user_id,title,kind,category,amount_cents,frequency,start_date,timezone,next_date,next_run_at,idempotency_key)
 values($1,'Conta','expense','other',99,'daily',current_date,'UTC',current_date+1,now()+interval '1 day',gen_random_uuid()),
 ($1,'Receita ignorada','income','other',50000,'daily',current_date,'UTC',current_date+1,now()+interval '1 day',gen_random_uuid()),
 ($2,'Outra conta','expense','other',99999,'daily',current_date,'UTC',current_date+1,now()+interval '1 day',gen_random_uuid())`,[ids.a,ids.b])
 await asUser(db,ids.a)
 const data=await inputs();assert.equal(data.recurring.nextPendingTotal,'99');assert.equal(data.recurring.next30Amount,'99');assert.equal(data.debts.openCount,'1');assert.equal(data.debts.detailedCount,'0')
 const indicators=healthIndicators(data);assert.equal(indicators.find(i=>i.id==='reserve').value,'6,00 meses');assert.equal(indicators.find(i=>i.id==='savings').value,'75,00%');assert.equal(indicators.find(i=>i.id==='liquidity').value,'60000,00%')
 assert.match(indicators.find(i=>i.id==='reserve').limitation,/1 de 3/);assert.equal(indicators.find(i=>i.id==='burden').value,'Parcial: 0,00%')
 const result=await db.query('select public.capture_wealth_net_worth(gen_random_uuid())');assert.ok(result.rows.length)
 await db.query("update public.wealth_entries set amount_cents=60057 where kind='asset'")
 await db.query('select public.capture_wealth_net_worth(gen_random_uuid())')
 const trend=healthIndicators(await inputs()).find(i=>i.id==='trend');assert.match(trend.value,/0,57/)
})
test('RLS and entitlement apply to composed inputs, including snapshots and direct anonymous RPC',async()=>{
 await asUser(db,ids.b);const data=await inputs();assert.equal(data.positions.assets,'0');assert.equal(data.snapshots.length,0);assert.equal(data.recurring.nextPendingTotal,'99999')
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a]);await asUser(db,ids.a)
 await assert.rejects(()=>inputs(),/read denied/)
 await asUser(db,null);await assert.rejects(()=>inputs(),/permission denied/)
 await asAdmin(db);assert.equal((await db.query("select prosecdef from pg_proc where oid='public.wealth_health_inputs()'::regprocedure")).rows[0].prosecdef,false)
})
