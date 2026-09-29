import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
import {registerHooks} from 'node:module'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {protectionCommand}=await import('../lib/wealth/shield.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))

await db.exec(`create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(current_setting('storage.operation',true),'storage.','')=any(ops)$$;
create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select storage.allow_any_operation(array[op])$$;`)
await db.exec(readFileSync('supabase/migrations/20260926214929_wealth_documents_vault.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926220404_wealth_documents_storage_read_compatibility.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260927003416_wealth_shield_declared_policies.sql','utf8'))
const payload=(extra={})=>({confirmed:'yes',idempotency_key:randomUUID(),title:'Proteção sintética',category:'home',insurer:'Declaração QA',reference:'QA-PRIVATE',coverage_cents:'10000001',deductible_cents:'0',premium_cents:'12345',premium_period:'yearly',starts_on:'2024-02-01',ends_on:'2024-02-29',status:'declared',notes:'Private QA',...extra})
const cmd=async(op,data)=>(await db.query('select public.manage_wealth_protection($1,$2) id',[op,data])).rows[0].id
const read=async(filter='current',page=1,id=null,date='2024-02-29')=>(await db.query('select public.wealth_shield_overview($1,$2,$3,$4) v',[date,page,filter,id])).rows[0].v
let id,original,asset,document,schedule,foreign
test('exact declarations, nullable unknowns, references, idempotency and no extra financial records',async()=>{
 await asUser(db,ids.a)
 asset=(await db.query("insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'asset','Casa QA','property',100,'2024-02-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 schedule=(await db.query('select create_wealth_recurrence($1) id',[{title:'Prêmio sintético',kind:'expense',category:'other',amount_cents:12345,frequency:'yearly',interval_count:1,start_date:'2024-02-01',timezone:'America/Sao_Paulo',idempotency_key:randomUUID(),confirmed:'yes'}])).rows[0].id
 await asAdmin(db);document=randomUUID();await db.query("insert into public.wealth_documents(id,user_id,title,category,mime_type,size_bytes,sha256,status) values ($1,$2,'Apólice sintética','insurance','application/pdf',10,$3,'active')",[document,ids.a,'a'.repeat(64)]);await asUser(db,ids.a)
 original=payload({asset_id:asset,document_id:document,schedule_id:schedule});id=await cmd('save',original);assert.equal(await cmd('save',original),id)
 const v=await read('current',1,id);assert.equal(v.selected.coverage_cents,'10000001');assert.equal(v.selected.deductible_cents,'0');assert.equal(v.summary.ending,'1');assert.equal(v.selected.temporal,'informed_term');assert.equal(v.selected.document.title,'Apólice sintética');assert.equal(v.provider_status,'NOT_CONFIGURED')
 assert.equal((await db.query('select count(*) n from public.wealth_entries')).rows[0].n,1);assert.equal((await db.query('select count(*) n from public.wealth_recurrence_occurrences')).rows[0].n,0)
 await assert.rejects(()=>cmd('save',{...original,title:'tampered'}),e=>e.code==='23505')
})
test('owner/CAS/PT409, unknown fields and invalid dates/cents roll back atomically',async()=>{
 for(const extra of [{coverage_cents:'1.5'},{premium_cents:'-1'},{coverage_cents:'100000000000001'},{starts_on:'2024-03-01',ends_on:'2024-02-29'},{ends_on:'2023-02-29'},{user_id:ids.b},{asset_id:randomUUID()},{document_id:randomUUID()},{schedule_id:randomUUID()}])await assert.rejects(()=>cmd('save',payload(extra)))
 await cmd('save',payload({id,version:1,title:'Alterado',asset_id:asset,document_id:document,schedule_id:schedule}))
 await assert.rejects(()=>cmd('save',payload({id,version:1})),e=>e.code==='PT409');assert.equal((await read('current',1,id)).selected.version,2)
 await asUser(db,ids.b);assert.equal((await read('current',1,id)).selected,null);await assert.rejects(()=>cmd('save',payload({id,version:2})),e=>e.code==='42501')
 for(const key of ['asset_id','document_id','schedule_id'])await assert.rejects(()=>cmd('save',payload({[key]:{asset_id:asset,document_id:document,schedule_id:schedule}[key]})),e=>e.code==='42501')
 foreign=await cmd('save',payload({title:'Private B'}));await asUser(db,ids.a);assert.equal((await read()).count,'1')
})
test('archive/restore/cancellation declarations preserve original schedule, files and financial values',async()=>{
 const archive={id,version:2,idempotency_key:randomUUID(),confirmed:'yes'};await cmd('archive',archive);assert.equal((await read()).count,'0');assert.equal((await read('archived')).count,'1')
 await assert.rejects(()=>cmd('save',payload({id,version:3})),e=>e.code==='PT409');await cmd('restore',{...archive,version:3,idempotency_key:randomUUID()});await cmd('archive',archive);assert.equal((await read()).count,'1')
 await cmd('save',payload({id,version:4,status:'cancelled',asset_id:asset,document_id:document,schedule_id:schedule}));assert.equal((await read('cancelled')).count,'1');assert.equal((await read('ending')).count,'0')
 assert.equal((await db.query('select status from public.wealth_recurring_schedules where id=$1',[schedule])).rows[0].status,'active');assert.equal((await db.query('select status from public.wealth_documents where id=$1',[document])).rows[0].status,'active')
 assert.equal((await db.query('select amount_cents from public.wealth_entries where id=$1',[asset])).rows[0].amount_cents,100)
})
test('unknown information and temporal boundaries stay distinct from confirmed coverage',async()=>{
 const unknown=await cmd('save',payload({starts_on:null,ends_on:null,coverage_cents:null,deductible_cents:null,premium_cents:null}));assert.equal((await read('current',1,unknown)).selected.temporal,'unknown');assert.equal((await read('unknown')).count,'1')
 await cmd('save',payload({title:'Future',starts_on:'2024-03-01',ends_on:'2024-03-30'}));await cmd('save',payload({title:'Expired',ends_on:'2024-02-28'}))
 assert.equal((await read('expired')).count,'1');assert.equal((await read('ending')).count,'1');assert.equal((await read('current',1,unknown)).summary.missing_document,'3')
 for(const [filter,page,date] of [['invalid',1,'2024-02-29'],['current',0,'2024-02-29'],['current',1,null],['current',1,'2201-01-01']])await assert.rejects(()=>read(filter,page,null,date),e=>e.code==='22023')
})
test('context ownership rechecked on reads; deleted/unavailable documents never reveal others metadata',async()=>{
 await asAdmin(db);await db.query("update public.wealth_documents set status='deleting' where id=$1",[document]);await db.query('update public.wealth_protection_policies set document_id=$1,asset_id=$2 where id=$3',[document,asset,foreign]);await asUser(db,ids.b)
 const v=await read('current',1,foreign);assert.equal(v.selected.asset,null);assert.equal(v.selected.document,null);assert.ok(!JSON.stringify(v).includes('Casa QA'))
 await asUser(db,ids.a);assert.equal((await read('current',1,id)).selected.document,null)
 await assert.rejects(()=>cmd('save',payload({id,version:5,document_id:document})),e=>e.code==='42501')
})
test('read-only selection, grants, no blind DML and no audit content',async()=>{
 for(const sql of ['delete from public.wealth_protection_policies',"update public.wealth_protection_policies set title='attack'",'select * from ecosystem_private.wealth_protection_commands'])await assert.rejects(()=>db.query(sql),/permission denied/)
 await asAdmin(db);const audit=(await db.query("select * from public.ecosystem_audit_events where event_type like 'wealth_protection_policies.%'")).rows;assert.ok(audit.length);assert.ok(!JSON.stringify(audit).includes('Private QA'))
 await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'] where user_id=$1",[ids.a]);await asUser(db,ids.a);assert.ok((await read()).policies.length);await assert.rejects(()=>cmd('save',original),e=>e.code==='42501')
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.write'] where user_id=$1",[ids.a]);await asUser(db,ids.a);await assert.rejects(()=>read(),e=>e.code==='42501')
 await asUser(db,ids.member);await assert.rejects(()=>read(),e=>e.code==='42501');await asUser(db,null);await assert.rejects(()=>read(),/permission denied/)
})
test('bounded list pagination and capacity; form parser preserves unknown and exact money',async()=>{
 await asAdmin(db);await db.query("insert into public.wealth_protection_policies(user_id,title,category,premium_period) select $1,'Bulk '||n,'other','unknown' from generate_series(1,999) n",[ids.b]);await asUser(db,ids.b)
 assert.equal((await read()).count,'1000');assert.equal((await read('current',1)).policies.length,25);assert.equal((await read('current',40)).policies.length,25);assert.equal((await read('current',41)).policies.length,0);await assert.rejects(()=>cmd('save',payload()),e=>e.code==='54000')
 const f=new FormData();for(const [k,v] of Object.entries({operation:'save',idempotency_key:randomUUID(),confirmed:'yes',title:'QA',category:'other',premium_period:'unknown',status:'declared',coverage:'1000000000000',deductible:'0'}))f.set(k,v)
 const parsed=protectionCommand(f).input;assert.equal(parsed.coverage_cents,'100000000000000');assert.equal(parsed.deductible_cents,'0');assert.equal(parsed.premium_cents,null);f.set('coverage','1.001');assert.throws(()=>protectionCommand(f))
})
