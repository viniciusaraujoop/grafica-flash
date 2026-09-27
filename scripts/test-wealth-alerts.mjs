import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {alertCommand,readAlertsOverview}=await import('../lib/wealth/alerts.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const name of ['20260926110128_wealth_recurring_schedules','20260926153138_wealth_recurrence_rpc_boundary','20260926164000_wealth_recurrence_clock','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'))
await db.exec(`create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(current_setting('storage.operation',true),'storage.','')=any(ops)$$;
create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select storage.allow_any_operation(array[op])$$;`)
for(const name of ['20260926214929_wealth_documents_vault','20260926220404_wealth_documents_storage_read_compatibility','20260926233156_wealth_automation_center','20260927003416_wealth_shield_declared_policies','20260927013000_wealth_tax_center_foundation','20260927162000_wealth_document_expiry','20260927170000_wealth_alert_center'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'))

const dateIn=(n)=>{const d=new Date();const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);const x=new Date(`${p}T12:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
const today=dateIn(0),yesterday=dateIn(-1),plus10=dateIn(10),plus90=dateIn(90)
const input=(extra={})=>({idempotency_key:randomUUID(),confirmed:'yes',...extra})
const cmd=async(op,data=input())=>(await db.query('select public.manage_wealth_alerts($1,$2) v',[op,data])).rows[0].v
const read=async(page=1,view='active')=>readAlertsOverview((await db.query('select public.wealth_alerts_overview($1,$2) v',[page,view])).rows[0].v)
const portfolio=async(op,v)=>(await db.query('select public.manage_wealth_portfolio($1,$2) id',[op,{confirmed:'yes',idempotency_key:randomUUID(),...v}])).rows[0].id
let recurrence,debt,goal,document,policy,holding,job,keys

test('all eight factual sources appear without cross-user data or inferred provider facts',async()=>{
 await asUser(db,ids.a)
 recurrence=(await db.query('select public.create_wealth_recurrence($1) id',[{title:'Overdue recurrence',kind:'expense',category:'housing',amount_cents:100,frequency:'monthly',interval_count:1,start_date:yesterday,timezone:'America/Sao_Paulo',max_occurrences:3,...input()}])).rows[0].id
 debt=(await db.query('select public.save_wealth_debt($1,null,null) id',[{title:'Overdue debt',principal_cents:'5000',monthly_rate_bps:'0',minimum_cents:'500',installment_count:null,remaining_installments:null,next_due_date:yesterday,priority:'1',balance_cents:'5000',financial_date:today,...input()}])).rows[0].id
 goal=(await db.query("insert into public.wealth_goals(user_id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,currency,idempotency_key,status) values($1,'Behind goal',10000,1000,0,$2,'BRL',gen_random_uuid(),'active') returning id",[ids.a,plus90])).rows[0].id
 await asAdmin(db);document=randomUUID();await db.query("insert into public.wealth_documents(id,user_id,title,category,document_date,expires_on,notes,links,mime_type,size_bytes,sha256,status) values($1,$2,'Expiring document','contract',$3,$4,'','[]','application/pdf',10,$5,'active')",[document,ids.a,today,plus10,'a'.repeat(64)]);await asUser(db,ids.a)
 policy=(await db.query('select public.manage_wealth_protection($1,$2) id',['save',{title:'Expiring protection',category:'other',insurer:'',reference:'',coverage_cents:null,deductible_cents:null,premium_cents:null,premium_period:'unknown',starts_on:today,ends_on:plus10,status:'declared',asset_id:null,document_id:null,schedule_id:null,notes:'',...input()}])).rows[0].id
 const p=await portfolio('create',{name:'Alerts real',kind:'real'})
 holding=await portfolio('holding',{portfolio_id:p,title:'Unknown value',instrument:'QA-ALERT',quantity:'10',cost_basis_cents:null,amount_cents:'0',financial_date:today,position_class:'stock',liquidity:'short_term',valuation_status:'NOT_AVAILABLE',valuation_source:'QA',issuer:'',sector:'',exposure_currency:'BRL',maturity:''})
 const version=(await db.query('select version from public.wealth_entries where id=$1',[holding])).rows[0].version
 await portfolio('transaction',{holding_id:holding,version,type:'sell',quantity:'1',amount_cents:'100',financial_date:today,reference:'Tax evidence gap'})
 await asAdmin(db);job=(await db.query("update public.background_jobs set status='needs_attention',attempts=5,max_attempts=5 where payload->>'recurrence_id'=$1 returning id",[recurrence])).rows[0].id;await asUser(db,ids.a)
 const v=await read();assert.equal(v.count,'8');assert.equal(v.summary.active,'8');assert.equal(v.summary.urgent,'2')
 assert.deepEqual(new Set(v.alerts.map(a=>a.source)),new Set(['recurrence','debt','goal','vault','shield','portfolio','tax','automation']))
 assert.ok(v.alerts.every(a=>a.deep_link.startsWith('/apps/wealth/')&&a.notification_eligible))
 assert.equal(v.source_coverage.vault,'ACTIVE')
 await asUser(db,ids.b);const b=await read();assert.equal(b.count,'0');assert.ok(!JSON.stringify(b).includes('Expiring document'));await asUser(db,ids.a)
 keys=Object.fromEntries(v.alerts.map(a=>[a.source,a.alert_key]))
})

test('dismiss snooze restore and preference CAS are private idempotent noise controls',async()=>{
 const d=input({alert_key:keys.recurrence});const first=await cmd('dismiss',d);assert.deepEqual(await cmd('dismiss',d),first)
 assert.equal((await read(1,'dismissed')).alerts[0].source,'recurrence')
 await cmd('snooze',input({alert_key:keys.debt,snooze_hours:24}));assert.equal((await read(1,'snoozed')).alerts[0].source,'debt')
 await cmd('restore',input({alert_key:keys.recurrence}));assert.ok((await read()).alerts.some(a=>a.source==='recurrence'))
 const configured=await cmd('configure',input({version:0,enabled:true,minimum_priority:'attention',cooldown_hours:24,muted_sources:['tax']}));assert.equal(configured.status,'configured')
 let v=await read();assert.ok(!v.alerts.some(a=>a.source==='tax'));assert.equal(v.summary.muted,'1')
 await assert.rejects(()=>cmd('configure',input({version:0,enabled:true,minimum_priority:'info',cooldown_hours:24,muted_sources:[]})),e=>e.code==='PT409')
 await assert.rejects(()=>cmd('configure',input({version:1,enabled:true,minimum_priority:'info',cooldown_hours:24,muted_sources:['tax','tax']})),e=>e.code==='22023')
})

test('cooldown becomes real only when the private delivery boundary records a notification',async()=>{
 await asAdmin(db);await db.exec('set role service_role')
 assert.equal((await db.query('select ecosystem_private.mark_wealth_alert_notified($1,$2) v',[ids.a,keys.goal])).rows[0].v,true)
 await asUser(db,ids.a);const v=await read();const goalAlert=v.alerts.find(a=>a.source==='goal');assert.ok(goalAlert);assert.equal(goalAlert.notification_eligible,false);assert.ok(goalAlert.cooldown_until)
 await assert.rejects(()=>db.query('select ecosystem_private.mark_wealth_alert_notified($1,$2)',[ids.a,keys.goal]),/permission denied/)
})

test('commands recheck read+write entitlement; reads require read and anonymous/private access fail',async()=>{
 for(const permissions of [[],['wealth.write'],['wealth.read']]){
  await asAdmin(db);await db.query('update public.ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.a]);await asUser(db,ids.a)
  await assert.rejects(()=>cmd('dismiss',input({alert_key:keys.goal})),e=>e.code==='42501')
  if(!permissions.includes('wealth.read'))await assert.rejects(()=>read(),e=>e.code==='42501');else assert.ok((await read()).alerts.length)
 }
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501')
 await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
 await asUser(db,ids.a);await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_alert_state'),/permission denied/)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write','wealth.export'] where user_id=$1",[ids.a])
})

test('resolved source disappears even if interaction state remains; malformed domain input fails closed',async()=>{
 await asAdmin(db);await db.query('update public.wealth_debt_terms set next_due_date=$1 where id=$2',[plus10,debt]);await asUser(db,ids.a)
 assert.ok(!(await read(1,'all')).alerts.some(a=>a.alert_key===keys.debt))
 const v=await read();assert.throws(()=>readAlertsOverview({...v,alerts:[{...v.alerts[0],deep_link:'https://evil.example'}]}),/Alerta inválido/)
 const f=new FormData();for(const [k,val] of Object.entries({operation:'configure',idempotency_key:randomUUID(),confirmed:'yes',version:'1',minimum_priority:'attention',cooldown_hours:'24',enabled:'yes'}))f.set(k,String(val));f.append('muted_source','tax');assert.equal(alertCommand(f).input.cooldown_hours,24);f.append('muted_source','tax');assert.throws(()=>alertCommand(f))
})

test('audit exists for private interaction state without persisting derived alert descriptions',async()=>{
 await asAdmin(db)
 const state=(await db.query('select count(*)::int n from ecosystem_private.wealth_alert_state where user_id=$1',[ids.a])).rows[0].n;assert.ok(state>=2)
 const audit=(await db.query("select * from public.ecosystem_audit_events where event_type like 'wealth_alert_%' or event_type like 'wealth_alerts_%'")).rows
 assert.ok(audit.length>0);assert.ok(!JSON.stringify(audit).includes('Expiring document'))
})
