import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createTestDatabase,asUser,asAdmin,ids} from './helpers/ecosystem-test-db.mjs'
import {readNetWorth,sharePercent,assetClasses,liabilityClasses} from '../lib/wealth/net-worth.ts'
const db=await createTestDatabase();after(()=>db.close())
for(const file of ['20260926165000_wealth_debt_center.sql','20260926171000_wealth_debt_conflict_response.sql','20260926180000_wealth_net_worth.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
const summary=async()=>readNetWorth((await db.query('select public.wealth_net_worth() value')).rows[0].value)
const capture=async(token)=> (await db.query('select public.capture_wealth_net_worth($1) id',[token])).rows[0].id
let position,snapshot
test('all positions aggregate beyond pagination and safe integer limits; income/archive excluded',async()=>{
 await asUser(db,ids.a)
 await db.query(`insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key)
 select $1,'asset','Asset '||n,'other',100000000000000,'2026-09-26',gen_random_uuid() from generate_series(1,1010) n`,[ids.a])
 position=(await db.query('select id from public.wealth_entries order by id limit 1')).rows[0].id
 await db.query(`insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,idempotency_key) values ($1,'liability','Debt','loan',29,'2026-09-26',gen_random_uuid()),($1,'income','Income','salary',99,'2026-09-26',gen_random_uuid())`,[ids.a])
 const s=await summary();assert.equal(s.assets,'101000000000000000');assert.equal(s.liabilities,'29');assert.equal(s.netWorth,'100999999999999971');assert.equal(s.positionCount,'1011');assert.equal(s.largest.length,11);assert.equal(s.classes.find(c=>c.kind==='asset').class,'unclassified')
 await asUser(db,ids.b);assert.equal((await summary()).assets,'0')
 await asUser(db,ids.a)
})
test('classification is bound to kind; version CAS, archive transition and tenant isolation hold',async()=>{
 for(const classification of Object.keys(assetClasses)){
  const version=(await db.query('select version from public.wealth_entries where id=$1',[position])).rows[0].version
  assert.equal((await db.query("select public.classify_wealth_position($1,$2,$3,'immediate') ok",[position,version,classification])).rows[0].ok,true)
 }
 for(const classification of Object.keys(liabilityClasses))await assert.rejects(()=>db.query("update public.wealth_entries set position_class=$2 where id=$1",[position,classification]),/wealth_position_class_check/)
 await assert.rejects(()=>db.query("select public.classify_wealth_position($1,1,'cash','immediate')",[position]),e=>e.code==='PT409')
 await asUser(db,ids.b);await assert.rejects(()=>db.query("select public.classify_wealth_position($1,17,'cash','immediate')",[position]),e=>e.code==='PT409')
 await asUser(db,ids.a);await db.query('update public.wealth_entries set archived_at=now() where id=$1',[position])
 assert.equal((await summary()).assets,'100900000000000000')
 await assert.rejects(()=>db.query("update public.wealth_entries set liquidity='illiquid' where id=$1",[position]),/restore before editing/)
 await db.query('update public.wealth_entries set archived_at=null where id=$1',[position])
})
test('snapshots capture exact composition once, preserve time zone and history after edits',async()=>{
 await db.query("insert into public.wealth_profiles(user_id,timezone) values ($1,'Pacific/Kiritimati')",[ids.a])
 const token=randomUUID();snapshot=await capture(token)
 const saved=(await db.query('select * from public.wealth_net_worth_snapshots where id=$1',[snapshot])).rows[0]
 assert.equal(saved.timezone,'Pacific/Kiritimati');assert.equal(saved.source,'owner_declared');assert.equal(saved.composition.assets,'101000000000000000')
 assert.equal(new Date(saved.local_date).toISOString().slice(0,10),new Intl.DateTimeFormat('en-CA',{timeZone:saved.timezone}).format(new Date(saved.captured_at)))
 await db.query('update public.wealth_entries set amount_cents=57 where id=$1',[position])
 assert.equal(await capture(token),snapshot)
 assert.equal((await db.query('select composition from public.wealth_net_worth_snapshots where id=$1',[snapshot])).rows[0].composition.assets,saved.composition.assets)
 assert.notEqual((await summary()).assets,saved.composition.assets)
 assert.equal((await db.query('select count(*) n from public.wealth_net_worth_snapshots')).rows[0].n,1)
 assert.notEqual(await capture(randomUUID()),snapshot)
})
test('snapshot DML, anonymous access, other user, and revoked entitlement cannot bypass RPC boundary',async()=>{
 await assert.rejects(()=>db.query('update public.wealth_net_worth_snapshots set captured_at=now()'),/permission denied/)
 await assert.rejects(()=>db.query('delete from public.wealth_net_worth_snapshots'),/permission denied/)
 await asUser(db,ids.b);assert.equal((await db.query('select * from public.wealth_net_worth_snapshots where id=$1',[snapshot])).rows.length,0)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set permissions=array['wealth.read'] where user_id=$1",[ids.a])
 await asUser(db,ids.a);assert.ok((await summary()).positionCount);await assert.rejects(()=>capture(randomUUID()),/write denied/)
 await asAdmin(db);await db.query("update public.ecosystem_product_entitlements set status='revoked' where user_id=$1",[ids.a])
 await asUser(db,ids.a);await assert.rejects(()=>summary(),/read denied/);assert.equal((await db.query('select * from public.wealth_net_worth_snapshots')).rows.length,0)
 await assert.rejects(()=>db.query('select ecosystem_private.capture_wealth_net_worth($1)',[randomUUID()]),/write denied/)
 await asUser(db,null);await assert.rejects(()=>summary(),/permission denied/);await assert.rejects(()=>capture(randomUUID()),/permission denied/)
})
test('reader rejects inconsistent totals and allocation; percentages use exact integer math',async()=>{
 await asUser(db,ids.b);const empty=await summary();assert.equal(empty.netWorth,'0');assert.equal(sharePercent('0','0'),'—')
 assert.equal(sharePercent('1','3'),'33,33%');assert.equal(sharePercent('100000000000000001','100000000000000001'),'100,00%')
 assert.throws(()=>readNetWorth({...empty,assets:'1'}),/inconsistentes/)
 assert.throws(()=>readNetWorth({...empty,assets:'1',netWorth:'1'}),/incompleta/)
 assert.throws(()=>sharePercent('2','1'),/inválida/)
 await asAdmin(db);const events=(await db.query("select * from public.ecosystem_audit_events where event_type='wealth_net_worth_snapshots.insert'")).rows;assert.equal(events.length,2);assert.ok(events.every(e=>e.entity_id))
})
