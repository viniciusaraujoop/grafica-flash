import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import fs from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const appUrl=process.env.ORCALY_E2E_BASE_URL
const expectedCommit=process.env.ORCALY_EXPECTED_COMMIT
const previewShare=process.env.VERCEL_PREVIEW_SHARE
const qaToken=process.env.ORCALY_QA_OIDC_TOKEN
const anonKey=process.env.ORCALY_STAGING_ANON_KEY
const stagingUrl='https://zwxulgpjucxudadjdqov.supabase.co'
const prodRef='ozrasuktfthsvbqprtel'
const controlUrl=`${stagingUrl}/functions/v1/wealth-rolling-qa-control`
const output='artifacts/wealth-alerts'
for(const [name,value] of Object.entries({appUrl,expectedCommit,previewShare,qaToken,anonKey}))if(!value)throw Error(`Missing ${name}`)
await fs.mkdir(output,{recursive:true})

const credentials=[
 {id:process.env.QA_A_ID,email:process.env.QA_A_EMAIL,password:process.env.QA_A_PASSWORD},
 {id:process.env.QA_B_ID,email:process.env.QA_B_EMAIL,password:process.env.QA_B_PASSWORD},
 {id:process.env.QA_NO_ID,email:process.env.QA_NO_EMAIL,password:process.env.QA_NO_PASSWORD},
]
if(credentials.some(c=>!c.id||!c.email||!c.password))throw Error('Missing disposable QA identity')
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const makeClient=()=>createClient(stagingUrl,anonKey,options)
const [a,b,no]=credentials.map(c=>({...c,db:makeClient()}))
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data}
const input=(extra={})=>({confirmed:'yes',idempotency_key:randomUUID(),...extra})
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const date=today(),minus8=addDays(date,-8),minus2=addDays(date,-2),plus10=addDays(date,10),plus90=addDays(date,90)
const portfolio=async(u,op,v)=>ok(await u.db.rpc('manage_wealth_portfolio',{p_operation:op,p_input:input(v)}))
const alerts=(u,view='active',page=1)=>u.db.rpc('wealth_alerts_overview',{p_page:page,p_view:view})
const command=(u,op,v)=>u.db.rpc('manage_wealth_alerts',{p_operation:op,p_input:input(v)})
const setAccess=async(mode)=>{
 const response=await fetch(controlUrl,{method:'POST',headers:{authorization:`Bearer ${qaToken}`,'content-type':'application/json'},body:JSON.stringify({action:'set_access',userId:a.id,mode,sourceCommit:expectedCommit})})
 assert.equal(response.status,200,`set_access ${mode} failed`)
}
const report=[],pass=check=>{report.push({check,status:'PASS'});console.log(`PASS ${check}`)}
let browser

