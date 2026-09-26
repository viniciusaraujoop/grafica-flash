import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {stagingUrl,serviceKey} from './helpers/staging-credentials.mjs'
import {cleanupWealthSchedules,wealthScheduleFixtureCounts} from './helpers/cleanup-wealth-schedules.mjs'
const admin=createClient(stagingUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
const users=JSON.parse(fs.readFileSync('.local-qa/staging-browser/fixture-user-ids.json','utf8'))
const entities=new Set()
for(const user of users){
 const result=await admin.auth.admin.getUserById(user.id)
 if(result.error?.code==='user_not_found')continue
 assert.equal(result.error,null)
 assert.equal(result.data.user.email,user.email)
 assert.ok(/^orcaly-qa-.*@example\.test$/.test(user.email),'Refusing to remove a non-fixture account')
 await cleanupWealthSchedules(admin,user.id,entities)
 for(const table of ['ecosystem_product_entitlements','ecosystem_context_consents','wealth_entries','wealth_goals','wealth_net_worth_snapshots','wealth_portfolios','wealth_holdings','wealth_portfolio_transactions']){
  for(let offset=0;;offset+=500){const rows=await admin.from(table).select('id').eq('user_id',user.id).order('id').range(offset,offset+499);assert.equal(rows.error,null);for(const row of rows.data)entities.add(row.id);if(rows.data.length<500)break}
 }
 entities.add(user.id)
 const removed=await admin.auth.admin.deleteUser(user.id);assert.equal(removed.error,null)
}
const entityIds=[...entities]
for(let offset=0;offset<entityIds.length;offset+=100){const result=await admin.from('ecosystem_audit_events').delete().in('entity_id',entityIds.slice(offset,offset+100));assert.equal(result.error,null)}
console.log(JSON.stringify({remainingUsers:(await admin.auth.admin.listUsers({page:1,perPage:1})).data.users.length,remainingAudit:(await admin.from('ecosystem_audit_events').select('id')).data.length,...await wealthScheduleFixtureCounts(admin)}))
