import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {stagingRef,stagingUrl,anonKey,serviceKey} from './helpers/staging-credentials.mjs'
const options={auth:{persistSession:false,autoRefreshToken:false}}
const admin=createClient(stagingUrl,serviceKey,options)
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data}
const file='.local-qa/reconciliation/wealth-clock-fixtures.json'
const mode=process.argv[2]
if(mode==='prepare'){
 assert.equal(ok(await admin.auth.admin.listUsers({page:1,perPage:1})).users.length,0,'Empty staging required')
 const state={project:stagingRef,startedAt:new Date().toISOString(),users:[],schedules:[],sentinel:null}
 const save=()=>{fs.writeFileSync(file,JSON.stringify(state));fs.writeFileSync('.local-qa/staging-browser/fixture-user-ids.json',JSON.stringify(state.users))}
 save()
 for(const label of ['automatic','revoked']){
  const email=`orcaly-qa-clock-${label}-${randomUUID()}@example.test`,password=`Qa!${randomUUID()}Aa9`
  const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user
  state.users.push({id:user.id,email});save()
  ok(await admin.from('ecosystem_product_entitlements').insert({user_id:user.id,product_id:'wealth',permissions:['wealth.read','wealth.write'],status:'active',source:'manual'}))
  const client=createClient(stagingUrl,anonKey,options);ok(await client.auth.signInWithPassword({email,password}))
  const date=new Date(Date.now()-3*86400000).toISOString().slice(0,10)
  const id=ok(await client.rpc('create_wealth_recurrence',{p_input:{title:`Clock ${label} QA`,kind:'expense',category:'housing',amount_cents:29,frequency:'daily',interval_count:1,start_date:date,max_occurrences:2,timezone:'UTC',idempotency_key:randomUUID(),confirmed:'yes'}}))
  state.schedules.push({id,userId:user.id,label});save()
  if(label==='revoked')ok(await admin.from('ecosystem_product_entitlements').update({status:'revoked'}).eq('user_id',user.id))
 }
 state.sentinel=ok(await admin.from('background_jobs').insert({job_type:'qa.clock.unrelated',payload:{fixture:'wealth-clock'},run_after:new Date().toISOString()}).select('id').single()).id;save()
 console.log(JSON.stringify({prepared:true,users:state.users.length,schedules:state.schedules.length,networkProviders:false}))
}else if(mode==='verify'){
 const state=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(state.project,stagingRef)
 const deadline=Date.now()+155000
 let schedules
 do{
  schedules=ok(await admin.from('wealth_recurring_schedules').select('id,status,next_index,pause_reason').in('id',state.schedules.map(x=>x.id)))
  if(schedules.some(s=>s.status==='completed')&&schedules.some(s=>s.pause_reason==='access_unavailable'))break
  if(Date.now()>deadline)throw Error('Clock did not finish within 155 seconds; inspect cron run history')
  await new Promise(resolve=>setTimeout(resolve,5000))
 }while(true)
 const own=state.schedules.find(s=>s.label==='automatic'),revoked=state.schedules.find(s=>s.label==='revoked')
 assert.equal(schedules.find(s=>s.id===own.id).next_index,2)
 assert.equal(schedules.find(s=>s.id===revoked.id).next_index,0)
 const rows=ok(await admin.from('wealth_recurrence_occurrences').select('schedule_id,entry_id,occurrence_index').in('schedule_id',state.schedules.map(s=>s.id)))
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.schedule_id===own.id));assert.deepEqual(rows.map(r=>r.occurrence_index).sort(),[0,1])
 const entries=ok(await admin.from('wealth_entries').select('id,user_id,amount_cents').in('id',rows.map(r=>r.entry_id)))
 assert.equal(entries.length,2);assert.ok(entries.every(e=>e.user_id===own.userId&&e.amount_cents===29))
 const sentinel=ok(await admin.from('background_jobs').select('status,attempts').eq('id',state.sentinel).single())
 assert.deepEqual(sentinel,{status:'queued',attempts:0})
 const events=ok(await admin.from('transactional_outbox').select('id').eq('event_type','wealth.recurrence.generated').eq('aggregate_id',own.id));assert.equal(events.length,2)
 const jobs=ok(await admin.from('background_jobs').select('status,attempts').eq('job_type','wealth.recurrence'));assert.ok(jobs.every(j=>j.status==='completed'&&j.attempts===1))
 fs.writeFileSync('docs/qa/ORCALY_WEALTH_CLOCK_STAGING_E2E.json',JSON.stringify({project:stagingRef,startedAt:state.startedAt,finishedAt:new Date().toISOString(),checks:['automatic-postgres-clock-two-distinct-occurrences','exact-cents-atomic-outbox-and-owner','revoked-entitlement-pauses-with-zero-entries','unrelated-job-untouched','no-manual-process-refresh-or-worker-invocation'],status:'PASS',entries:2,amountCents:58,cleanup:'pending'},null,2)+'\n')
 console.log('PASS real staging clock: two occurrences, entitlement pause, isolation, exact cents, unrelated queue untouched')
}else if(mode==='cleanup-sentinel'){
 const state=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(state.project,stagingRef)
 if(state.sentinel)ok(await admin.from('background_jobs').delete().eq('id',state.sentinel).eq('job_type','qa.clock.unrelated').eq('payload->>fixture','wealth-clock'))
 console.log('Only clock fixture sentinel removed; run the guarded user cleanup next')
}else throw Error('Use prepare, verify or cleanup-sentinel')
