import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {registerHooks} from 'node:module'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {familyCommand}=await import('../lib/wealth/family.ts');hook.deregister()
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))

await db.exec(`create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(current_setting('storage.operation',true),'storage.','')=any(ops)$$;
create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select storage.allow_any_operation(array[op])$$;`)
await db.exec(readFileSync('supabase/migrations/20260926214929_wealth_documents_vault.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926220404_wealth_documents_storage_read_compatibility.sql','utf8'))

await db.exec(readFileSync('supabase/migrations/20260926222248_wealth_timeline_read_model.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926222931_wealth_timeline_transaction_binding.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926225948_wealth_family_explicit_sharing.sql','utf8'))
await db.exec("alter table auth.users add column email text,add column email_confirmed_at timestamptz")
for(const [id,email] of [[ids.a,'a@example.test'],[ids.b,'b@example.test'],[ids.member,'m@example.test']])await db.query('update auth.users set email=$1,email_confirmed_at=now() where id=$2',[email,id])
const cmd=async(op,input)=>(await db.query('select manage_wealth_family($1,$2) id',[op,input])).rows[0].id
const inp=(extra={})=>({id:randomUUID(),idempotency_key:randomUUID(),confirmed:'yes',...extra})
const invite=(extra={})=>inp({label:'Synthetic family',email:'b@example.test',code:'a'.repeat(64),...extra})
const read=async id=>(await db.query('select read_wealth_family_share($1) data',[id])).rows[0].data
const overview=async page=>(await db.query('select wealth_family_overview($1) data',[page??1])).rows[0].data
let connection,goal,entry,document,share,docShare
test('domain validates scope, exact duration, invitation and explicit confirmation',()=>{
 const form=new FormData();for(const [k,v] of Object.entries(invite()))form.set(k,v);form.set('operation','invite');assert.equal(familyCommand(form).operation,'invite');form.set('confirmed','no');assert.throws(()=>familyCommand(form));form.set('confirmed','yes');form.set('operation','share');form.set('resource','all:data');assert.throws(()=>familyCommand(form))
})
test('invitation stores no email or raw secret, exact replay and no enumeration or own invite',async()=>{
 await asUser(db,ids.a);const input=invite();connection=await cmd('invite',input);assert.equal(await cmd('invite',input),connection)
 await assert.rejects(()=>cmd('invite',{...input,label:'different'}),e=>e.code==='23505')
 await assert.rejects(()=>cmd('invite',invite({email:'a@example.test'})),e=>e.code==='22023')
 await assert.rejects(()=>cmd('invite',invite({owner_id:ids.b})),e=>e.code==='22023')
 assert.equal((await overview()).connections[0].state,'pending')
 await assert.rejects(()=>db.query('select * from ecosystem_private.wealth_family_connections'),/permission denied/)
 await assert.rejects(()=>db.query('select ecosystem_private.wealth_family_resource($1,$2,$3)',[ids.a,'goal.summary',randomUUID()]),/permission denied/)
 await asAdmin(db);const stored=JSON.stringify((await db.query('select * from ecosystem_private.wealth_family_connections')).rows);assert.ok(!stored.includes('example.test'));assert.ok(!stored.includes('a'.repeat(64)))
})
test('recipient verified email + live invite + both entitlements, no membership-only data access',async()=>{
 await asUser(db,ids.member);await assert.rejects(()=>cmd('join',inp({id:connection,code:'a'.repeat(64)})),e=>e.code==='42501')
 await asAdmin(db);await db.query("insert into ecosystem_product_entitlements(user_id,product_id,permissions,source) values($1,'wealth',array['wealth.read','wealth.write'],'manual')",[ids.member]);await asUser(db,ids.member)
 await assert.rejects(()=>cmd('join',inp({id:connection,code:'a'.repeat(64)})),e=>e.code==='42501')
 await asAdmin(db);await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids.b]);await asUser(db,ids.b)
 await assert.rejects(()=>cmd('join',inp({id:connection,code:'a'.repeat(64)})),e=>e.code==='42501')
 await asAdmin(db);await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids.b]);await asUser(db,ids.b)
 await assert.rejects(()=>cmd('join',inp({id:connection,code:'b'.repeat(64)})),e=>e.code==='42501')
 const join=inp({id:connection,code:'a'.repeat(64)});await cmd('join',join);assert.equal(await cmd('join',join),connection)
 assert.equal((await overview()).connections[0].state,'active');assert.deepEqual((await db.query('select * from wealth_entries')).rows,[])
 await asUser(db,ids.a);const dup=await cmd('invite',invite());await asUser(db,ids.b);await assert.rejects(()=>cmd('join',inp({id:dup,code:'a'.repeat(64)})),e=>e.code==='23505')
})
test('owner-bound minimal scopes with two-sided acceptance, private base tables stay private',async()=>{
 await asUser(db,ids.a)
 goal=(await db.query("insert into wealth_goals(user_id,title,target_cents,saved_cents,target_date,idempotency_key) values($1,'Goal private',99999999999999,12345,'2027-01-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 entry=(await db.query("insert into wealth_entries(user_id,title,kind,category,amount_cents,financial_date,idempotency_key) values($1,'Entry private','expense','other',12345,'2027-01-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 share=await cmd('share',inp({connection_id:connection,scope:'goal.summary',resource_id:goal,purpose:'Planning together',days:30}))
 await assert.rejects(()=>cmd('share',inp({connection_id:connection,scope:'all',resource_id:goal,purpose:'forged',days:30})),e=>e.code==='42501')
 for(const days of [0,367,'1.5'])await assert.rejects(()=>cmd('share',inp({connection_id:connection,scope:'goal.summary',resource_id:goal,purpose:'bad',days})),e=>e.code==='22023')
 await asUser(db,ids.b);assert.equal(await read(share),null);assert.equal((await overview()).shares[0].resource,null)
 await assert.rejects(()=>cmd('share',inp({connection_id:connection,scope:'goal.summary',resource_id:goal,purpose:'foreign',days:30})),e=>e.code==='42501')
 await cmd('accept',inp({id:share,version:1}));const data=await read(share);assert.equal(data.target_cents,'99999999999999');assert.equal(data.saved_cents,'12345');assert.deepEqual(Object.keys(data).sort(),['currency','date','saved_cents','status','target_cents','title'])
 assert.deepEqual((await db.query('select * from wealth_goals where id=$1',[goal])).rows,[])
 await asUser(db,ids.member);assert.equal(await read(share),null);assert.deepEqual((await overview()).shares,[])
 await assert.rejects(()=>cmd('revoke',inp({id:share,version:2})),e=>e.code==='42501')
})
test('revocation has CAS, cannot restore through replay and remains usable without entitlement',async()=>{
 await asUser(db,ids.a);await assert.rejects(()=>cmd('revoke',inp({id:share,version:1})),e=>e.code==='PT409')
 await asAdmin(db);await db.query("update ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a]);await asUser(db,ids.b);assert.equal(await read(share),null)
 await asUser(db,ids.a);const revoke=inp({id:share,version:2});await cmd('revoke',revoke);assert.equal(await cmd('revoke',revoke),share)
 await asAdmin(db);await db.query("update ecosystem_product_entitlements set status='active' where user_id=$1",[ids.a]);await asUser(db,ids.b);assert.equal(await read(share),null)
 await assert.rejects(()=>cmd('accept',inp({id:share,version:3})),e=>e.code==='42501')
})
test('shared documents require explicit file scope and only authenticated GET; notes and links never shared',async()=>{
 await asAdmin(db);document=randomUUID();await db.query("insert into wealth_documents(id,user_id,title,category,notes,mime_type,size_bytes,sha256,status) values($1,$2,'File','other','Secret notes','application/pdf',50,$3,'active')",[document,ids.a,'b'.repeat(64)])
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('wealth-documents',$1,$2)",[`${ids.a}/${document}/document`,{size:50,mimetype:'application/pdf'}]);await asUser(db,ids.a)
 docShare=await cmd('share',inp({connection_id:connection,scope:'document.download',resource_id:document,purpose:'Read this file',days:1}))
 await asUser(db,ids.b);await cmd('accept',inp({id:docShare,version:1}));assert.equal((await read(docShare)).object_path,`${ids.a}/${document}/document`)
 assert.ok(!('notes' in await read(docShare)));assert.deepEqual((await db.query('select * from wealth_documents')).rows,[])
 for(const op of ['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info']){await db.query("select set_config('storage.operation',$1,false)",[op]);assert.equal((await db.query('select * from storage.objects')).rows.length,1)}
 for(const op of ['object.sign','object.list','object.copy','object.delete','object.delete_many','']){await db.query("select set_config('storage.operation',$1,false)",[op]);assert.equal((await db.query('select * from storage.objects')).rows.length,0)}
 await db.query("select set_config('storage.operation','object.get_authenticated',false)");await asAdmin(db);await db.query("update wealth_documents set status='deleting' where id=$1",[document]);await asUser(db,ids.b);assert.equal(await read(docShare),null);assert.equal((await db.query('select * from storage.objects')).rows.length,0)
 await asAdmin(db);await db.query("update wealth_documents set status='active' where id=$1",[document])
})
test('expiry, source or recipient entitlement, archival, anonymous and write-only deny data',async()=>{
 await asAdmin(db);await db.query("update ecosystem_private.wealth_family_shares set expires_at=now()-interval '1 second' where id=$1",[docShare]);await asUser(db,ids.b);assert.equal(await read(docShare),null)
 await asAdmin(db);await db.query("update ecosystem_private.wealth_family_shares set expires_at=now()+interval '1 day' where id=$1",[docShare])
 for(const user of [ids.a,ids.b]){await asAdmin(db);await db.query("update ecosystem_product_entitlements set permissions=array['wealth.write'] where user_id=$1",[user]);await asUser(db,ids.b);assert.equal(await read(docShare),null);await asAdmin(db);await db.query("update ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write'] where user_id=$1",[user])}
 await asUser(db,null);await assert.rejects(()=>read(docShare),/permission denied/);await assert.rejects(()=>overview(),/permission denied/)
 await asUser(db,ids.a);const e=await cmd('share',inp({connection_id:connection,scope:'entry.summary',resource_id:entry,purpose:'Entry review',days:30}));await asUser(db,ids.b);await cmd('accept',inp({id:e,version:1}));assert.equal((await read(e)).amount_cents,'12345')
 await asUser(db,ids.a);await db.query('update wealth_entries set archived_at=now() where id=$1',[entry]);await asUser(db,ids.b);assert.equal(await read(e),null)
})
test('disconnect invalidates all scopes in both directions; audit has identifiers only and no secrets',async()=>{
 await asUser(db,ids.b);await cmd('disconnect',inp({id:connection,version:2}));assert.equal(await read(docShare),null)
 await asUser(db,ids.a);await assert.rejects(()=>cmd('share',inp({connection_id:connection,scope:'goal.summary',resource_id:goal,purpose:'After leave',days:1})),e=>e.code==='42501')
 await asAdmin(db);const audit=JSON.stringify((await db.query("select * from ecosystem_audit_events where event_type like 'wealth_family_%'")).rows);assert.ok(!audit.includes('example.test'));assert.ok(!audit.includes('Planning together'));assert.ok(!audit.includes('Synthetic family'))
})
test('bounded management pagination and expired invitation do not accidentally grant access',async()=>{
 await asUser(db,ids.a);for(let i=0;i<25;i++)await cmd('invite',invite({label:`Page ${i}`}))
 assert.equal((await overview()).connections.length,25);assert.ok((await overview(2)).connections.length>0);await assert.rejects(()=>overview(0),e=>e.code==='22023')
 const exp=await cmd('invite',invite());await asAdmin(db);await db.query("update ecosystem_private.wealth_family_connections set invite_expires_at=now()-interval '1 second' where id=$1",[exp]);await asUser(db,ids.b);await assert.rejects(()=>cmd('join',inp({id:exp,code:'a'.repeat(64)})),e=>e.code==='42501')
})
