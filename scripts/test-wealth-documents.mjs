import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
import {documentMime,documentMaxBytes} from '../lib/wealth/documents.ts'
const db=await createTestDatabase();after(()=>db.close())
await db.exec(readFileSync('scripts/fixtures/wealth-queue-baseline.sql','utf8'))
for(const f of ['20260926110128_wealth_recurring_schedules','20260926165000_wealth_debt_center','20260926171000_wealth_debt_conflict_response','20260926180000_wealth_net_worth','20260926181546_wealth_portfolio_foundation','20260926185024_wealth_portfolio_target_binding','20260926190250_wealth_portfolio_blind_dml_guard','20260926195246_wealth_financial_calendar','20260926205052_wealth_goal_funding_life_plans'])await db.exec(readFileSync(`supabase/migrations/${f}.sql`,'utf8'))

await db.exec(`create schema storage;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(current_setting('storage.operation',true),'storage.','')=any(ops)$$;
create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select storage.allow_any_operation(array[op])$$;`)
await db.exec(readFileSync('supabase/migrations/20260926214929_wealth_documents_vault.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20260926220404_wealth_documents_storage_read_compatibility.sql','utf8'))
const command=async(op,input)=>(await db.query('select public.manage_wealth_document($1,$2) id',[op,input])).rows[0].id
const payload=(extra={})=>({id:randomUUID(),idempotency_key:randomUUID(),confirmed:'yes',title:'Synthetic PDF',category:'receipt',document_date:'2024-02-29',notes:'QA private metadata',links:[],mime_type:'application/pdf',size_bytes:50,sha256:'a'.repeat(64),...extra})
const change=(id,version,extra={})=>({id,version,idempotency_key:randomUUID(),confirmed:'yes',...extra})
let doc,original
const operation=op=>db.query("select set_config('storage.operation',$1,false)",[op])
test('file signature and size boundaries do not trust MIME labels',()=>{
 assert.equal(documentMime(new TextEncoder().encode('%PDF-1.7')),'application/pdf')
 assert.equal(documentMime(Uint8Array.from([255,216,255])),'image/jpeg')
 assert.equal(documentMime(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png')
 assert.throws(()=>documentMime(new TextEncoder().encode('<script>')));assert.throws(()=>documentMime(new Uint8Array()));assert.throws(()=>documentMime(new Uint8Array(documentMaxBytes+1)))
})
test('reserve exact replay, strict fields, file size/date and no premature finalization',async()=>{
 await asUser(db,ids.a);original=payload();doc=await command('reserve',original);assert.equal(await command('reserve',original),doc)
 await assert.rejects(()=>command('reserve',{...original,title:'Different'}),e=>e.code==='23505')
 for(const extra of [{size_bytes:3145729},{size_bytes:'1.5'},{document_date:'2026-02-30'},{mime_type:'text/html'},{user_id:ids.b},{links:[{kind:'goal',id:randomUUID()}]}])await assert.rejects(()=>command('reserve',payload(extra)))
 await assert.rejects(()=>command('finalize',change(doc,1)),e=>e.code==='22023')
})
test('pending upload constrained to owner path and operation, cross-user storage denied',async()=>{
 const path=`${ids.a}/${doc}/document`;await operation('storage.object.upload')
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['wealth-documents',`${ids.b}/${doc}/document`]))
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['wealth-documents',path,{size:50,mimetype:'application/pdf'}])
 await asUser(db,ids.b);assert.deepEqual((await db.query('select * from wealth_documents')).rows,[])
 await assert.rejects(()=>command('edit',change(doc,1,{title:'Attack',category:'other',notes:'',links:[],document_date:null})),e=>e.code==='42501')
 await asUser(db,ids.a);await command('finalize',change(doc,1))
 await operation('storage.object.upload');await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['wealth-documents',path]))
})
test('only authenticated download allowed; sign, copy, list and unset purpose are denied',async()=>{
 for(const op of ['storage.object.sign','storage.object.sign_many','storage.object.copy','storage.object.list','storage.render.image_authenticated','']){await operation(op);assert.equal((await db.query('select * from storage.objects')).rows.length,0)}
 for(const op of ['storage.object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info']){await operation(op);assert.equal((await db.query('select * from storage.objects')).rows.length,1)}
 await asUser(db,ids.b);assert.equal((await db.query('select * from storage.objects')).rows.length,0)
 await asUser(db,ids.a)
})
test('metadata CAS and no direct DML, no owner/file replacement',async()=>{
 const fields={title:'Edited',category:'contract',notes:'Synthetic',links:[],document_date:null}
 await command('edit',change(doc,2,fields));await assert.rejects(()=>command('edit',change(doc,2,fields)),e=>e.code==='PT409')
 await assert.rejects(()=>db.query('update wealth_documents set title=$1 where id=$2',['hack',doc]),/permission denied/)
 await assert.rejects(()=>command('edit',change(doc,3,{...fields,sha256:'b'.repeat(64)})),e=>e.code==='22023')
})
test('revoked, read-only, write-only and anonymous gates apply to metadata, RPC and storage',async()=>{
 for(const permissions of [[],['wealth.read'],['wealth.write']]){
  await asAdmin(db);await db.query('update ecosystem_product_entitlements set permissions=$1 where user_id=$2',[permissions,ids.a]);await asUser(db,ids.a)
  await assert.rejects(()=>command('reserve',payload()),e=>e.code==='42501');await operation('storage.object.get_authenticated')
  assert.equal((await db.query('select * from storage.objects')).rows.length,permissions.includes('wealth.read')?1:0)
 }
 await asUser(db,null);await assert.rejects(()=>command('reserve',payload()),/permission denied/)
 await asAdmin(db);await db.query("update ecosystem_product_entitlements set permissions=array['wealth.read','wealth.write'] where user_id=$1",[ids.a]);await asUser(db,ids.a)
})
test('links require owned context and incomplete uploads remain removable',async()=>{
 await asUser(db,ids.a)
 const goal=(await db.query("insert into wealth_goals(user_id,title,target_cents,target_date,idempotency_key) values($1,'Vault goal',100,'2027-01-01',gen_random_uuid()) returning id",[ids.a])).rows[0].id
 const pending=await command('reserve',payload({links:[{kind:'goal',id:goal}]}))
 await assert.rejects(()=>command('reserve',payload({links:[{kind:'goal',id:goal},{kind:'goal',id:goal}]})))
 await asUser(db,ids.b);await assert.rejects(()=>command('reserve',payload({links:[{kind:'goal',id:goal}]})),e=>e.code==='42501')
 await asUser(db,ids.a);await command('delete_begin',change(pending,1));await command('delete_finish',change(pending,2))
})
test('two-phase deletion revokes download before removal, requires actual Storage cleanup, scrubs metadata',async()=>{
 await command('delete_begin',change(doc,3));await operation('storage.object.get_authenticated');assert.equal((await db.query('select * from storage.objects')).rows.length,0)
 await assert.rejects(()=>command('delete_finish',change(doc,4)),e=>e.code==='22023')
 await command('delete_begin',change(doc,4));await operation('storage.object.delete_many');assert.equal((await db.query('delete from storage.objects returning name')).rows.length,1)
 const finish=change(doc,4);await command('delete_finish',finish);assert.equal(await command('delete_finish',finish),doc)
 const row=(await db.query('select * from wealth_documents where id=$1',[doc])).rows[0];assert.equal(row.status,'deleted');assert.equal(row.notes,'');assert.equal(row.title,'Documento removido')
 await asAdmin(db);assert.equal((await db.query('select count(*)::int n from ecosystem_private.wealth_document_commands where result=$1',[doc])).rows[0].n,1)
 const audit=(await db.query("select * from ecosystem_audit_events where event_type like 'wealth_documents.%'")).rows;assert.ok(audit.length>=5);assert.ok(audit.every(e=>!JSON.stringify(e).includes('Synthetic')))
})
