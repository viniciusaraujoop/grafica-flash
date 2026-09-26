import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {stagingRef,stagingUrl,anonKey,serviceKey} from './helpers/staging-credentials.mjs'

const appUrl=process.env.ORCALY_STAGING_APP_URL||'http://127.0.0.1:4174'
const output='.local-qa/staging-browser'
await fs.mkdir(output,{recursive:true})
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const admin=createClient(stagingUrl,serviceKey,options)
const client=()=>createClient(stagingUrl,anonKey,options)
const report=[],users=[],entities=new Set(),errors=[],contexts=[]
const startedAt=new Date().toISOString()
let browser,entryRequest,consentId
const ok=(response)=>{assert.equal(response.error,null,response.error?.message);return response.data}
const denied=response=>assert.ok(response.error,'Expected a database denial')
const pass=check=>{report.push({check,status:'PASS'});console.log(`PASS ${check}`)}
const entry=(uid,title)=>({user_id:uid,kind:'income',title,category:'salary',amount_cents:12345,financial_date:'2026-09-26',idempotency_key:randomUUID()})
const active={status:'active',starts_at:'2026-01-01T00:00:00Z',expires_at:null,permissions:['wealth.read','wealth.write']}
async function grant(user,patch=active){ok(await admin.from('ecosystem_product_entitlements').update(patch).eq('user_id',user.id))}
async function login(user,next='/apps'){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 contexts.push(context)
 await context.route('**://ozrasuktfthsvbqprtel.supabase.co/**',route=>{errors.push('Attempted production browser request');return route.abort()})
 const page=await context.newPage();page.setDefaultTimeout(30000)
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${appUrl}/login?next=${encodeURIComponent(next)}`)
 await page.locator('input[name=email]').fill(user.email)
 await page.locator('input[name=password]').fill(user.password)
 await page.getByRole('button',{name:'Entrar no painel',exact:true}).click()
 await page.waitForURL(url=>url.pathname===next,{timeout:45000})
 return {context,page}
}
try{
 assert.equal((ok(await admin.auth.admin.listUsers({page:1,perPage:1}))).users.length,0,'Staging must have no users before this synthetic run')
 const initialAudit=ok(await admin.from('ecosystem_audit_events').select('id').limit(1));assert.deepEqual(initialAudit,[])
 for(const label of ['owner-a','owner-b','no-entitlement']){
  const email=`orcaly-qa-${label}-${randomUUID()}@example.test`,password=`Qa!${randomUUID()}Aa9`
  const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:`Staging QA ${label}`}})).user
  const db=client();users.push({id:created.id,email,password,db})
  await fs.writeFile(`${output}/fixture-user-ids.json`,JSON.stringify(users.map(u=>({id:u.id,email:u.email}))))
  const session=ok(await db.auth.signInWithPassword({email,password})).session
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'))
  assert.equal(claims.iss,`${stagingUrl}/auth/v1`)
  assert.equal(ok(await db.auth.getUser()).user.id,created.id)
 }
 const [a,b,no]=users
 pass('hosted-Auth-password-login-and-verified-JWT-issuer')
 assert.equal(ok(await a.db.auth.refreshSession()).user.id,a.id)
 assert.equal(ok(await a.db.auth.getUser()).user.id,a.id)
 pass('hosted-Auth-token-refresh')
 for(const u of [a,b]){const row=ok(await admin.from('ecosystem_product_entitlements').insert({...active,user_id:u.id,product_id:'wealth',source:'manual'}).select('id').single());entities.add(row.id)}
 denied(await client().from('wealth_entries').select('*'))
 denied(await no.db.from('ecosystem_product_entitlements').insert({user_id:no.id,product_id:'wealth',source:'manual',permissions:['wealth.read','wealth.write']}))
 denied(await a.db.from('ecosystem_product_entitlements').update({permissions:['wealth.export']}).eq('user_id',a.id))
 pass('anonymous-denial-and-no-client-entitlement-escalation')
 const rowA=ok(await a.db.from('wealth_entries').insert(entry(a.id,'API synthetic A')).select().single());entities.add(rowA.id)
 const rowB=ok(await b.db.from('wealth_entries').insert(entry(b.id,'API synthetic B')).select().single());entities.add(rowB.id)
 assert.deepEqual(ok(await a.db.from('wealth_entries').select('id').eq('user_id',b.id)),[])
 denied(await a.db.from('wealth_entries').insert(entry(b.id,'Forged owner')))
 assert.deepEqual(ok(await a.db.from('wealth_entries').update({amount_cents:1}).eq('id',rowB.id).select()),[])
 assert.deepEqual(ok(await a.db.from('wealth_entries').delete().eq('id',rowB.id).select()),[])
 denied(await a.db.from('wealth_entries').update({user_id:b.id}).eq('id',rowA.id))
 assert.equal(ok(await admin.from('wealth_entries').select('amount_cents').eq('id',rowB.id).single()).amount_cents,12345)
 pass('cross-user-select-insert-update-delete-and-owner-transfer-isolation')
 assert.deepEqual(ok(await no.db.from('wealth_entries').select('id')),[])
 denied(await no.db.from('wealth_entries').insert(entry(no.id,'Denied')))
 for(const [label,patch] of [['revoked',{status:'revoked'}],['expired',{starts_at:'2026-01-01T00:00:00Z',expires_at:'2026-02-01T00:00:00Z'}],['future',{starts_at:'2099-01-01T00:00:00Z'}]]){
  await grant(a,{...active,...patch})
  assert.deepEqual(ok(await a.db.from('wealth_entries').select('id')),[])
  denied(await a.db.from('wealth_entries').insert(entry(a.id,`Denied ${label}`)))
 }
 await grant(a,{...active,permissions:['wealth.read']})
 assert.equal(ok(await a.db.from('wealth_entries').select('id')).length,1)
 denied(await a.db.from('wealth_entries').insert(entry(a.id,'Read only denied')))
 await grant(a)
 pass('missing-revoked-expired-future-and-read-only-entitlements')
 const consent={user_id:a.id,source_product:'wealth',target_product:'academy',data_scope:'learning.progress',purpose:'learning.personalization',expires_at:new Date(Date.now()+7*86400000).toISOString()}
 const first=ok(await admin.from('ecosystem_context_consents').insert(consent).select('id,granted_at').single());entities.add(first.id)
 assert.deepEqual(ok(await b.db.from('ecosystem_context_consents').select('id')),[])
 assert.deepEqual(ok(await b.db.from('ecosystem_context_consents').update({revoked_at:new Date().toISOString()}).eq('id',first.id).select()),[])
 denied(await a.db.from('ecosystem_context_consents').insert(consent))
 denied(await a.db.from('ecosystem_context_consents').update({purpose:'personal.planning'}).eq('id',first.id))
 assert.equal(ok(await a.db.from('ecosystem_context_consents').update({revoked_at:first.granted_at}).eq('id',first.id).select()).length,1)
 const undo=await a.db.from('ecosystem_context_consents').update({revoked_at:null}).eq('id',first.id).select();assert.ok(undo.error||undo.data.length===0)
 consentId=ok(await admin.from('ecosystem_context_consents').insert(consent).select('id').single()).id;entities.add(consentId)
 pass('consent-owner-isolation-column-grants-and-irreversible-revocation')
 denied(await a.db.from('ecosystem_audit_events').select('*'))
 const events=ok(await admin.from('ecosystem_audit_events').select('*').eq('entity_id',rowA.id))
 assert.ok(events.some(e=>e.event_type==='wealth_entries.insert'))
 assert.deepEqual(Object.keys(events[0]).sort(),['actor_id','entity_id','event_type','id','recorded_at'])
 pass('private-audit-trigger-and-identifier-only-payload')
 browser=await chromium.launch({channel:'chrome',headless:true})
 const {context,page}=await login(a)
 await page.getByRole('heading',{name:/Tudo começa com/}).waitFor()
 await page.getByRole('link',{name:'Abrir meu Wealth',exact:true}).click()
 await page.getByRole('heading',{name:'Seu dinheiro. Suas possibilidades.'}).waitFor()
 const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
 assert.deepEqual(a11y.violations.map(v=>v.id),[])
 pass('real-login-Server-Action-App-Hub-Wealth-and-WCAG')
 const profile=page.locator('form').filter({has:page.getByLabel('Renda mensal declarada (R$)')})
 await profile.getByLabel('Renda mensal declarada (R$)').fill('5000,00')
 await profile.getByLabel('Orçamento mensal (R$)').fill('2500,00')
 await profile.getByRole('button',{name:'Salvar no meu Wealth'}).click()
 await profile.getByRole('status').filter({hasText:'Registro salvo'}).waitFor();entities.add(a.id)
 const form=page.locator('form').filter({has:page.getByLabel('Nome do lançamento')})
 await form.getByLabel('Nome do lançamento').fill('Receita hospedada QA')
 await form.getByLabel('Valor (R$)',{exact:true}).fill('499,90')
 await form.evaluate((element,id)=>{const hidden=document.createElement('input');hidden.type='hidden';hidden.name='user_id';hidden.value=id;element.appendChild(hidden)},b.id)
 const pending=page.waitForRequest(r=>r.method()==='POST'&&!!r.headers()['next-action'])
 await form.getByRole('button',{name:'Salvar no meu Wealth'}).click();entryRequest=await pending
 await form.getByRole('status').filter({hasText:'Registro salvo'}).waitFor()
 const persisted=ok(await admin.from('wealth_entries').select('*').eq('title','Receita hospedada QA').single());entities.add(persisted.id)
 assert.equal(persisted.user_id,a.id);assert.equal(persisted.amount_cents,49990)
 const goal=page.locator('form').filter({has:page.getByLabel('Nome da meta')})
 await goal.getByLabel('Nome da meta').fill('Reserva hospedada QA')
 await goal.getByLabel('Objetivo (R$)',{exact:true}).fill('10000')
 await goal.getByLabel('Aporte mensal planejado (R$)').fill('500')
 await goal.getByLabel('Data desejada').fill('2027-09-26')
 await goal.getByRole('button',{name:'Salvar no meu Wealth'}).click()
 await goal.getByRole('status').filter({hasText:'Registro salvo'}).waitFor()
 const savedGoal=ok(await admin.from('wealth_goals').select('id,target_cents').eq('user_id',a.id).single());entities.add(savedGoal.id);assert.equal(savedGoal.target_cents,1000000)
 await page.getByRole('button',{name:'Calcular cenário'}).click()
 await page.getByText(/Valor no cenário: R\$\s*1\.200,00/).waitFor()
 await page.reload({waitUntil:'networkidle'})
 await page.getByRole('cell',{name:'Receita hospedada QA',exact:true}).waitFor()
 await page.getByRole('cell',{name:'Reserva hospedada QA',exact:true}).waitFor()
 await page.screenshot({path:`${output}/wealth-hosted.png`,fullPage:true})
 pass('Server-Actions-profile-entry-goal-persistence-cents-and-forged-owner-rejected')
 const other=await login(b,'/apps/wealth')
 assert.equal(await other.page.getByText('Receita hospedada QA',{exact:true}).count(),0)
 const forbidden=await login(no,'/apps/wealth')
 await forbidden.page.getByText(/ainda não está liberado/).waitFor()
 assert.equal(await forbidden.page.getByLabel('Nome do lançamento').count(),0)
 pass('browser-cross-user-isolation-and-unentitled-gate')
 // Replay the observed action without cookies; do not fabricate an action ID.
 const anonymous=await browser.newContext();contexts.push(anonymous)
 const headers=entryRequest.headers()
 const response=await anonymous.request.post(entryRequest.url(),{headers:{'content-type':headers['content-type'],'next-action':headers['next-action'],origin:appUrl},data:entryRequest.postDataBuffer(),maxRedirects:0})
 assert.ok([303,307].includes(response.status()))
 assert.ok(response.headers().location.includes('/login'))
 assert.equal(ok(await admin.from('wealth_entries').select('id').eq('title','Receita hospedada QA')).length,1)
 await grant(a,{...active,status:'revoked'})
 await form.getByLabel('Nome do lançamento').fill('Stale form denied')
 await form.getByLabel('Valor (R$)',{exact:true}).fill('1,00')
 await form.getByRole('button',{name:'Salvar no meu Wealth'}).click()
 await form.getByRole('status').filter({hasText:'não permite salvar'}).waitFor()
 assert.equal(ok(await admin.from('wealth_entries').select('id').eq('title','Stale form denied')).length,0)
 await grant(a)
 pass('unauthenticated-action-replay-and-stale-form-after-entitlement-revocation')
 // Exercise application/database clock skew and PostgreSQL microsecond precision explicitly.
 const futureGrant=new Date(Date.now()+60000).toISOString().replace('Z','123Z')
 ok(await admin.from('ecosystem_context_consents').update({granted_at:futureGrant}).eq('id',consentId))
 await page.goto(`${appUrl}/apps/privacidade`)
 const revocationResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/apps/privacidade')
 await page.getByRole('button',{name:'Revogar consentimento',exact:true}).click()
 await (await revocationResponse).finished()
 assert.ok(ok(await admin.from('ecosystem_context_consents').select('revoked_at').eq('id',consentId).single()).revoked_at)
 await page.reload();assert.equal(await page.getByRole('button',{name:'Revogar consentimento',exact:true}).count(),0)
 await page.goto(appUrl);await page.waitForURL(url=>url.pathname==='/apps')
 pass('consent-Server-Action-clock-skew-microseconds-and-authenticated-home-redirect')
 assert.deepEqual(errors,[])
 pass('no-browser-errors-or-production-requests')
}catch(error){report.push({check:'execution',status:'FAIL',message:error.message});process.exitCode=1;console.error(error.stack)}
finally{
 await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser?.close()
 // Collect fixture entity IDs before user cascades; triggers during cascades retain only IDs.
 for(const user of users){
  for(const table of ['ecosystem_product_entitlements','ecosystem_context_consents','wealth_entries','wealth_goals']){
   const rows=await admin.from(table).select('id').eq('user_id',user.id);for(const row of rows.data??[])entities.add(row.id)
  }
  entities.add(user.id)
  const deleted=await admin.auth.admin.deleteUser(user.id);if(deleted.error){errors.push(`Cleanup user ${user.id}: ${deleted.error.code}`);process.exitCode=1}
 }
 if(entities.size){const cleaned=await admin.from('ecosystem_audit_events').delete().in('entity_id',[...entities]);if(cleaned.error){errors.push(`Cleanup audit: ${cleaned.error.code}`);process.exitCode=1}}
 const remaining=await admin.auth.admin.listUsers({page:1,perPage:1})
 const cleanup={usersRemaining:remaining.data?.users?.length??null,auditRowsRemaining:(await admin.from('ecosystem_audit_events').select('id')).data?.length??null}
 if(cleanup.usersRemaining!==0||cleanup.auditRowsRemaining!==0)process.exitCode=1
 await fs.writeFile(`${output}/report.json`,JSON.stringify({project:stagingRef,appUrl,startedAt,finishedAt:new Date().toISOString(),report,errors,cleanup,limits:['Next.js app served locally unless ORCALY_STAGING_APP_URL overrides it','Auth, JWT, refresh, PostgREST, RLS, grants and persistence use real hosted Supabase staging','No production data or credentials used; no email sent; all accounts confirmed by staging Admin API']},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(r=>r.status!=='PASS').length,cleanup,errors},null,2))
}
