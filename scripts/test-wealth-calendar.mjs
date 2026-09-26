import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {parseCalendar,readCalendar,readBills}=await import('../lib/wealth/calendar.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))
const schedule=async(extra={})=>(await db.query('select public.create_wealth_recurrence($1) id',[{title:'Synthetic bill',kind:'expense',category:'other',amount_cents:100,frequency:'monthly',interval_count:1,start_date:'2024-01-31',timezone:'America/Sao_Paulo',idempotency_key:randomUUID(),confirmed:'yes',...extra}])).rows[0].id
const calendar=async(from,to,options={})=>readCalendar((await db.query('select public.wealth_calendar($1,$2,$3,$4,$5,$6,$7) v',[from,to,options.page||1,options.source||'',options.direction||'',options.portfolio||null,options.status||''])).rows[0].v)
const bills=async(month='2024-02-01',page=1)=>readBills((await db.query('select public.wealth_bills($1,$2) v',[month,page])).rows[0].v)
const details=async(id,version=0,previous=null,provider='Vendor QA')=>(await db.query("select public.save_wealth_bill($1,$2,'subscription',$3,$4) v",[id,version,provider,previous])).rows[0].v
const dates=async(id,from,to)=>(await db.query('select financial_date::text d from ecosystem_private.wealth_schedule_dates($1,$2,$3)',[id,from,to])).rows.map(r=>r.d)
let monthly,old,current,foreign
test('calendar filters clamp ranges and reject invalid/repeated values',()=>{
 assert.equal(parseCalendar({date:'2024-02-29'},'2024-02-10').to,'2024-02-29')
 assert.equal(parseCalendar({view:'week',date:'2024-03-03'},'2024-02-10').from,'2024-02-26')
 assert.equal(parseCalendar({view:'agenda',date:'2024-02-29',days:'1'},'2024-02-10').to,'2024-02-29')
 for(const input of [{view:'bad'},{date:'2024-02-30'},{page:'0'},{source:['entry']},{portfolio:'bad'},{view:'agenda',days:'999'}])assert.throws(()=>parseCalendar(input,'2024-02-10'))
})
test('anchor dates preserve leap and month end, finite schedules and old anchors stay bounded',async()=>{
 await asUser(db,ids.a);monthly=await schedule()
 assert.deepEqual(await dates(monthly,'2024-01-01','2024-03-31'),['2024-01-31','2024-02-29','2024-03-31'])
 const leap=await schedule({frequency:'yearly',start_date:'2024-02-29'})
 assert.deepEqual(await dates(leap,'2025-01-01','2025-12-31'),['2025-02-28'])
 const finite=await schedule({max_occurrences:2,end_date:'2024-02-29'})
 assert.deepEqual(await dates(finite,'2024-01-01','2024-12-31'),['2024-01-31','2024-02-29'])
 const ancient=await schedule({frequency:'daily',start_date:'1900-01-01'})
 assert.equal((await dates(ancient,'2024-01-01','2024-12-31')).length,366)
 await assert.rejects(()=>dates(ancient,'2023-01-01','2024-12-31'),/invalid date window/)
})
test('generation ledger deduplicates projected events, including archived declared entries',async()=>{
 await asAdmin(db)
 const e=(await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'expense','Generated QA','other',100,'2024-02-29',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 await db.query("insert into public.wealth_recurrence_occurrences(schedule_id,occurrence_index,financial_date,entry_id) values($1,1,'2024-02-29',$2)",[monthly,e])
 await asUser(db,ids.a)
 let data=await calendar('2024-02-29','2024-02-29');assert.equal(data.events.filter(v=>v.source_id===monthly).length,0);assert.equal(data.events.filter(v=>v.source_id===e).length,1)
 assert.equal(data.events.find(v=>v.source_id===e).context.recurring,true)
 await db.query('update public.wealth_entries set archived_at=now(),version=version+1 where id=$1',[e])
 data=await calendar('2024-02-29','2024-02-29');assert.equal(data.events.filter(v=>[monthly,e].includes(v.source_id)).length,0)
})
test('paused schedules project zero; cancellation keeps only explicit cancelled marker',async()=>{
 const id=await schedule({start_date:'2024-03-02'});await db.query("select public.change_wealth_recurrence($1,1,'pause')",[id])
 assert.equal((await calendar('2024-03-01','2024-03-31')).events.filter(v=>v.source_id===id).length,0)
 assert.equal((await bills('2024-03-01')).bills.find(b=>b.id===id).annual_amount,'0')
 await db.query("select public.change_wealth_recurrence($1,2,'cancel')",[id])
 const events=(await calendar('2024-03-01','2024-03-31',{source:'recurrence',status:'CANCELLED'})).events
 assert.equal(events.find(v=>v.source_id===id).status,'CANCELLED')
})
test('annual projection is actual bounded occurrences, same-day included, totals span every page',async()=>{
 await asAdmin(db)
 await db.query("insert into public.wealth_recurring_schedules(user_id,title,kind,category,amount_cents,frequency,interval_count,start_date,timezone,next_date,next_run_at,idempotency_key,max_occurrences) select $1,'Large '||n,'expense','other',100000000000000,'daily',1,current_date,'UTC',current_date,current_date,gen_random_uuid(),2 from generate_series(1,1100) n",[ids.a])
 await asUser(db,ids.a)
 const result=await bills();assert.equal(result.bills.length,25);assert.ok(BigInt(result.totals.annualExpense)>=220000000000000000n)
 const next=await bills('2024-02-01',2);assert.deepEqual(next.totals,result.totals);assert.ok(next.bills.every(b=>!result.bills.some(x=>x.id===b.id)))
 const data=await calendar(new Date().toISOString().slice(0,10),new Date().toISOString().slice(0,10),{source:'recurrence'});assert.equal(data.events.length,50);assert.ok(Number(data.count)>=1100);assert.equal(data.days.reduce((n,d)=>n+Number(d.count),0),Number(data.count))
})
test('bill classification preserves values; explicit comparable predecessor, CAS and duplicate evidence',async()=>{
 old=await schedule({title:'Older',amount_cents:1000,start_date:'2027-01-01'});await db.query("select public.change_wealth_recurrence($1,1,'cancel')",[old])
 current=await schedule({title:'Current',amount_cents:1250,start_date:'2027-01-01'})
 assert.equal(await details(current,0,old),1)
 let b=(await db.query("select public.wealth_bills('2027-01-01',1,'',$1) v",[current])).rows[0].v.bills[0]
 assert.equal(b.price_change,'250');assert.equal(b.previous_amount,'1000');assert.equal(b.amount_cents,'1250')
 await assert.rejects(()=>details(current,0,old),e=>e.code==='PT409')
 const duplicate=await schedule({amount_cents:1250,start_date:'2027-01-01'});await details(duplicate)
 b=(await db.query("select public.wealth_bills('2027-01-01',1,'',$1) v",[current])).rows[0].v.bills[0];assert.equal(b.duplicate_candidates,'1')
 await assert.rejects(()=>details(duplicate,1,old),e=>e.code==='23505')
 await assert.rejects(()=>details(old,0,current),/incomparable predecessor/)
 assert.equal(await details(current,1,old),2)
})
test('portfolio income, maturity, debt and goal remain noncash with separate meaning',async()=>{
 await asAdmin(db)
 const liability=(await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'liability','Debt QA','loan',1000,'2027-01-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 await db.query("insert into public.wealth_debt_terms(id,principal_cents,monthly_rate_bps,minimum_cents,next_due_date,priority) values ($1,1000,100,100,'2027-02-01',1)",[liability])
 await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,idempotency_key) values ($1,'Goal QA',1000,100,100,'2027-02-01',gen_random_uuid())",[ids.a])
 await asUser(db,ids.a)
 const p=(await db.query("select public.manage_wealth_portfolio('create',$1) id",[{name:'Calendar portfolio',kind:'real',confirmed:'yes',idempotency_key:randomUUID()}])).rows[0].id
 const h=(await db.query("select public.manage_wealth_portfolio('holding',$1) id",[{portfolio_id:p,title:'Holding QA',instrument:'QA',quantity:'1',cost_basis_cents:'1000',amount_cents:'1000',financial_date:'2027-01-01',position_class:'stock',liquidity:'unknown',valuation_status:'MANUAL_VALUE',valuation_source:'QA',maturity:'2027-02-01',confirmed:'yes',idempotency_key:randomUUID()}])).rows[0].id
 await db.query("select public.manage_wealth_portfolio('transaction',$1)",[{holding_id:h,version:1,type:'dividend',quantity:'0',amount_cents:'20',financial_date:'2027-02-01',reference:'QA',confirmed:'yes',idempotency_key:randomUUID()}])
 for(const source of ['debt','goal','holding','portfolio']){const e=(await calendar('2027-02-01','2027-02-01',{source})).events[0];assert.ok(e);assert.equal(e.context.cash,false);if(source==='holding')assert.equal(e.amount,null);if(source==='goal')assert.equal(e.amount,'900')}
 assert.equal((await calendar('2027-02-01','2027-02-01',{portfolio:p})).count,'2')
 assert.equal((await calendar('2027-02-01','2027-02-01',{status:'HYPOTHETICAL'})).count,'0')
})
test('RLS, invoker queries, owner binding, write-only and revoked permission deny disclosure/mutation',async()=>{
 await asUser(db,ids.b);foreign=await schedule();assert.equal((await calendar('2027-02-01','2027-02-01',{source:'portfolio'})).count,'0')
 assert.deepEqual((await db.query('select * from public.wealth_bill_details')).rows,[])
 await assert.rejects(()=>details(current),e=>e.code==='42501');await assert.rejects(()=>details(foreign,0,old),/incomparable predecessor/)
 assert.deepEqual(await dates(monthly,'2024-01-01','2024-03-01'),[])
 await assert.rejects(()=>db.query("insert into public.wealth_bill_details(id,user_id,bill_type) values($1,$2,'expense')",[foreign,ids.b]),/permission denied/)
 for(const permissions of [['wealth.write'],['wealth.read'],[]]){
  await asAdmin(db);await db.query('update public.ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.b]);await asUser(db,ids.b)
  await assert.rejects(()=>details(foreign),e=>e.code==='42501')
  if(!permissions.includes('wealth.read')){await assert.rejects(()=>calendar('2027-01-01','2027-01-02'),e=>e.code==='42501');await assert.rejects(()=>bills(),e=>e.code==='42501');assert.deepEqual(await dates(foreign,'2024-01-01','2024-03-01'),[])}
 }
 await asUser(db,null);await assert.rejects(()=>bills(),/permission denied/)
 await asAdmin(db);const f=(await db.query("select prosecdef from pg_proc where oid='public.wealth_calendar(date,date,integer,text,text,uuid,text)'::regprocedure")).rows[0];assert.equal(f.prosecdef,false)
})
