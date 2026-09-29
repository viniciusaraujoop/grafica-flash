import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import {chromium} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const appUrl=process.env.ORCALY_E2E_BASE_URL
const expectedCommit=process.env.ORCALY_EXPECTED_COMMIT
const previewShare=process.env.VERCEL_PREVIEW_SHARE
const qaToken=process.env.ORCALY_QA_OIDC_TOKEN
const stagingUrl='https://zwxulgpjucxudadjdqov.supabase.co'
const anonKey=process.env.ORCALY_STAGING_ANON_KEY
const controlUrl=`${stagingUrl}/functions/v1/wealth-rolling-qa-control`
const output='artifacts/wealth-briefing'
for(const [name,value] of Object.entries({appUrl,expectedCommit,previewShare,qaToken,anonKey}))if(!value)throw Error(`Missing ${name}`)
await fs.mkdir(output,{recursive:true})

const creds=[
 {id:process.env.QA_A_ID,email:process.env.QA_A_EMAIL,password:process.env.QA_A_PASSWORD},
 {id:process.env.QA_B_ID,email:process.env.QA_B_EMAIL,password:process.env.QA_B_PASSWORD},
 {id:process.env.QA_NO_ID,email:process.env.QA_NO_EMAIL,password:process.env.QA_NO_PASSWORD},
]
if(creds.some(c=>!c.id||!c.email||!c.password))throw Error('Missing disposable QA identity')
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const client=()=>createClient(stagingUrl,anonKey,options)
const [a,b,no]=creds.map(c=>({...c,db:client()}))
const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data}
const rpc=async(u,operation,input)=>ok(await u.db.rpc('manage_wealth_portfolio',{p_operation:operation,p_input:{confirmed:'yes',idempotency_key:randomUUID(),...input}}))
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const today=localDate(),yesterday=addDays(today,-1),tomorrow=addDays(today,1),plus7=addDays(today,7),plus10=addDays(today,10)
const setAccess=async(mode)=>{
 const response=await fetch(controlUrl,{method:'POST',headers:{authorization:`Bearer ${qaToken}`,'content-type':'application/json'},body:JSON.stringify({action:'set_access',userId:a.id,mode,sourceCommit:expectedCommit})})
 assert.equal(response.status,200,`set_access ${mode} failed`)
}
const report=[]
const pass=check=>{report.push({check,status:'PASS'});console.log(`PASS ${check}`)}
let browser

