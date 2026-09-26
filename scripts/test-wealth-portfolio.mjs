import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
import {readPortfolio,rebalance,futureScenario,quantity} from '../lib/wealth/portfolio.ts'
import {entriesCsv} from '../lib/wealth/records.ts'
const db=await createTestDatabase();after(()=>db.close())
for(const f of ['20260926165000_wealth_debt_center.sql','20260926171000_wealth_debt_conflict_response.sql','20260926180000_wealth_net_worth.sql','20260926181546_wealth_portfolio_foundation.sql','20260926185024_wealth_portfolio_target_binding.sql'])await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'))
const payload=v=>({confirmed:'yes',idempotency_key:randomUUID(),...v})
const rpc=async(op,input)=>(await db.query('select public.manage_wealth_portfolio($1,$2) id',[op,input])).rows[0].id
const view=async id=>readPortfolio((await db.query('select public.wealth_portfolio_view($1) v',[id])).rows[0].v)
const entry=async id=>(await db.query('select * from public.wealth_entries where id=$1',[id])).rows[0]
const nw=async()=>(await db.query('select public.wealth_net_worth() v')).rows[0].v
const holdingInput=(portfolio_id,extra={})=>payload({portfolio_id,title:'Posição sintética',instrument:'QA-UNIT',quantity:'10',cost_basis_cents:'1000',amount_cents:'1234',financial_date:'2026-09-26',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Declaração QA',exposure_currency:'BRL',...extra})
let portfolio,holding,destination
test('one position value, linkage without duplication, idempotency and unavailable valuation coverage',async()=>{
 await asUser(db,ids.a)
 const input=payload({name:'Carteira QA',kind:'real'});portfolio=await rpc('create',input);assert.equal(await rpc('create',input),portfolio)
 await assert.rejects(()=>rpc('create',{...input,name:'Different'}),e=>e.code==='23505')
 await rpc('configure',payload({portfolio_id:portfolio,version:1,name:'Carteira QA',targets:{stock:6000,fixed_income:4000}}))
 assert.equal((await view(portfolio)).portfolio.version,2)
 holding=await rpc('holding',holdingInput(portfolio));assert.equal((await nw()).assets,'1234');assert.equal((await view(portfolio)).value,'1234')
 const linked=(await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'asset','Existing','investment',50,'2026-09-26',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 await rpc('link',holdingInput(portfolio,{entry_id:linked,version:1}));assert.equal((await nw()).assets,'1284');assert.equal((await entry(linked)).version,2)
 await assert.rejects(()=>rpc('link',holdingInput(portfolio,{entry_id:linked,version:2})),e=>e.code==='23505')
 destination=await rpc('holding',holdingInput(portfolio,{quantity:'0',cost_basis_cents:'0',amount_cents:'0'}))
 assert.equal((await view(portfolio)).activeCount,'3')
})
test('weighted basis sale, immutable ledger, stale CAS and replay',async()=>{
 const sell=payload({holding_id:holding,version:1,type:'sell',quantity:'3',amount_cents:'450',financial_date:'2026-09-26',reference:'Venda sintética'})
 const id=await rpc('transaction',sell);assert.equal(await rpc('transaction',sell),id)
 const v=await view(portfolio),tx=v.transactions.find(t=>t.id===id),h=v.holdings.find(h=>h.id===holding)
 assert.equal(tx.basis_removed_cents,'300');assert.equal(tx.realized_gain_cents,'150');assert.equal(h.cost_basis_cents,'700');assert.equal(h.quantity,'7.00000000');assert.equal(h.valuation_status,'NOT_AVAILABLE');assert.equal(v.unknownValuations,'1');assert.equal((await nw()).unknownValuations,'1');assert.equal((await nw()).assets,'50')
 await assert.rejects(()=>rpc('transaction',{...sell,idempotency_key:randomUUID()}),e=>e.code==='PT409')
 await assert.rejects(()=>db.query('update public.wealth_entries set amount_cents=400 where id=$1',[holding]),/Use Portfolio/)
 await assert.rejects(()=>db.query('delete from public.wealth_entries where id=$1',[holding]),/Archive Portfolio/)
 await assert.rejects(()=>db.query('delete from public.wealth_portfolio_transactions'),/permission denied/)
 await assert.rejects(()=>db.query('update public.wealth_holdings set quantity=100'),/permission denied/)
})
test('atomic transfers conserve quantity and basis, invalidate both values, deny foreign target and oversell',async()=>{
 const transfer=payload({holding_id:holding,version:2,type:'transfer',destination_id:destination,destination_version:1,quantity:'2.12345678',amount_cents:'0',financial_date:'2026-09-26',reference:'Transferência QA'})
 const foreign=await asUser(db,ids.b).then(async()=>rpc('create',payload({name:'Foreign',kind:'real'})))
 const foreignHolding=await rpc('holding',holdingInput(foreign));await asUser(db,ids.a)
 await assert.rejects(()=>rpc('transaction',{...transfer,destination_id:foreignHolding}),e=>e.code==='42501');assert.equal((await entry(holding)).version,2)
 await rpc('transaction',transfer)
 const hs=(await view(portfolio)).holdings.filter(h=>[holding,destination].includes(h.id));assert.equal(hs.reduce((s,h)=>s+BigInt(h.cost_basis_cents),0n),700n)
 assert.equal((await db.query('select sum(quantity)::text q from public.wealth_holdings where id=any($1::uuid[])',[[holding,destination]])).rows[0].q,'7.00000000')
 assert.ok(hs.every(h=>h.valuation_status==='NOT_AVAILABLE'))
 await assert.rejects(()=>rpc('transaction',payload({...transfer,idempotency_key:randomUUID(),version:3,type:'sell',quantity:'999'})),/Insufficient quantity/)
 await assert.rejects(()=>rpc('transaction',payload({...transfer,idempotency_key:randomUUID(),version:3,destination_version:1})),e=>e.code==='PT409')
})
test('proceeds and fees do not create cash entries; every supported event is validated',async()=>{
 for(const type of ['income','dividend','interest','fee','tax']){
  const e=await entry(holding)
  await rpc('transaction',payload({holding_id:holding,version:e.version,type,quantity:'0',amount_cents:'17',financial_date:'2026-09-26',reference:'Cash ledger only'}))
 }
 assert.equal((await db.query("select count(*) n from public.wealth_entries where kind in ('income','expense')")).rows[0].n,0)
 for(const type of ['buy','contribution','withdrawal','adjustment']){
  const e=await entry(holding)
  await rpc('transaction',payload({holding_id:holding,version:e.version,type,quantity:type==='adjustment'?'-1':'1',amount_cents:type==='adjustment'?'0':'100',cost_basis_cents:'500',financial_date:'2026-09-26',reference:'Quantity ledger'}))
 }
 const before=await entry(holding)
 await assert.rejects(()=>rpc('transaction',payload({holding_id:holding,version:before.version,type:'dividend',quantity:'1',amount_cents:'10',financial_date:'2026-09-26',reference:'Invalid'})),/Cash event/)
 assert.equal((await entry(holding)).version,before.version)
})
test('valuation sources, archived positions, lab and target allocation remain explicit and isolated',async()=>{
 const value=payload({holding_id:holding,version:(await entry(holding)).version,valuation_status:'IMPORTED_VALUE',amount_cents:'1111',financial_date:'2026-09-26',position_class:'stock',liquidity:'short_term',reference:'Extrato informado pelo titular'})
 await assert.rejects(()=>rpc('value',{...value,valuation_status:'PROVIDER_MARKET_VALUE'}),/not configured/)
 await rpc('value',value);assert.equal((await entry(holding)).amount_cents,1111)
 await rpc('transaction',payload({holding_id:holding,version:(await entry(holding)).version,type:'adjustment',quantity:'0',amount_cents:'0',cost_basis_cents:'650',financial_date:'2026-09-26',reference:'Correction of basis only'}))
 assert.equal((await entry(holding)).amount_cents,1111);assert.equal((await entry(holding)).valuation_status,'IMPORTED_VALUE')
 const before=await nw();const lab=await rpc('create',payload({name:'Laboratório',kind:'lab',lab_positions:[{class:'stock',amount:'99999999'}],targets:{stock:6000,fixed_income:4000}}))
 assert.equal((await nw()).assets,before.assets);assert.equal((await view(lab)).value,'0')
 await assert.rejects(()=>rpc('holding',holdingInput(lab)),/Real portfolio unavailable/)
 await assert.rejects(()=>rpc('configure',payload({portfolio_id:lab,version:1,name:'Bad target',targets:{stock:9999}})),/100 percent/)
 await rpc('archive',payload({holding_id:holding,version:(await entry(holding)).version}));assert.equal(BigInt((await nw()).assets),BigInt(before.assets)-1111n)
 await assert.rejects(async()=>rpc('value',{...value,idempotency_key:randomUUID(),version:(await entry(holding)).version}),/Restore before/)
 await rpc('restore',payload({holding_id:holding,version:(await entry(holding)).version}));assert.equal((await nw()).assets,before.assets)
})
test('owner isolation, goal ownership, revoked entitlements and grants protect every boundary',async()=>{
 await asUser(db,ids.b);await assert.rejects(()=>view(portfolio),e=>e.code==='42501');assert.equal((await db.query('select * from public.wealth_holdings where id=$1',[holding])).rows.length,0)
 await assert.rejects(()=>rpc('transaction',payload({holding_id:holding})),e=>e.code==='42501')
 const goal=(await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,idempotency_key) values ($1,'Goal',100,0,0,'2027-01-01',gen_random_uuid()) returning id",[ids.b])).rows[0].id
 await asUser(db,ids.a);await assert.rejects(()=>rpc('create',payload({name:'Denied',kind:'real',goal_id:goal})),e=>e.code==='42501')
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a]);await asUser(db,ids.a)
 await assert.rejects(()=>rpc('create',payload({name:'Denied',kind:'real'})),e=>e.code==='42501');await assert.rejects(()=>view(portfolio),e=>e.code==='42501');assert.equal((await db.query('select * from public.wealth_portfolios')).rows.length,0)
 await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_portfolio_commands'),/permission denied/)
 await asUser(db,null);await assert.rejects(()=>view(portfolio),/permission denied/)
})
test('exact rebalancing, explicit inflation and future assumptions never alter actual holdings',()=>{
 assert.deepEqual(rebalance([{class:'stock',amount:'100'}],{stock:5000,fixed_income:5000},'1').map(r=>r.difference),['51','-50'])
 const huge=rebalance([{class:'stock',amount:'100000000000000001'}],{stock:3333,fixed_income:6667},'99');assert.equal(huge.reduce((s,r)=>s+BigInt(r.difference),0n),99n)
 assert.throws(()=>rebalance([],{stock:9999},'0'))
 assert.equal(quantity('1,12345678'),'1.12345678');assert.throws(()=>quantity('1.123456789'))
 const s=futureScenario({initial:'10000',monthly:'100',monthlyReturnBps:0,monthlyInflationBps:0,months:12,goalGap:'5000'});assert.equal(s.nominal,'11200');assert.equal(s.real,'11200')
 assert.equal(futureScenario({initial:'-10000',monthly:'100',monthlyReturnBps:100,monthlyInflationBps:0,months:12,goalGap:'0'}).nominal,'-8800')
 assert.equal(futureScenario({initial:'10000',monthly:'0',monthlyReturnBps:100,monthlyInflationBps:100,months:1,goalGap:'0'}).real,'10000')
})
test('all holdings aggregate beyond API pagination and Number precision; limited lists are explicit',async()=>{
 await asUser(db,ids.b);const p=await rpc('create',payload({name:'Integral',kind:'real'}));await asAdmin(db)
 await db.query(`with added as (insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key,position_class)
 select $1,'asset','Integral '||n,'investment',100000000000000,'2026-09-26',gen_random_uuid(),'stock' from generate_series(1,1005) n returning id)
 insert into public.wealth_holdings(id,user_id,portfolio_id,instrument,quantity,cost_basis_cents,valuation_source) select id,$1,$2,'AGG',1,100000000000000,'Synthetic' from added`,[ids.b,p])
 await asUser(db,ids.b);const v=await view(p);assert.equal(v.value,'100500000000000000');assert.equal(v.comparableBasis,v.value);assert.equal(v.holdings.length,25);assert.equal(v.holdingCount,'1005');assert.equal(v.gain,'0')
})
test('unknown valuations export empty money cells, while known zero assets and settled debts remain exportable',()=>{
 const row={id:'qa',title:'QA',kind:'asset',category:'investment',amount_cents:0,financial_date:'2026-09-26',currency:'BRL',recurrence:'none',valuation_status:'NOT_AVAILABLE'}
 const csv=entriesCsv([row]);assert.match(csv,/"avaliacao"/);assert.match(csv,/"2026-09-26";"";"";"BRL"/);assert.match(csv,/NOT_AVAILABLE/)
 assert.match(entriesCsv([{...row,valuation_status:'MANUAL_VALUE'},{...row,kind:'liability',valuation_status:'MANUAL_VALUE'}]),/"0,00";"0"/)
})