try{
 for(const user of [a,b,no]){
  const session=ok(await user.db.auth.signInWithPassword({email:user.email,password:user.password})).session
  assert.ok(session?.access_token)
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'))
  assert.equal(claims.iss,`${stagingUrl}/auth/v1`)
  assert.equal(ok(await user.db.auth.getUser()).user.id,user.id)
 }
 pass('alerts-staging-auth-real-password-and-JWT-issuer')

 const recurrence=ok(await a.db.rpc('create_wealth_recurrence',{p_input:{
  title:'Alert overdue recurrence QA',kind:'expense',category:'housing',amount_cents:100,frequency:'monthly',interval_count:1,
  start_date:minus8,timezone:'America/Sao_Paulo',max_occurrences:3,...input()
 }}))
 ok(await a.db.rpc('save_wealth_debt',{p_input:{
  title:'Alert overdue debt QA',principal_cents:'5000',monthly_rate_bps:'0',minimum_cents:'500',installment_count:null,remaining_installments:null,
  next_due_date:minus2,priority:'1',balance_cents:'5000',financial_date:date,...input()
 },p_entry_id:null,p_version:null}))
 ok(await a.db.from('wealth_goals').insert({user_id:a.id,title:'Alert goal QA',target_cents:10000,saved_cents:1000,monthly_contribution_cents:0,target_date:plus90,currency:'BRL',idempotency_key:randomUUID(),status:'active'}))
 ok(await b.db.from('wealth_goals').insert({user_id:b.id,title:'Foreign alert goal QA',target_cents:20000,saved_cents:1000,monthly_contribution_cents:0,target_date:plus90,currency:'BRL',idempotency_key:randomUUID(),status:'active'}))

 ok(await a.db.rpc('manage_wealth_protection',{p_operation:'save',p_input:input({
  title:'Alert protection QA',category:'other',insurer:'',reference:'',coverage_cents:null,deductible_cents:null,premium_cents:null,
  premium_period:'unknown',starts_on:date,ends_on:plus10,status:'declared',asset_id:null,document_id:null,schedule_id:null,notes:'Hosted Alerts QA'
 })}))

 const p=await portfolio(a,'create',{name:'Alerts Portfolio QA',kind:'real'})
 const holding=await portfolio(a,'holding',{portfolio_id:p,title:'Alert unknown value QA',instrument:'QA-ALERT',quantity:'10',cost_basis_cents:null,amount_cents:'0',financial_date:date,position_class:'stock',liquidity:'short_term',valuation_status:'NOT_AVAILABLE',valuation_source:'Hosted Alerts QA',issuer:'',sector:'',exposure_currency:'BRL',maturity:''})
 const h=ok(await a.db.from('wealth_entries').select('version').eq('id',holding).single())
 await portfolio(a,'transaction',{holding_id:holding,version:h.version,type:'sell',quantity:'1',amount_cents:'100',financial_date:date,reference:'Alerts tax evidence gap QA'})

 const documentId=randomUUID(),pdf=Buffer.from('%PDF-1.4\n% Hosted Alerts QA\n%%EOF\n'),sha=createHash('sha256').update(pdf).digest('hex')
 ok(await a.db.rpc('manage_wealth_document',{p_operation:'reserve',p_input:input({
  id:documentId,title:'Alert expiring document QA',category:'contract',document_date:date,expires_on:plus10,notes:'Hosted Alerts QA',links:[],
  mime_type:'application/pdf',size_bytes:pdf.length,sha256:sha
 })}))
 const objectPath=`${a.id}/${documentId}/document`
 ok(await a.db.storage.from('wealth-documents').upload(objectPath,pdf,{contentType:'application/pdf',upsert:false}))
 const reserved=ok(await a.db.from('wealth_documents').select('version,status').eq('id',documentId).single())
 assert.equal(reserved.status,'pending')
 ok(await a.db.rpc('manage_wealth_document',{p_operation:'finalize',p_input:input({id:documentId,version:reserved.version})}))

 let overview=ok(await alerts(a))
 assert.equal(overview.summary.active,'7')
 assert.equal(overview.summary.urgent,'1')
 assert.deepEqual(new Set(overview.alerts.map(x=>x.source)),new Set(['recurrence','debt','goal','vault','shield','portfolio','tax']))
 assert.equal(overview.source_coverage.automation,'ACTIVE')
 assert.ok(overview.alerts.every(x=>x.deep_link.startsWith('/apps/wealth/')&&x.notification_eligible===true))
 assert.ok(!JSON.stringify(overview).includes('Foreign alert goal QA'))
 const bView=ok(await alerts(b));assert.equal(bView.summary.active,'1');assert.ok(JSON.stringify(bView).includes('Foreign alert goal QA'));assert.ok(!JSON.stringify(bView).includes('Alert overdue debt QA'))
 assert.ok((await alerts(no)).error)
 pass('alerts-seven-real-hosted-sources-plus-automation-contract-owner-isolation-and-no-inferred-facts')

 const recurrenceKey=overview.alerts.find(x=>x.source==='recurrence').alert_key
 const debtKey=overview.alerts.find(x=>x.source==='debt').alert_key
 const taxKey=overview.alerts.find(x=>x.source==='tax').alert_key
 ok(await command(a,'dismiss',{alert_key:recurrenceKey}))
 assert.equal(ok(await alerts(a,'dismissed')).alerts[0].source,'recurrence')
 ok(await command(a,'snooze',{alert_key:debtKey,snooze_hours:24}))
 assert.equal(ok(await alerts(a,'snoozed')).alerts[0].source,'debt')
 ok(await command(a,'restore',{alert_key:recurrenceKey}))
 assert.ok(ok(await alerts(a)).alerts.some(x=>x.source==='recurrence'))
 ok(await command(a,'configure',{version:0,enabled:true,minimum_priority:'attention',cooldown_hours:24,muted_sources:['tax']}))
 overview=ok(await alerts(a));assert.equal(overview.summary.muted,'1');assert.ok(!overview.alerts.some(x=>x.alert_key===taxKey))
 pass('alerts-dismiss-snooze-restore-preferences-and-noise-control-on-staging')

 for(const mode of ['write','revoked','expired']){
  await setAccess(mode)
  assert.ok((await alerts(a)).error)
  assert.ok((await command(a,'dismiss',{alert_key:recurrenceKey})).error)
 }
 await setAccess('read');assert.ok(ok(await alerts(a)).alerts.length);assert.ok((await command(a,'dismiss',{alert_key:recurrenceKey})).error)
 await setAccess('full')
 pass('alerts-entitlement-read-write-rechecked-on-every-boundary')

 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true})
 const makeContext=()=>browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 const authorize=async context=>{
  const response=await context.request.get(`${appUrl}/?_vercel_share=${encodeURIComponent(previewShare)}`)
  assert.ok(response.ok(),`Preview share bootstrap failed: ${response.status()}`)
 }
 const context=await makeContext();await authorize(context)
 await context.route(`**://${prodRef}.supabase.co/**`,route=>route.abort('blockedbyclient'))
 const productionRequests=[]
 context.on('request',request=>{if(request.url().includes(prodRef))productionRequests.push(request.url())})
 const page=await context.newPage();page.setDefaultTimeout(45000)
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message))
 const build=await context.request.get(`${appUrl}/api/internal/preview-build`)
 assert.equal(build.status(),200);assert.match(build.headers()['content-type']||'',/application\/json/)
 const buildJson=await build.json();assert.equal(buildJson.environment,'preview');assert.equal(buildJson.commit,expectedCommit)

 const login=async(user,target)=>{
  const url=new URL(target),relative=url.pathname+url.search
  await page.goto(`${appUrl}/login?next=${encodeURIComponent(relative)}`)
  await page.locator('input[name=email]').fill(user.email)
  await page.locator('input[name=password]').fill(user.password)
  await page.getByRole('button',{name:'Entrar no painel',exact:true}).click()
  await page.waitForURL(u=>u.pathname===url.pathname,{timeout:45000})
 }
 const activeUrl=`${appUrl}/apps/wealth/alertas?view=active&page=1`
 await login(a,activeUrl)
 await page.getByRole('heading',{name:'Wealth Alerts',exact:true}).waitFor()
 let body=await page.locator('body').innerText()
 for(const expected of ['Alert overdue recurrence QA','Alert goal QA','Alert expiring document QA','Alert protection QA','Alert unknown value QA','Venda real com evidência fiscal incompleta','Automações:'])assert.ok(body.includes(expected),expected)
 assert.ok(!body.includes('Foreign alert goal QA'))
 assert.ok(body.includes('Sinais factuais, sem barulho artificial'))
 assert.deepEqual(pageErrors,[]);assert.deepEqual(productionRequests,[])
 pass('alerts-protected-preview-exact-SHA-authenticated-UI-factual-deep-links-and-zero-production-calls')

 const prefs=page.getByText('Preferências e noise control',{exact:true});await prefs.click()
 const prefForm=page.locator('form').filter({has:page.getByText('Prioridade mínima',{exact:true})})
 await prefForm.getByLabel('Prioridade mínima').selectOption('urgent')
 await prefForm.getByLabel('Cooldown de entrega').selectOption('48')
 await prefForm.getByRole('button',{name:'Salvar preferências'}).click()
 await page.getByText('Preferências atualizadas.',{exact:true}).waitFor()
 await page.reload()
 body=await page.locator('body').innerText();assert.ok(body.includes('Cooldown de entrega: 48h'))
 assert.ok(!body.includes('Alert goal QA'),'attention alert should be noise-filtered at urgent threshold')
 pass('alerts-preferences-server-action-and-priority-noise-control-UI')

 await page.goto(`${appUrl}/apps/wealth/alertas?view=all&page=1`)
 const recurrenceItem=page.locator('li').filter({hasText:'Alert overdue recurrence QA'}).first()
 await recurrenceItem.getByLabel('Adiar').selectOption('24')
 await recurrenceItem.getByRole('button',{name:'Adiar',exact:true}).click()
 await recurrenceItem.getByText('Alerta adiado.',{exact:true}).waitFor()
 await page.goto(`${appUrl}/apps/wealth/alertas?view=snoozed&page=1`)
 await page.getByText('Alert overdue recurrence QA',{exact:false}).waitFor()
 await page.getByRole('button',{name:'Reativar',exact:true}).click()
 await page.getByText('Alerta reativado.',{exact:true}).waitFor()
 pass('alerts-snooze-and-restore-server-actions-UI')

 await page.goto(`${appUrl}/apps/wealth/alertas?view=all&page=1`)
 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'})
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${scheme}`)
   if(width===320||width===1440){
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
   }
   await page.screenshot({path:`${output}/alerts-${scheme}-${width}.png`,fullPage:true})
  }
 }
 const nav=page.getByRole('navigation',{name:'Alertas Wealth'})
 await nav.getByRole('link').first().focus();await page.keyboard.press('Tab')
 assert.equal(await nav.getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 assert.deepEqual(pageErrors,[]);assert.deepEqual(productionRequests,[])
 pass('alerts-six-widths-two-themes-Axe-keyboard-focus-reduced-motion-no-overflow')

 const other=await makeContext();await authorize(other);const otherPage=await other.newPage()
 const target=new URL(activeUrl);await otherPage.goto(`${appUrl}/login?next=${encodeURIComponent(target.pathname+target.search)}`)
 await otherPage.locator('input[name=email]').fill(b.email);await otherPage.locator('input[name=password]').fill(b.password);await otherPage.getByRole('button',{name:'Entrar no painel',exact:true}).click()
 await otherPage.getByRole('heading',{name:'Wealth Alerts',exact:true}).waitFor()
 const otherBody=await otherPage.locator('body').innerText();assert.ok(otherBody.includes('Foreign alert goal QA'));assert.ok(!otherBody.includes('Alert overdue debt QA'))
 const anonymous=await makeContext();await authorize(anonymous)
 const anon=await anonymous.request.get(activeUrl,{maxRedirects:0});assert.ok([303,307].includes(anon.status()));assert.ok(String(anon.headers().location||'').includes('/login'))
 await anonymous.close();await other.close()
 pass('alerts-cross-user-UI-and-anonymous-redirect')

 await context.close()
 await Promise.all([a.db.auth.signOut(),b.db.auth.signOut(),no.db.auth.signOut()])
 await fs.writeFile(`${output}/report.json`,JSON.stringify({commit:expectedCommit,appUrl,date,report,pageErrors,productionRequests,finishedAt:new Date().toISOString()},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(x=>x.status!=='PASS').length,pageErrors,productionRequests},null,2))
}catch(error){
 await fs.writeFile(`${output}/failure.txt`,String(error?.stack??error))
 throw error
}finally{
 await browser?.close().catch(()=>{})
}
