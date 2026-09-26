import {testWealthTimeline} from './e2e-wealth-timeline.mjs'
import {testWealthFamily} from './e2e-wealth-family.mjs'
import {testWealthAutomation} from './e2e-wealth-automation.mjs'
import {testWealthDocuments} from './e2e-wealth-documents.mjs'
import {testWealthPlanning} from './e2e-wealth-planning.mjs'
import {testWealthCalendar} from './e2e-wealth-calendar.mjs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {stagingRef,stagingUrl,anonKey,serviceKey} from './helpers/staging-credentials.mjs'
import {cleanupWealthSchedules,wealthScheduleFixtureCounts} from './helpers/cleanup-wealth-schedules.mjs'
import {testWealthRecurrence} from './e2e-wealth-recurrence.mjs'
import {testWealthPortfolio} from './e2e-wealth-portfolio.mjs'
import {testWealthHealth} from './e2e-wealth-health.mjs'
import {testWealthNetWorth} from './e2e-wealth-net-worth.mjs'
import {testWealthDebt} from './e2e-wealth-debt.mjs'

const appUrl=process.env.ORCALY_STAGING_APP_URL||'http://127.0.0.1:4174'
const accessFile=process.env.ORCALY_STAGING_ACCESS_FILE
const accessUrl=accessFile?JSON.parse(await fs.readFile(accessFile,'utf8')).shareableUrl:null
if(accessUrl&&new URL(accessUrl).origin!==new URL(appUrl).origin)throw new Error('Preview access URL origin mismatch')
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
async function authorizePreview(context){if(accessUrl){const result=await context.request.get(accessUrl);assert.equal(result.status(),200,'Could not enter the protected Preview')}}
async function grant(user,patch=active){ok(await admin.from('ecosystem_product_entitlements').update(patch).eq('user_id',user.id))}
async function login(user,next='/apps'){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 contexts.push(context)
 await authorizePreview(context)
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
 browser=await chromium.launch({channel:'chrome',headless:true})
 if(accessUrl){
  const probe=await browser.newContext();contexts.push(probe);await authorizePreview(probe)
  const build=await (await probe.request.get(`${appUrl}/api/internal/preview-build`)).json()
  assert.equal(build.environment,'preview');assert.equal(build.commit,process.env.ORCALY_EXPECTED_COMMIT)
  const html=await (await probe.request.get(`${appUrl}/login`)).text()
  const scripts=[...html.matchAll(/<script[^>]+src="([^\"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),appUrl).href)
  let stagingFound=false
  for(const url of new Set(scripts)){if(new URL(url).origin!==new URL(appUrl).origin)continue;const source=await (await probe.request.get(url)).text();if(source.includes(stagingUrl))stagingFound=true;assert.ok(!source.includes('https://ozrasuktfthsvbqprtel.supabase.co'),'Production Supabase URL in Preview client');assert.ok(!source.includes(serviceKey),'Service credential exposed in browser bundle')}
  assert.ok(stagingFound,'No staging Supabase URL found in Preview client bundles')
  pass('Vercel-Preview-exact-commit-staging-bundle-and-no-service-secret')
 }
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
 await authorizePreview(anonymous)
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
 await revocationResponse
 let revoked=false
 for(let attempt=0;attempt<30;attempt++){
  revoked=Boolean(ok(await admin.from('ecosystem_context_consents').select('revoked_at').eq('id',consentId).single()).revoked_at)
  if(revoked)break
  await new Promise(resolve=>setTimeout(resolve,500))
 }
 assert.ok(revoked,'Revocation was not persisted within 15 seconds')
 await page.reload();assert.equal(await page.getByRole('button',{name:'Revogar consentimento',exact:true}).count(),0)
 await page.goto(appUrl);await page.waitForURL(url=>url.pathname==='/apps')
 pass('consent-Server-Action-clock-skew-microseconds-and-authenticated-home-redirect')
 if(process.env.ORCALY_QA_RECORDS==='true'){
  const rows=ok(await admin.from('wealth_entries').insert([
   ...Array.from({length:26},(_,i)=>({...entry(a.id,`Página QA ${String(i).padStart(2,'0')}`),kind:i===0?'expense':'income'})),
   {...entry(a.id,'Outro mês QA'),financial_date:'2026-08-01'},
   entry(a.id,'=HYPERLINK("https://example.test")'),
  ]).select('id'))
  for(const row of rows)entities.add(row.id)
  await page.goto(`${appUrl}/apps/wealth/lancamentos?month=2026-09`)
  await page.getByRole('heading',{name:'Seus lançamentos',exact:true}).waitFor()
  assert.equal(await page.locator('tbody tr').count(),25)
  const firstPage=await page.locator('tbody tr td:first-child').allTextContents()
  await page.getByRole('link',{name:'Próxima página',exact:true}).click()
  await page.getByText('Lançamentos pessoais · página 2 de 2',{exact:true}).waitFor()
  const secondPage=await page.locator('tbody tr td:first-child').allTextContents()
  assert.equal(secondPage.length,4);assert.ok(secondPage.every(title=>!firstPage.includes(title)))
  assert.ok([...firstPage,...secondPage].every(title=>title!=='API synthetic B'&&title!=='Outro mês QA'))
  const exportPath=`${appUrl}/apps/wealth/exportar?month=2026-09&user_id=${b.id}`
  assert.equal((await context.request.get(exportPath)).status(),403)
  await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
  await page.reload()
  const csvResponse=await context.request.get(exportPath)
  assert.equal(csvResponse.status(),200);assert.ok(csvResponse.headers()['cache-control'].includes('no-store'))
  assert.ok(csvResponse.headers()['content-disposition'].includes('attachment'))
  const csv=await csvResponse.text()
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"")"'))
  assert.ok(!csv.includes('API synthetic B'));assert.ok(!csv.includes('Outro mês QA'));assert.ok(csv.includes('"499,90";"49990"'))
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('link',{name:'Baixar CSV dos resultados',exact:true}).click()
  const download=await downloadPromise;await download.saveAs(`${output}/wealth-synthetic.csv`)
  assert.equal(download.suggestedFilename(),'orcaly-wealth-lancamentos.csv')
  assert.equal((await context.request.get(`${appUrl}/apps/wealth/exportar?month=2026-13`)).status(),400)
  assert.equal((await context.request.get(`${appUrl}/apps/wealth/exportar?kind=income&kind=expense`)).status(),400)
  assert.ok(ok(await admin.from('ecosystem_audit_events').select('id').eq('actor_id',a.id).eq('event_type','wealth_entries.export')).length>=1)
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>v.id),[])
  await page.screenshot({path:`${output}/records-hosted.png`,fullPage:true})
  await page.getByLabel('Tipo de lançamento').selectOption('expense')
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click()
  await page.waitForURL(url=>url.searchParams.get('kind')==='expense'&&url.searchParams.get('month')==='2026-09')
  assert.equal(await page.locator('tbody tr').count(),1)
  assert.ok(await page.locator('tbody').innerText().then(text=>text.includes('Despesa')))
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:900})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`History overflow at ${width}`)
  }
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:`${output}/records-mobile.png`,fullPage:true})
  pass('history-pagination-month-filter-cross-user-exclusion-CSV-permission-escaping-download-and-audit')
 }
 if(process.env.ORCALY_QA_EDIT==='true'){
  const editUrl=`${appUrl}/apps/wealth/lancamentos/${persisted.id}`
  await page.goto(editUrl)
  const stale=await context.newPage();stale.setDefaultTimeout(30000);stale.on('pageerror',error=>errors.push(error.message))
  await stale.goto(editUrl)
  await page.getByLabel('Nome do lançamento').fill('Receita corrigida QA')
  await page.getByLabel('Valor (R$)',{exact:true}).fill('501,23')
  await page.locator('form').filter({has:page.getByLabel('Nome do lançamento')}).evaluate((element,id)=>{const hidden=document.createElement('input');hidden.type='hidden';hidden.name='user_id';hidden.value=id;element.appendChild(hidden)},b.id)
  const editRequestPromise=page.waitForRequest(r=>r.method()==='POST'&&!!r.headers()['next-action'])
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click()
  const editRequest=await editRequestPromise
  await page.getByRole('status').filter({hasText:'Lançamento atualizado'}).waitFor()
  const updated=ok(await admin.from('wealth_entries').select('*').eq('id',persisted.id).single())
  assert.equal(updated.user_id,a.id);assert.equal(updated.amount_cents,50123);assert.equal(updated.idempotency_key,persisted.idempotency_key);assert.equal(updated.created_at,persisted.created_at)
  await page.reload();assert.equal(await page.getByLabel('Nome do lançamento').inputValue(),'Receita corrigida QA');assert.equal(await page.getByLabel('Valor (R$)',{exact:true}).inputValue(),'501,23')
  assert.ok(ok(await admin.from('ecosystem_audit_events').select('id').eq('actor_id',a.id).eq('entity_id',persisted.id).eq('event_type','wealth_entries.update')).length>=1)
  const editAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(editAxe.violations.map(v=>v.id),[])
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
  await page.screenshot({path:`${output}/edit-hosted.png`,fullPage:true})
  pass('entry-edit-Server-Action-exact-cents-owner-immutable-fields-audit-reload-and-WCAG')
  await stale.getByLabel('Nome do lançamento').fill('Stale edit denied')
  await stale.getByLabel('Valor (R$)',{exact:true}).fill('2,00')
  await stale.getByRole('button',{name:'Salvar alterações',exact:true}).click()
  await stale.getByRole('status').filter({hasText:'mudou em outra aba'}).waitFor()
  assert.equal(ok(await admin.from('wealth_entries').select('title,amount_cents').eq('id',persisted.id).single()).amount_cents,50123)
  await stale.close()
  pass('stale-edit-does-not-overwrite-newer-values')
  await other.page.goto(editUrl)
  assert.equal(await other.page.getByLabel('Nome do lançamento').count(),0)
  assert.equal(await other.page.getByText('Receita corrigida QA',{exact:true}).count(),0)
  await other.page.goto(`${appUrl}/apps/wealth/lancamentos/${rowB.id}`)
  await other.page.locator('input[name="entry_id"]').evaluate((element,id)=>{element.value=id},persisted.id)
  await other.page.getByLabel('Nome do lançamento').fill('Forged edit denied')
  await other.page.getByRole('button',{name:'Salvar alterações',exact:true}).click()
  await other.page.getByRole('status').filter({hasText:'indisponível para edição'}).waitFor()
  assert.equal(ok(await admin.from('wealth_entries').select('title').eq('id',persisted.id).single()).title,'Receita corrigida QA')
  assert.equal(ok(await admin.from('wealth_entries').select('title').eq('id',rowB.id).single()).title,'API synthetic B')
  await grant(a,{...active,permissions:['wealth.read']})
  await page.getByLabel('Nome do lançamento').fill('Read-only edit denied')
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click()
  await page.getByRole('status').filter({hasText:'não permite editar'}).waitFor()
  await page.reload();assert.equal(await page.getByLabel('Nome do lançamento').count(),0)
  const editHeaders=editRequest.headers()
  const replay=await anonymous.request.post(editRequest.url(),{headers:{'content-type':editHeaders['content-type'],'next-action':editHeaders['next-action'],origin:appUrl},data:editRequest.postDataBuffer(),maxRedirects:0})
  assert.ok([303,307].includes(replay.status()));assert.ok(replay.headers().location.includes('/login'))
  assert.equal(ok(await admin.from('wealth_entries').select('title').eq('id',persisted.id).single()).title,'Receita corrigida QA')
  await grant(a)
  pass('entry-edit-forged-owner-cross-user-read-only-and-anonymous-denial')
 }
 if(process.env.ORCALY_QA_LIFECYCLE==='true'){
  await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
  const summary=async()=>ok(await a.db.rpc('wealth_summary',{p_month:'2026-09-01'}))
  const transition=async(archived)=>{
   await page.locator('summary').filter({hasText:archived?'Restaurar registro':'Arquivar registro'}).click()
   await page.getByRole('checkbox',{name:archived?/Confirmo que desejo restaurar/:/Confirmo que desejo arquivar/}).check()
   await page.getByRole('button',{name:archived?'Confirmar restauração':'Confirmar arquivamento',exact:true}).click()
   await page.getByRole('heading',{name:archived?'Arquivamento':'Registro arquivado',exact:true}).waitFor()
  }
  const entryUrl=`${appUrl}/apps/wealth/lancamentos/${persisted.id}`
  await page.goto(entryUrl)
  const oldTab=await context.newPage();await oldTab.goto(entryUrl)
  const before=await summary(),current=ok(await a.db.from('wealth_entries').select('*').eq('id',persisted.id).single())
  await transition(false)
  const archived=ok(await a.db.from('wealth_entries').select('*').eq('id',persisted.id).single())
  assert.ok(archived.archived_at);assert.equal(archived.version,current.version+1)
  assert.equal(BigInt((await summary()).income),BigInt(before.income)-BigInt(current.amount_cents))
  assert.equal(await page.getByLabel('Nome do lançamento').count(),0)
  const archivedCsv=await context.request.get(`${appUrl}/apps/wealth/exportar?archive=archived`)
  assert.equal(archivedCsv.status(),200);assert.ok((await archivedCsv.text()).includes(persisted.id))
  assert.ok(!(await (await context.request.get(`${appUrl}/apps/wealth/exportar`)).text()).includes(persisted.id))
  await page.goto(`${appUrl}/apps/wealth/lancamentos?archive=archived`)
  assert.equal(await page.locator('tbody tr').count(),1)
  await page.getByRole('link',{name:current.title,exact:true}).click();await transition(true)
  assert.equal((await summary()).income,before.income)
  await oldTab.getByLabel('Nome do lançamento').fill('ABA stale denied')
  await oldTab.getByRole('button',{name:'Salvar alterações',exact:true}).click()
  await oldTab.getByRole('status').filter({hasText:'mudou em outra aba'}).waitFor()
  assert.equal(ok(await a.db.from('wealth_entries').select('title').eq('id',persisted.id).single()).title,current.title)
  await oldTab.close()
  pass('entry-archive-restore-totals-CSV-filters-and-ABA-stale-protection')
  const goalUrl=`${appUrl}/apps/wealth/metas/${savedGoal.id}`
  await page.goto(goalUrl)
  const oldGoal=await context.newPage();await oldGoal.goto(goalUrl)
  await page.getByLabel('Nome da meta').fill('Meta concluída QA')
  await page.getByLabel('Objetivo (R$)',{exact:true}).fill('1000')
  await page.getByLabel('Já reservado (R$)',{exact:true}).fill('1000')
  await page.getByLabel('Status da meta').selectOption('completed')
  await page.getByRole('button',{name:'Salvar meta',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Meta atualizada'}).waitFor()
  const completed=ok(await a.db.from('wealth_goals').select('*').eq('id',savedGoal.id).single())
  assert.equal(completed.status,'completed');assert.equal(completed.saved_cents,100000);assert.equal(completed.user_id,a.id)
  await oldGoal.getByLabel('Nome da meta').fill('Stale goal denied')
  await oldGoal.getByRole('button',{name:'Salvar meta',exact:true}).click()
  await oldGoal.getByRole('status').filter({hasText:'alterado em outra aba'}).waitFor();await oldGoal.close()
  await transition(false);assert.equal((await summary()).goalCount,'0')
  await transition(true);assert.equal((await summary()).completedGoals,'1')
  await other.page.goto(goalUrl);assert.equal(await other.page.getByLabel('Nome da meta').count(),0)
  assert.deepEqual(ok(await b.db.from('wealth_goals').update({archived_at:new Date().toISOString()}).eq('id',savedGoal.id).select('id')),[])
  await grant(a,{...active,permissions:['wealth.read']})
  await page.locator('summary').filter({hasText:'Arquivar registro'}).click()
  await page.getByRole('checkbox',{name:/Confirmo que desejo arquivar/}).check()
  await page.getByRole('button',{name:'Confirmar arquivamento',exact:true}).click()
  await page.getByRole('status').filter({hasText:'não permite esta alteração'}).waitFor()
  assert.equal(ok(await admin.from('wealth_goals').select('archived_at').eq('id',savedGoal.id).single()).archived_at,null)
  await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
  pass('goal-edit-complete-archive-restore-stale-cross-user-and-read-only-boundaries')
  const initial=await summary()
  for(let offset=0;offset<1205;offset+=200){
   const rows=ok(await admin.from('wealth_entries').insert(Array.from({length:Math.min(200,1205-offset)},(_,i)=>({...entry(a.id,`Integral ${offset+i}`),amount_cents:100000000000000}))).select('id'))
   for(const row of rows)entities.add(row.id)
  }
  const moreGoals=ok(await admin.from('wealth_goals').insert(Array.from({length:104},(_,i)=>({user_id:a.id,title:`Meta paginada ${String(i).padStart(3,'0')}`,target_cents:10000,saved_cents:2500,monthly_contribution_cents:0,target_date:'2027-12-01',idempotency_key:crypto.randomUUID()}))).select('id'))
  for(const row of moreGoals)entities.add(row.id)
  const whole=await summary()
  assert.equal(BigInt(whole.income),BigInt(initial.income)+1205n*100000000000000n);assert.equal(whole.goalCount,'105')
  assert.equal((await context.request.get(`${appUrl}/apps/wealth/exportar?month=2026-09`)).status(),413)
  await page.goto(`${appUrl}/apps/wealth/metas`)
  assert.equal(await page.locator('tbody tr').count(),25)
  const titles=await page.locator('tbody tr td:first-child').allTextContents()
  await page.getByRole('link',{name:'Próxima página',exact:true}).click()
  await page.getByText('Metas · página 2 de 5',{exact:true}).waitFor()
  assert.ok((await page.locator('tbody tr td:first-child').allTextContents()).every(title=>!titles.includes(title)))
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[])
  await page.goto(`${appUrl}/apps/wealth`)
  await page.getByText(`Totais calculados com todos os ${whole.entryCount} lançamentos ativos.`,{exact:false}).waitFor()
  const cash=BigInt(whole.cashFlow),magnitude=cash<0n?-cash:cash
  const expected=`${cash<0n?'-':''}R$ ${(magnitude/100n).toLocaleString('pt-BR')},${String(magnitude%100n).padStart(2,'0')}`
  assert.ok((await page.locator('dl').innerText()).replace(/\s+/g,' ').includes(expected))
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Overview overflow at ${width}`)
   const clipped=await page.locator('dl dd').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>({text:node.textContent,width:node.clientWidth,scroll:node.scrollWidth,wrap:getComputedStyle(node).overflowWrap})))
   assert.deepEqual(clipped,[],`Metric clipping at ${width}: ${JSON.stringify(clipped)}`)
  }
  await page.setViewportSize({width:390,height:1100});await page.screenshot({path:`${output}/lifecycle-aggregate-top.png`});await page.screenshot({path:`${output}/lifecycle-aggregate.png`,fullPage:true})
  pass('full-precision-hosted-aggregates-over-1000-entries-100-goals-pagination-and-export-cap')
 }
 if(process.env.ORCALY_QA_RECURRENCE==='true')await testWealthRecurrence({page,context,other,a,b,admin,appUrl,grant,active,ok,pass,errors,output})
 if(process.env.ORCALY_QA_DEBT==='true')await testWealthDebt({page,context,other,a,b,admin,appUrl,grant,active,ok,pass,errors,output})
 if(process.env.ORCALY_QA_NET_WORTH==='true')await testWealthNetWorth({page,context,a,b,admin,appUrl,grant,active,ok,pass,errors,output})
 if(process.env.ORCALY_QA_PORTFOLIO==='true')await testWealthPortfolio({page,context,a,b,admin,appUrl,grant,active,ok,pass,errors,output})
 if(process.env.ORCALY_QA_HEALTH==='true')await testWealthHealth({page,other,a,b,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_CALENDAR==='true')await testWealthCalendar({page,context,a,b,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_PLANNING==='true')await testWealthPlanning({page,context,a,b,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_DOCUMENTS==='true')await testWealthDocuments({page,context,other,anonymous,a,b,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_TIMELINE==='true')await testWealthTimeline({page,context,other,anonymous,a,b,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_FAMILY==='true')await testWealthFamily({page,context,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output})
 if(process.env.ORCALY_QA_AUTOMATION==='true')await testWealthAutomation({page,context,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output})
 assert.deepEqual(errors,[])
 pass('no-browser-errors-or-production-requests')
}catch(error){const safeMessage=String(error?.message??error).split('\n')[0];report.push({check:'execution',status:'FAIL',message:safeMessage});process.exitCode=1;console.error(safeMessage)}
finally{
 await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser?.close()
 // Collect fixture entity IDs before user cascades; triggers during cascades retain only IDs.
 for(const user of users){for(let offset=0;;offset+=500){const events=ok(await admin.from('ecosystem_audit_events').select('id,entity_id').eq('actor_id',user.id).order('id').range(offset,offset+499));for(const e of events)entities.add(e.entity_id);if(events.length<500)break}}
 for(const user of users){
  await cleanupWealthSchedules(admin,user.id,entities)
  for(const table of ['ecosystem_product_entitlements','ecosystem_context_consents','wealth_entries','wealth_goals','wealth_net_worth_snapshots','wealth_portfolios','wealth_holdings','wealth_portfolio_transactions','wealth_goal_funding','wealth_life_plans','wealth_documents']){
   for(let offset=0;;offset+=500){const rows=ok(await admin.from(table).select('id').eq('user_id',user.id).order('id').range(offset,offset+499));for(const row of rows)entities.add(row.id);if(rows.length<500)break}
  }
  const docs=ok(await admin.from('wealth_documents').select('object_path').eq('user_id',user.id));if(docs.length)ok(await admin.storage.from('wealth-documents').remove(docs.map(d=>d.object_path)))
  await user.db.auth.signOut()
  entities.add(user.id)
  const deleted=await admin.auth.admin.deleteUser(user.id);if(deleted.error){errors.push(`Cleanup user ${user.id}: ${deleted.error.code}`);process.exitCode=1}
 }
 const entityIds=[...entities]
 for(let offset=0;offset<entityIds.length;offset+=100){const cleaned=await admin.from('ecosystem_audit_events').delete().in('entity_id',entityIds.slice(offset,offset+100));if(cleaned.error){errors.push(`Cleanup audit: ${cleaned.error.code}`);process.exitCode=1}}
 const billRows=await admin.from('wealth_bill_details').select('id',{count:'exact',head:true});if(billRows.error||billRows.count!==0)process.exitCode=1
 const remaining=await admin.auth.admin.listUsers({page:1,perPage:1})
 const cleanup={billDetailsRemaining:billRows.count,usersRemaining:remaining.data?.users?.length??null,auditRowsRemaining:(await admin.from('ecosystem_audit_events').select('id')).data?.length??null}
 Object.assign(cleanup,await wealthScheduleFixtureCounts(admin))
 if(process.env.ORCALY_QA_DEBT==='true')cleanup.debtTermsRemaining=(await admin.from('wealth_debt_terms').select('id',{count:'exact',head:true})).count
 if(process.env.ORCALY_QA_NET_WORTH==='true')cleanup.snapshotsRemaining=(await admin.from('wealth_net_worth_snapshots').select('id',{count:'exact',head:true})).count
 if(process.env.ORCALY_QA_PORTFOLIO==='true')for(const t of ['wealth_portfolios','wealth_holdings','wealth_portfolio_transactions'])cleanup[t]=(await admin.from(t).select('id',{count:'exact',head:true})).count
 if(process.env.ORCALY_QA_PLANNING==='true')for(const t of ['wealth_goal_funding','wealth_life_plans'])cleanup[t]=(await admin.from(t).select('id',{count:'exact',head:true})).count
 if(process.env.ORCALY_QA_DOCUMENTS==='true'){cleanup.documents=(await admin.from('wealth_documents').select('id',{count:'exact',head:true})).count;cleanup.storageFolders=ok(await admin.storage.from('wealth-documents').list()).length}
 if(Object.values(cleanup).some(value=>value!==0))process.exitCode=1
 if(cleanup.usersRemaining!==0||cleanup.auditRowsRemaining!==0)process.exitCode=1
 await fs.writeFile(`${output}/report.json`,JSON.stringify({project:stagingRef,appUrl,commit:accessUrl?process.env.ORCALY_EXPECTED_COMMIT:null,startedAt,finishedAt:new Date().toISOString(),report,errors,cleanup,limits:[accessUrl?'Next.js served by protected Vercel Preview; Supabase staging hosted in sa-east-1':'Next.js application served locally; Supabase staging hosted in sa-east-1','Auth, JWT, refresh, PostgREST, RLS, grants and persistence use real hosted Supabase staging','No production data or credentials used; no email sent; all accounts confirmed by staging Admin API']},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(r=>r.status!=='PASS').length,cleanup,errors},null,2))
}
