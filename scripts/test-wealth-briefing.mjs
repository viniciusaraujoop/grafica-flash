import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'

registerHooks({resolve(s,c,next){return next(s==='./core'&&c.parentURL?.endsWith('/briefing.ts')?'./core.ts':s,c)}})
const {readDailyBriefing,briefingMode}=await import('../lib/wealth/briefing.ts')
const db=await createTestDatabase();after(()=>db.close())

await db.exec(`
 alter table public.wealth_entries add column valuation_status text not null default 'MANUAL_VALUE';
 create table public.wealth_recurring_schedules(
  id uuid primary key,user_id uuid not null references auth.users(id),title text not null,kind text not null,
  amount_cents bigint not null,currency text not null default 'BRL',status text not null default 'active',
  next_date date,timezone text not null default 'America/Sao_Paulo'
 );
 create table public.wealth_debt_terms(id uuid primary key references public.wealth_entries(id),minimum_cents bigint not null,next_due_date date);
 create table public.wealth_documents(id uuid primary key,user_id uuid not null references auth.users(id),status text not null default 'active');
 create table public.wealth_protection_policies(
  id uuid primary key,user_id uuid not null references auth.users(id),status text not null default 'declared',
  ends_on date,document_id uuid,archived_at timestamptz
 );
 create table public.wealth_portfolios(id uuid primary key,user_id uuid not null references auth.users(id),kind text not null);
 create table public.wealth_holdings(id uuid primary key references public.wealth_entries(id),user_id uuid not null references auth.users(id),portfolio_id uuid not null references public.wealth_portfolios(id),maturity date);
 create table public.wealth_portfolio_transactions(
  id uuid primary key,user_id uuid not null references auth.users(id),holding_id uuid not null references public.wealth_holdings(id),
  type text not null,amount_cents bigint not null,basis_removed_cents bigint,realized_gain_cents bigint,financial_date date not null
 );
 grant select on public.wealth_recurring_schedules,public.wealth_debt_terms,public.wealth_documents,public.wealth_protection_policies,public.wealth_portfolios,public.wealth_holdings,public.wealth_portfolio_transactions to authenticated;
`)
await db.exec(readFileSync('supabase/migrations/20260927132000_wealth_morning_night_briefing.sql','utf8'))

const U=ids.a,B=ids.b
const eIncome='aaaaaaaa-0000-4000-8000-000000000001',eExpense='aaaaaaaa-0000-4000-8000-000000000002',debt='aaaaaaaa-0000-4000-8000-000000000003',asset='aaaaaaaa-0000-4000-8000-000000000004'
const p='bbbbbbbb-0000-4000-8000-000000000001'
const query=async(mode='morning',date='2026-09-27')=>readDailyBriefing((await db.query('select public.wealth_daily_briefing($1,$2) v',[mode,date])).rows[0].v)

async function seed(){
 await asAdmin(db)
 await db.query("update public.wealth_profiles set timezone='America/Sao_Paulo' where user_id=$1",[U])
 await db.query(`insert into public.wealth_entries(id,user_id,kind,title,category,amount_cents,currency,financial_date,recurrence,idempotency_key,valuation_status)
 values($1,$5,'income','Receita','salary',100000000000000,'BRL','2026-09-27','none',gen_random_uuid(),'MANUAL_VALUE'),
 ($2,$5,'expense','Despesa','other',250,'BRL','2026-09-27','none',gen_random_uuid(),'MANUAL_VALUE'),
 ($3,$5,'liability','Dívida','loan',5000,'BRL','2026-09-01','none',gen_random_uuid(),'MANUAL_VALUE'),
 ($4,$5,'asset','Ativo','investment',0,'BRL','2026-09-01','none',gen_random_uuid(),'NOT_AVAILABLE')`,[eIncome,eExpense,debt,asset,U])
 await db.query("insert into public.wealth_debt_terms values($1,500,'2026-09-26')",[debt])
 await db.query(`insert into public.wealth_recurring_schedules(id,user_id,title,kind,amount_cents,status,next_date)
 values(gen_random_uuid(),$1,'Atrasada','expense',1200,'active','2026-09-26'),
 (gen_random_uuid(),$1,'Amanhã','expense',800,'active','2026-09-28')`,[U])
 await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,currency,idempotency_key,status) values($1,'Meta',10000,1000,500,'2026-10-10','BRL',gen_random_uuid(),'active')",[U])
 await db.query("insert into public.wealth_protection_policies values(gen_random_uuid(),$1,'declared','2026-10-05',null,null)",[U])
 await db.query("insert into public.wealth_portfolios values($1,$2,'real')",[p,U])
 await db.query("insert into public.wealth_holdings values($1,$2,$3,'2026-09-28')",[asset,U,p])
 await db.query("insert into public.wealth_portfolio_transactions values(gen_random_uuid(),$1,$2,'sell',450,null,null,'2026-09-27')",[U,asset])
 await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,currency,financial_date,recurrence,idempotency_key,valuation_status) values($1,'income','B other','salary',999,'BRL','2026-09-27','none',gen_random_uuid(),'MANUAL_VALUE')",[B])
}
await seed()

