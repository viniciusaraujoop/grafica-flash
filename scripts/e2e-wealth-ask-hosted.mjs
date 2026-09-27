import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
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
const controlUrl=stagingUrl+'/functions/v1/wealth-rolling-qa-control'
const output='artifacts/wealth-ask'
for(const [name,value] of Object.entries({appUrl,expectedCommit,previewShare,qaToken,anonKey}))if(!value)throw Error('Missing '+name)
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
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const future=(()=>{const d=new Date(today+'T12:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+1);return d.toISOString().slice(0,10)})()
const report=[],pass=check=>{report.push({check,status:'PASS'});console.log('PASS '+check)}
const setAccess=async(mode)=>{
 const response=await fetch(controlUrl,{method:'POST',headers:{authorization:'Bearer '+qaToken,'content-type':'application/json'},body:JSON.stringify({action:'set_access',userId:a.id,mode,sourceCommit:expectedCommit})})
 assert.equal(response.status,200,'set_access '+mode+' failed')
}
let browser

try{
 for(const user of [a,b,no]){
  const session=ok(await user.db.auth.signInWithPassword({email:user.email,password:user.password})).session
  assert.ok(session?.access_token)
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'))
  assert.equal(claims.iss,stagingUrl+'/auth/v1')
  assert.equal(ok(await user.db.auth.getUser()).user.id,user.id)
 }
 pass('ask-staging-auth-real-password-and-JWT-issuer')

 const entry=(user,kind,title,amount,category)=>user.db.from('wealth_entries').insert({
  user_id:user.id,kind,title,category,amount_cents:amount,currency:'BRL',financial_date:today,recurrence:'none',idempotency_key:randomUUID(),
  ...(kind==='asset'?{position_class:'cash',liquidity:'immediate'}:{}),
  ...(kind==='liability'?{position_class:'personal_loan',liquidity:'unknown'}:{})
 })
 ok(await entry(a,'income','Ask A income',500000,'salary'))
 ok(await entry(a,'expense','Ask A expense',200000,'other'))
 ok(await entry(a,'asset','Ask A asset',1000000,'investment'))
 ok(await entry(a,'liability','Ask A liability',250000,'loan'))
 ok(await entry(b,'asset','Ask B foreign asset',9876543,'investment'))
 ok(await a.db.from('wealth_goals').insert({user_id:a.id,title:'Ask Casa QA',target_cents:600000,saved_cents:120000,monthly_contribution_cents:20000,target_date:future,currency:'BRL',idempotency_key:randomUUID(),status:'active'}))
 ok(await b.db.from('wealth_goals').insert({user_id:b.id,title:'Foreign Ask Goal QA',target_cents:9999999,saved_cents:111111,monthly_contribution_cents:22222,target_date:future,currency:'BRL',idempotency_key:randomUUID(),status:'active'}))

 const aNet=ok(await a.db.rpc('wealth_net_worth')),bNet=ok(await b.db.rpc('wealth_net_worth'))
 assert.equal(aNet.netWorth,'750000');assert.equal(bNet.netWorth,'9876543')
 assert.ok(!JSON.stringify(aNet).includes('9876543'));assert.ok(!JSON.stringify(bNet).includes('750000'))
 assert.ok((await no.db.rpc('wealth_net_worth')).error)
 pass('ask-underlying-read-models-owner-isolated-before-AI')

 for(const mode of ['write','revoked','expired']){
  await setAccess(mode);assert.ok((await a.db.rpc('wealth_net_worth')).error)
 }
 await setAccess('read');assert.equal(ok(await a.db.rpc('wealth_net_worth')).netWorth,'750000')
 await setAccess('full')
 pass('ask-entitlement-rechecked-by-source-read-models')

 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true})
 const makeContext=()=>browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 const authorize=async context=>{
  const response=await context.request.get(appUrl+'/?_vercel_share='+encodeURIComponent(previewShare))
  assert.ok(response.ok(),'Preview share bootstrap failed: '+response.status())
 }
 const context=await makeContext();await authorize(context)
 const productionRequests=[]
 await context.route('**://'+prodRef+'.supabase.co/**',route=>{productionRequests.push(route.request().url());return route.abort('blockedbyclient')})
 context.on('request',request=>{if(request.url().includes(prodRef)&&!productionRequests.includes(request.url()))productionRequests.push(request.url())})
 const page=await context.newPage();page.setDefaultTimeout(45000)
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message))
 const build=await context.request.get(appUrl+'/api/internal/preview-build')
 assert.equal(build.status(),200);assert.match(build.headers()['content-type']||'',/application\/json/)
 const buildJson=await build.json();assert.equal(buildJson.environment,'preview');assert.equal(buildJson.commit,expectedCommit)

 const login=async(user,target)=>{
  const url=new URL(target),relative=url.pathname+url.search
  await page.goto(appUrl+'/login?next='+encodeURIComponent(relative))
  await page.locator('input[name=email]').fill(user.email)
  await page.locator('input[name=password]').fill(user.password)
  await page.getByRole('button',{name:'Entrar no painel',exact:true}).click()
  await page.waitForURL(u=>u.pathname===url.pathname,{timeout:45000})
 }
 const askUrl=appUrl+'/apps/wealth/ask'
 await login(a,askUrl)
 await page.getByRole('heading',{name:'Ask Wealth',exact:true}).waitFor()

 async function api(question,mode='analysis'){
  return page.evaluate(async({question,mode})=>{
   const response=await fetch('/api/apps/wealth/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,mode})})
   let body=null;try{body=await response.json()}catch{}
   return {status:response.status,body}
  },{question,mode})
 }
 const net=await api('Como está meu patrimônio?')
 assert.equal(net.status,200);assert.equal(net.body.ok,true);assert.equal(net.body.intent,'net_worth')
 assert.equal(net.body.regulated_advice,'OFF');assert.equal(net.body.execution,'OFF');assert.equal(net.body.cross_product_context,'DISABLED')
 assert.equal(net.body.market_provider_status,'NOT_CONFIGURED');assert.ok(['NOT_CONFIGURED','OPENAI_CONFIGURED','DEGRADED'].includes(net.body.provider_status))
 assert.ok(net.body.sources.every(source=>source.href.startsWith('/apps/wealth/')))
 assert.ok(!JSON.stringify(net.body).includes('Foreign Ask Goal QA'));assert.ok(!JSON.stringify(net.body).includes('9876543'))
 const aContextId=net.body.context_id
 pass('ask-exact-preview-owner-scoped-traceable-response-and-no-cross-product-context')

 const market=await api('Qual o dólar agora?')
 assert.equal(market.status,200);assert.equal(market.body.intent,'market');assert.equal(market.body.market_provider_status,'NOT_CONFIGURED')
 assert.match(market.body.answer,/não possui feed de mercado/i);assert.match(market.body.limitations.join(' '),/NOT_CONFIGURED/)
 const restricted=await api('Qual ativo comprar?','planning')
 assert.equal(restricted.status,200);assert.equal(restricted.body.regulated_advice,'OFF');assert.equal(restricted.body.execution,'OFF')
 assert.match(restricted.body.answer,/aconselhamento individualizado regulado e execução financeira estão desativados/i)
 pass('ask-market-not-configured-and-regulated-execution-boundaries')

 const invalid=await page.evaluate(async()=>{
  const response=await fetch('/api/apps/wealth/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'x',mode:'analysis',sql:'select *'})})
  return {status:response.status,body:await response.json()}
 })
 assert.equal(invalid.status,400)
 const crossOrigin=await context.request.post(askUrl.replace('/apps/wealth/ask','/api/apps/wealth/ask'),{headers:{Origin:'https://evil.example','Content-Type':'application/json'},data:{question:'x',mode:'analysis'}})
 assert.equal(crossOrigin.status(),403)
 pass('ask-client-cannot-supply-SQL-tools-or-cross-origin-context')

 await setAccess('write')
 const denied=await api('Como está meu patrimônio?');assert.equal(denied.status,403)
 await setAccess('full')
 pass('ask-API-entitlement-denial-after-session-established')

 await page.reload();await page.getByRole('heading',{name:'Ask Wealth',exact:true}).waitFor()
 await page.getByLabel('Sua pergunta').fill('Como está meu patrimônio?')
 await page.getByRole('button',{name:'Perguntar ao Wealth'}).click()
 await page.locator('[data-ask-result]').waitFor()
 let body=await page.locator('body').innerText()
 assert.ok(body.includes('Fontes usadas'));assert.ok(body.includes('Regulado'));assert.ok(body.includes('OFF'));assert.ok(body.includes('cross-product = DISABLED'))
 assert.ok(!body.includes('Foreign Ask Goal QA'))
 pass('ask-authenticated-UI-sources-period-limitations-and-boundaries')

 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'})
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+scheme)
   if(width===320||width===1440){
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
   }
   await page.screenshot({path:output+'/ask-'+scheme+'-'+width+'.png',fullPage:true})
  }
 }
 const nav=page.getByRole('navigation',{name:'Ask Wealth'})
 await nav.getByRole('link').first().focus();await page.keyboard.press('Tab')
 assert.equal(await nav.getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 assert.deepEqual(pageErrors,[]);assert.deepEqual(productionRequests,[])
 pass('ask-six-widths-two-themes-Axe-keyboard-focus-reduced-motion-no-overflow-zero-production-calls')

 const other=await makeContext();await authorize(other);const otherPage=await other.newPage()
 const otherTarget=new URL(askUrl)
 await otherPage.goto(appUrl+'/login?next='+encodeURIComponent(otherTarget.pathname))
 await otherPage.locator('input[name=email]').fill(b.email);await otherPage.locator('input[name=password]').fill(b.password)
 await otherPage.getByRole('button',{name:'Entrar no painel',exact:true}).click();await otherPage.getByRole('heading',{name:'Ask Wealth',exact:true}).waitFor()
 const otherResponse=await otherPage.evaluate(async()=>{
  const response=await fetch('/api/apps/wealth/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Como está meu patrimônio?',mode:'analysis'})})
  return {status:response.status,body:await response.json()}
 })
 assert.equal(otherResponse.status,200);assert.notEqual(otherResponse.body.context_id,aContextId)
 assert.ok(!JSON.stringify(otherResponse.body).includes('Ask Casa QA'));assert.ok(!JSON.stringify(otherResponse.body).includes('750000'))
 const anonymous=await makeContext();await authorize(anonymous)
 const anonPage=await anonymous.request.get(askUrl,{maxRedirects:0});assert.ok([303,307].includes(anonPage.status()));assert.ok(String(anonPage.headers().location||'').includes('/login'))
 const anonApi=await anonymous.request.post(appUrl+'/api/apps/wealth/ask',{headers:{'Content-Type':'application/json'},data:{question:'x',mode:'analysis'}});assert.equal(anonApi.status(),403)
 await anonymous.close();await other.close()
 pass('ask-cross-user-context-isolation-no-entitlement-and-anonymous-denial')

 assert.deepEqual(pageErrors,[]);assert.deepEqual(productionRequests,[])
 await context.close()
 await Promise.all([a.db.auth.signOut(),b.db.auth.signOut(),no.db.auth.signOut()])
 await fs.writeFile(output+'/report.json',JSON.stringify({commit:expectedCommit,appUrl,date:today,report,pageErrors,productionRequests,finishedAt:new Date().toISOString()},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(x=>x.status!=='PASS').length,pageErrors,productionRequests},null,2))
}catch(error){
 await fs.writeFile(output+'/failure.txt',String(error?.stack??error))
 throw error
}finally{
 await browser?.close().catch(()=>{})
}