try{
 for(const user of [a,b,no]){
  const session=ok(await user.db.auth.signInWithPassword({email:user.email,password:user.password})).session
  assert.ok(session?.access_token)
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'))
  assert.equal(claims.iss,`${stagingUrl}/auth/v1`)
  assert.equal(ok(await user.db.auth.getUser()).user.id,user.id)
 }
 pass('briefing-staging-auth-real-password-and-JWT-issuer')

 ok(await a.db.from('wealth_entries').insert([
  {user_id:a.id,kind:'income',title:'Briefing income QA',category:'salary',amount_cents:123456,financial_date:today,recurrence:'none',idempotency_key:randomUUID()},
  {user_id:a.id,kind:'expense',title:'Briefing expense QA',category:'other',amount_cents:3456,financial_date:today,recurrence:'none',idempotency_key:randomUUID()},
 ]))
 ok(await b.db.from('wealth_entries').insert({user_id:b.id,kind:'income',title:'Foreign briefing income',category:'salary',amount_cents:999999,financial_date:today,recurrence:'none',idempotency_key:randomUUID()}))
 ok(await a.db.from('wealth_goals').insert({user_id:a.id,title:'Briefing goal QA',target_cents:10000,saved_cents:2500,monthly_contribution_cents:500,target_date:plus7,currency:'BRL',idempotency_key:randomUUID(),status:'active'}))

 const debt=async(title,due,minimum,balance)=>ok(await a.db.rpc('save_wealth_debt',{p_input:{
  title,principal_cents:String(balance),monthly_rate_bps:'0',minimum_cents:String(minimum),installment_count:null,remaining_installments:null,
  next_due_date:due,priority:'1',balance_cents:String(balance),financial_date:today,idempotency_key:randomUUID(),confirmed:'yes'
 },p_entry_id:null,p_version:null}))
 await debt('Briefing overdue debt',yesterday,700,5000)
 await debt('Briefing tomorrow debt',tomorrow,900,6000)

 ok(await a.db.rpc('manage_wealth_protection',{p_operation:'save',p_input:{
  confirmed:'yes',idempotency_key:randomUUID(),title:'Briefing protection QA',category:'other',insurer:'',reference:'',
  coverage_cents:null,deductible_cents:null,premium_cents:null,premium_period:'unknown',starts_on:today,ends_on:plus10,status:'declared',notes:'Hosted briefing QA'
 }}))

 const portfolio=await rpc(a,'create',{name:'Briefing Portfolio QA',kind:'real'})
 const holding=await rpc(a,'holding',{portfolio_id:portfolio,title:'Briefing position QA',instrument:'QA-BRIEF',quantity:'10',cost_basis_cents:null,amount_cents:'1000',financial_date:today,position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Hosted briefing QA',issuer:'',sector:'',exposure_currency:'BRL',maturity:tomorrow})
 const state=()=>a.db.from('wealth_entries').select('version,amount_cents,valuation_status').eq('id',holding).single().then(ok)
 await rpc(a,'transaction',{holding_id:holding,version:(await state()).version,type:'sell',quantity:'1',amount_cents:'450',financial_date:today,reference:'Briefing incomplete sale QA'})

 const read=(u,mode)=>u.db.rpc('wealth_daily_briefing',{p_mode:mode,p_local_date:today})
 let morning=ok(await read(a,'morning'))
 assert.equal(morning.date,today);assert.equal(morning.timezone,'America/Sao_Paulo')
 assert.equal(morning.stats.today_income,'123456');assert.equal(morning.stats.today_expenses,'3456');assert.equal(morning.stats.today_cash_flow,'120000')
 assert.equal(morning.stats.overdue_debts,'1');assert.equal(morning.stats.next7_debts,'1');assert.equal(morning.stats.active_goals,'1')
 assert.equal(morning.stats.unknown_valuations,'1');assert.equal(morning.stats.tax_gaps,'1');assert.equal(morning.stats.tomorrow_items,'2')
 assert.equal(morning.bank_provider_status,'NOT_CONFIGURED');assert.equal(morning.market_provider_status,'NOT_CONFIGURED')
 assert.ok(morning.items.some(x=>x.source==='goal'));assert.ok(morning.items.some(x=>x.source==='shield'));assert.ok(morning.items.some(x=>x.source==='portfolio'));assert.ok(morning.items.some(x=>x.source==='tax'))
 const night=ok(await read(a,'night'))
 assert.ok(night.items.some(x=>x.source==='cash'&&x.kind==='today'))
 assert.ok(night.items.some(x=>x.source==='portfolio'&&x.kind==='today'))
 assert.ok(night.items.some(x=>x.source==='tomorrow'&&x.event_date===tomorrow))
 assert.ok(!JSON.stringify(morning).includes('999999'))
 assert.equal(ok(await read(b,'morning')).stats.today_income,'999999')
 assert.ok((await read(no,'morning')).error)
 pass('briefing-deterministic-owner-facts-morning-night-exact-cents-and-provider-boundaries')

 for(const mode of ['write','revoked','expired']){
  await setAccess(mode);assert.ok((await read(a,'morning')).error)
 }
 await setAccess('read');assert.equal(ok(await read(a,'morning')).stats.today_cash_flow,'120000')
 await setAccess('full')
 pass('briefing-entitlement-rechecked-on-every-read')

 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true})
 const makeContext=()=>browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 const authorizePreview=async context=>{
  const prime=await context.request.get(`${appUrl}/?_vercel_share=${encodeURIComponent(previewShare)}`)
  assert.ok(prime.ok(),`Preview share bootstrap failed: ${prime.status()}`)
 }
 const context=await makeContext()
 await authorizePreview(context)
 const page=await context.newPage();page.setDefaultTimeout(45000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await context.route('**://ozrasuktfthsvbqprtel.supabase.co/**',route=>{errors.push('production-request');return route.abort()})
 const buildResponse=await context.request.get(`${appUrl}/api/internal/preview-build`)
 assert.equal(buildResponse.status(),200,`Preview build endpoint failed: ${buildResponse.status()}`)
 assert.match(buildResponse.headers()['content-type']||'',/application\/json/)
 const build=await buildResponse.json();assert.equal(build.environment,'preview');assert.equal(build.commit,expectedCommit)

 const login=async(user,next)=>{
  const target=new URL(next,appUrl),relative=`${target.pathname}${target.search}`
  await page.goto(`${appUrl}/login?next=${encodeURIComponent(relative)}`)
  await page.locator('input[name=email]').fill(user.email)
  await page.locator('input[name=password]').fill(user.password)
  await page.getByRole('button',{name:'Entrar no painel',exact:true}).click()
  await page.waitForURL(url=>url.pathname===target.pathname,{timeout:45000})
 }
 const morningUrl=`${appUrl}/apps/wealth/briefing?mode=morning`
 await login(a,morningUrl)
 await page.getByRole('heading',{name:'Wealth Morning',exact:true}).waitFor()
 let body=await page.locator('body').innerText()
 for(const expected of ['Observe.','Entenda.','Aja.','1.200,00','NOT_CONFIGURED']) assert.ok(body.includes(expected),expected)
 assert.ok(body.includes('1 dívida(s) aberta')||body.includes('2 dívida(s) aberta')||body.includes('2 dívida(s)'))
 assert.deepEqual(errors,[])
 pass('briefing-protected-preview-exact-commit-authenticated-morning-render')

 await page.getByRole('link',{name:'Night',exact:true}).click()
 await page.getByRole('heading',{name:'Wealth Night',exact:true}).waitFor()
 body=await page.locator('body').innerText()
 assert.ok(body.includes('Movimentos de carteira registrados hoje'))
 assert.ok(body.includes('Amanhã já tem compromissos declarados'))
 assert.ok(body.includes('Observe.'));assert.ok(body.includes('Entenda.'));assert.ok(body.includes('Aja.'))
 pass('briefing-night-day-changes-tomorrow-and-explainable-actions')

 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'})
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${scheme}`)
   if(width===320||width===1440){
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
   }
   await page.screenshot({path:`${output}/briefing-${scheme}-${width}.png`,fullPage:true})
  }
 }
 const nav=page.getByRole('navigation',{name:'Wealth Briefing'})
 await nav.getByRole('link').first().focus();await page.keyboard.press('Tab')
 assert.equal(await nav.getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 pass('briefing-six-widths-two-themes-Axe-keyboard-focus-reduced-motion-no-overflow')

 const otherContext=await makeContext();await authorizePreview(otherContext);const otherPage=await otherContext.newPage()
 const target=new URL(morningUrl)
 await otherPage.goto(`${appUrl}/login?next=${encodeURIComponent(`${target.pathname}${target.search}`)}`)
 await otherPage.locator('input[name=email]').fill(b.email);await otherPage.locator('input[name=password]').fill(b.password)
 await otherPage.getByRole('button',{name:'Entrar no painel',exact:true}).click()
 await otherPage.getByRole('heading',{name:'Wealth Morning',exact:true}).waitFor()
 const otherBody=await otherPage.locator('body').innerText()
 assert.ok(!otherBody.includes('1.200,00'));assert.ok(!otherBody.includes('Vendas com evidência fiscal incompleta'))
 const anonymousContext=await makeContext();await authorizePreview(anonymousContext)
 const anon=await anonymousContext.request.get(morningUrl,{maxRedirects:0})
 assert.ok([303,307].includes(anon.status()));assert.ok(String(anon.headers().location||'').includes('/login'))
 await anonymousContext.close();await otherContext.close()
 pass('briefing-cross-user-UI-and-anonymous-redirect')

 await context.close()
 await Promise.all([a.db.auth.signOut(),b.db.auth.signOut(),no.db.auth.signOut()])
 await fs.writeFile(`${output}/report.json`,JSON.stringify({commit:expectedCommit,appUrl,date:today,report,errors,finishedAt:new Date().toISOString()},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(r=>r.status!=='PASS').length,errors},null,2))
}catch(error){
 await fs.writeFile(`${output}/failure.txt`,String(error?.stack??error))
 throw error
}finally{
 await browser?.close().catch(()=>{})
}