test('Morning uses only declared owner facts with exact cents and Observe Understand Act links',async()=>{
 await asUser(db,U);const v=await query()
 assert.equal(v.mode,'morning');assert.equal(v.date,'2026-09-27');assert.equal(v.timezone,'America/Sao_Paulo')
 assert.equal(v.stats.today_income,'100000000000000');assert.equal(v.stats.today_expenses,'250');assert.equal(v.stats.today_cash_flow,'99999999999750')
 assert.equal(v.stats.overdue_recurrences,'1');assert.equal(v.stats.overdue_debts,'1');assert.equal(v.stats.tomorrow_items,'2');assert.equal(v.stats.unknown_valuations,'1');assert.equal(v.stats.tax_gaps,'1')
 assert.ok(v.items.some(x=>x.source==='recurrence'&&x.kind==='overdue'))
 assert.ok(v.items.some(x=>x.source==='debt'&&x.kind==='overdue'))
 assert.ok(v.items.some(x=>x.source==='goal'&&x.kind==='due30'))
 assert.ok(v.items.some(x=>x.source==='shield'&&x.kind==='ending'))
 assert.ok(v.items.some(x=>x.source==='portfolio'&&x.kind==='coverage'))
 assert.ok(v.items.some(x=>x.source==='tax'&&x.kind==='coverage'))
 assert.ok(v.items.every(x=>x.href.startsWith('/apps/wealth/')&&x.observe&&x.understand&&x.action_label))
 assert.equal(v.market_provider_status,'NOT_CONFIGURED');assert.equal(v.bank_provider_status,'NOT_CONFIGURED')
})

test('Night reports only registered day changes and tomorrow without inventing external state',async()=>{
 await asUser(db,U);const v=await query('night')
 assert.equal(v.stats.today_cash_records,'2')
 assert.ok(v.items.some(x=>x.source==='cash'&&x.kind==='today'))
 assert.ok(v.items.some(x=>x.source==='portfolio'&&x.kind==='today'&&x.amount_cents==='450'))
 const tomorrow=v.items.find(x=>x.source==='tomorrow');assert.ok(tomorrow);assert.equal(tomorrow.event_date,'2026-09-28')
 assert.ok(!v.items.some(x=>x.source==='recurrence'&&x.kind==='next7'),'Night does not duplicate the Morning upcoming list')
})

test('owner isolation and entitlement are enforced on every read',async()=>{
 await asUser(db,B);const own=await query();assert.equal(own.stats.today_income,'999');assert.equal(own.stats.overdue_recurrences,'0');assert.equal(own.stats.tax_gaps,'0')
 await asUser(db,ids.member);await assert.rejects(()=>query(),e=>e.code==='42501')
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.write'] where user_id=$1",[U]);await asUser(db,U);await assert.rejects(()=>query(),e=>e.code==='42501')
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write','wealth.export'] where user_id=$1",[U])
})

test('invalid mode/date and anonymous access fail closed',async()=>{
 await asUser(db,U);await assert.rejects(()=>query('midday'),e=>e.code==='22023');await assert.rejects(()=>query('morning','1899-12-31'),e=>e.code==='22023')
 await asUser(db,null);await assert.rejects(()=>query(),/permission denied/)
 assert.equal(briefingMode('morning'),'morning');assert.throws(()=>briefingMode('other'))
})

test('domain parser rejects unsafe links, malformed cents and unordered priorities',async()=>{
 await asUser(db,U);const v=await query()
 assert.throws(()=>readDailyBriefing({...v,items:[{...v.items[0],href:'https://evil.example'}]}),/fora do Wealth/)
 assert.throws(()=>readDailyBriefing({...v,stats:{...v.stats,today_income:'1.2'}}),/Contagem/)
 if(v.items.length>1)assert.throws(()=>readDailyBriefing({...v,items:[{...v.items[0],priority:99},{...v.items[1],priority:1}]}),/Prioridade/)
})
