import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {projectGoal,projectLife,contributionDate,availableMonths}=await import('../lib/wealth/planning.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))
const baseGoal={target_cents:1200,saved_cents:200,monthly_contribution_cents:100,target_date:'2027-01-31',status:'active'}
const goal=async(owner=ids.a)=>(await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,idempotency_key) values($1,'Planning QA',1200,200,100,'2027-01-31',gen_random_uuid()) returning id",[owner])).rows[0].id
const command=async(operation,input)=>(await db.query('select public.manage_wealth_planning($1,$2) id',[operation,input])).rows[0].id
const funding=(id,version=1,extra={})=>({id,version,priority:'high',category:'education',sources:[{kind:'manual',id:null,planned_cents:'100'}],notes:'QA',confirmed:'yes',idempotency_key:randomUUID(),...extra})
const life=(extra={})=>({title:'House QA',event_type:'house',target_date:'2027-01-31',scenario:'BASE',status:'draft',upfront_cents:'1000',monthly_impact_cents:'100',impact_months:12,current_funding_cents:'100',monthly_capacity_cents:'50',reserve_cents:'500',reserve_draw_cents:'100',links:[],assumptions:'Synthetic scenario; no returns',notes:'',confirmed:'yes',idempotency_key:randomUUID(),...extra})
let a,b,plan
test('goal dates clamp month ends, leap years, target days, past dates and horizon',()=>{
 assert.equal(contributionDate('2024-01-31',1),'2024-02-29');assert.equal(contributionDate('2024-02-29',12),'2025-02-28')
 assert.equal(availableMonths('2024-01-31','2024-03-30'),1);assert.equal(availableMonths('2024-01-31','2024-03-31'),2)
 assert.equal(availableMonths('2024-01-31','2024-01-30'),0);assert.equal(contributionDate('2200-12-01',1),null)
 assert.throws(()=>availableMonths('2024-02-30','2024-03-01'))
})
test('goal health covers every explainable state and exact cents without returns',()=>{
 const run=(changes={})=>projectGoal({...baseGoal,...changes},'2026-03-31')
 assert.equal(run().health,'ON_TRACK');assert.equal(run().required,'100');assert.equal(run().projectedDate,'2027-01-31')
 assert.equal(run({monthly_contribution_cents:95}).health,'SLIGHTLY_BEHIND')
 assert.equal(run({monthly_contribution_cents:80}).health,'BEHIND');assert.equal(run({monthly_contribution_cents:200}).health,'AHEAD')
 assert.equal(run({monthly_contribution_cents:0}).health,'NO_DATA');assert.equal(run({saved_cents:1200}).health,'COMPLETED');assert.equal(run({status:'paused'}).health,'PAUSED')
 assert.equal(run({target_date:'2026-04-01'}).required,null)
 assert.equal(run({target_cents:100000000000000,saved_cents:1}).required,'10000000000000')
 assert.equal(projectGoal(baseGoal,'2026-03-31',1).months,'1000')
})
test('life projection avoids adding linked assets, reserves or goals and exposes exact large cost',()=>{
 const p={...life(),upfront_cents:100000000000000,monthly_impact_cents:100000000000000,impact_months:600,current_funding_cents:100,monthly_capacity_cents:50,reserve_cents:500,reserve_draw_cents:100}
 const r=projectLife(p,'2026-03-31');assert.equal(r.cost,'60100000000000000');assert.equal(r.remainingReserve,'400');assert.equal(r.monthlyAfter,'-99999999999950')
 assert.equal(r.upfrontGap,'99999999999900');assert.throws(()=>projectLife({...p,reserve_draw_cents:101},'2026-03-31'))
 assert.equal(projectLife({...p,reserve_cents:null,reserve_draw_cents:0},'2026-03-31').remainingReserve,null)
})
test('funding shares goal CAS, preserves saved amount, is atomic and exactly replayable',async()=>{
 await asUser(db,ids.a);a=await goal();const payload=funding(a)
 assert.equal(await command('funding',payload),a);assert.equal(await command('funding',payload),a)
 const r=(await db.query('select version,saved_cents from wealth_goals where id=$1',[a])).rows[0];assert.equal(r.version,2);assert.equal(r.saved_cents,200)
 await assert.rejects(()=>command('funding',{...payload,notes:'changed'}),e=>e.code==='23505')
 await assert.rejects(()=>command('funding',funding(a)),e=>e.code==='PT409')
 await assert.rejects(()=>command('funding',funding(a,2,{priority:'bad'})),e=>e.code==='23514')
 assert.equal((await db.query('select version from wealth_goals where id=$1',[a])).rows[0].version,2)
})
test('SQL rejects unknown owner fields, invalid references, duplicate sources and malformed precision',async()=>{
 await asUser(db,ids.b);b=await goal(ids.b);await asUser(db,ids.a)
 for(const extra of [{user_id:ids.b},{sources:[{kind:'goal',id:b,planned_cents:'10'}]},{sources:[{kind:'manual',id:b,planned_cents:'10'}]},{sources:[{kind:'manual',planned_cents:'1.5'}]},{sources:[{kind:'manual',planned_cents:'100000000000001'}]},{sources:Array(21).fill({kind:'manual',planned_cents:'0'})},{sources:[{kind:'manual',planned_cents:'0'},{kind:'manual',planned_cents:'1'}]}])await assert.rejects(()=>command('funding',funding(a,2,extra)))
 await assert.rejects(()=>command('funding',funding(b)),e=>e.code==='42501')
})
test('funding binds owned recurring, income and budget sources without creating cash or changing reservations',async()=>{
 const income=(await db.query("insert into wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values($1,'income','One off QA','other',1000,'2026-09-26',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 const recurrence=(await db.query('select public.create_wealth_recurrence($1) id',[{title:'Planned contribution',kind:'expense',category:'investment',amount_cents:100,frequency:'monthly',interval_count:1,start_date:'2027-01-31',timezone:'America/Sao_Paulo',idempotency_key:randomUUID(),confirmed:'yes'}])).rows[0].id
 await command('funding',funding(a,2,{sources:[{kind:'income',id:income,planned_cents:'500'},{kind:'recurring',id:recurrence,planned_cents:'100'},{kind:'budget_surplus',planned_cents:'200'}]}))
 assert.equal((await db.query('select saved_cents from wealth_goals where id=$1',[a])).rows[0].saved_cents,200)
 assert.equal((await db.query('select count(*)::int n from wealth_entries')).rows[0].n,1)
 await db.query("select public.change_wealth_recurrence($1,1,'pause')",[recurrence]);await assert.rejects(()=>command('funding',funding(a,3,{sources:[{kind:'recurring',id:recurrence,planned_cents:'100'}]})),e=>e.code==='42501')
})
test('life plans validate owned goal/debt/real portfolio, exact replay, immutable owner and stale version',async()=>{
 const portfolio=(await db.query("select public.manage_wealth_portfolio('create',$1) id",[{name:'Funding real',kind:'real',confirmed:'yes',idempotency_key:randomUUID()}])).rows[0].id
 const lab=(await db.query("select public.manage_wealth_portfolio('create',$1) id",[{name:'Funding lab',kind:'lab',confirmed:'yes',idempotency_key:randomUUID()}])).rows[0].id
 await assert.rejects(()=>command('life',life({links:[{kind:'portfolio',id:lab}]})),e=>e.code==='42501')
 const payload=life({links:[{kind:'goal',id:a},{kind:'portfolio',id:portfolio}]});plan=await command('life',payload);assert.equal(await command('life',payload),plan)
 assert.equal(await command('life',life({id:plan,version:1,status:'paused'})),plan)
 await assert.rejects(()=>command('life',life({id:plan,version:1})),e=>e.code==='PT409')
 await assert.rejects(()=>command('life',life({links:[{kind:'goal',id:b}]})),e=>e.code==='42501')
 for(const extra of [{upfront_cents:'0.5'},{monthly_capacity_cents:'1e3'},{reserve_draw_cents:'101'},{impact_months:601},{reserve_cents:null},{links:[{kind:'manual'}]},{assumptions:''},{target_date:'2027-02-30'}])await assert.rejects(()=>command('life',life(extra)))
 await assert.rejects(()=>db.query('update public.wealth_life_plans set user_id=$1 where id=$2',[ids.b,plan]),/permission denied/)
})
test('RLS and read/write entitlements protect tables, wrappers, private functions and command receipts',async()=>{
 await asUser(db,ids.b);assert.deepEqual((await db.query('select * from public.wealth_goal_funding')).rows,[]);assert.deepEqual((await db.query('select * from public.wealth_life_plans')).rows,[])
 await assert.rejects(()=>command('life',life({id:plan,version:2})),e=>e.code==='42501')
 for(const permissions of [['wealth.write'],['wealth.read'],[]]){
  await asAdmin(db);await db.query('update ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.a]);await asUser(db,ids.a)
  await assert.rejects(()=>command('funding',funding(a,2)),e=>e.code==='42501');await assert.rejects(()=>command('life',life()),e=>e.code==='42501')
  if(!permissions.includes('wealth.read'))assert.equal((await db.query('select * from public.wealth_life_plans')).rows.length,0)
 }
 await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_planning_commands'),/permission denied/)
 await assert.rejects(()=>db.query("select ecosystem_private.validate_wealth_planning_links('[]',true)"),/permission denied/)
 await asUser(db,null);await assert.rejects(()=>command('life',life()),/permission denied/)
 await asAdmin(db);await db.query("update ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write'] where user_id=$1",[ids.a])
})
test('archive blocks funding, audit contains identifiers only and user deletion cascades planning data',async()=>{
 await asUser(db,ids.a);await db.query('update wealth_goals set archived_at=now() where id=$1',[a]);await assert.rejects(()=>command('funding',funding(a,3)),e=>e.code==='42501')
 await asAdmin(db)
 const events=(await db.query("select * from ecosystem_audit_events where event_type like 'wealth_life_plans.%'")).rows;assert.equal(events.length,2);assert.ok(events.every(e=>e.entity_id===plan&&!JSON.stringify(e).includes('House QA')))
 await db.query('delete from public.company_members where company_id=$1',[ids.companyA]);await db.query('delete from public.companies where id=$1',[ids.companyA]);await db.query('delete from auth.users where id=$1',[ids.a]);assert.equal((await db.query('select count(*)::int n from wealth_life_plans')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from ecosystem_private.wealth_planning_commands')).rows[0].n,0)
})
