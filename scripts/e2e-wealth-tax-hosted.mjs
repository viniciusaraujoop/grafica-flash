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
const output='artifacts/wealth-tax'
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
const rpc=async(u,op,v)=>ok(await u.db.rpc('manage_wealth_portfolio',{p_operation:op,p_input:{confirmed:'yes',idempotency_key:randomUUID(),...v}}))
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
 pass('staging-auth-real-password-and-JWT-issuer')

 const portfolio=await rpc(a,'create',{name:'Tax Hosted QA',kind:'real'})
 const foreign=await rpc(b,'create',{name:'Tax Private B',kind:'real'})
 const lab=await rpc(a,'create',{name:'Tax Lab QA',kind:'lab'})
 const holding=await rpc(a,'holding',{portfolio_id:portfolio,title:'Tax Position QA',instrument:'QA-TAX',quantity:'10',cost_basis_cents:'1000',amount_cents:'1000',financial_date:'2026-09-01',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Hosted QA'})
 const state=()=>a.db.from('wealth_entries').select('version,amount_cents,valuation_status').eq('id',holding).single().then(ok)
 const cashBefore=ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length
 const tx=async(type,amount_cents,quantity='0',reference=type)=>rpc(a,'transaction',{holding_id:holding,version:(await state()).version,type,quantity,amount_cents,financial_date:'2026-09-26',reference})
 await tx('sell','450','3','Hosted sale')
 const afterSale=await state()
 assert.equal(afterSale.valuation_status,'NOT_AVAILABLE')
 await tx('income','100','0','Hosted income')
 await tx('dividend','200','0','Hosted dividend')
 await tx('interest','50','0','Hosted interest')
 await tx('tax','29','0','Hosted tax')
 const read=(u,extra={})=>u.db.rpc('wealth_tax_center',{p_from:'2026-09-01',p_to:'2026-09-30',p_page:1,p_portfolio:portfolio,...extra})
 let model=ok(await read(a))
 assert.equal(model.taxes,'29');assert.equal(model.income,'350');assert.equal(model.sell_proceeds,'450');assert.equal(model.basis_removed,'300');assert.equal(model.realized_gain,'150')
 assert.equal(model.tax_rules_status,'NOT_CONFIGURED');assert.equal(model.tax_provider_status,'NOT_CONFIGURED');assert.equal(model.jurisdiction_status,'UNSPECIFIED');assert.equal(model.filing_status,'NOT_CONFIGURED')
 const afterCashFacts=await state()
 assert.equal(afterCashFacts.amount_cents,afterSale.amount_cents)
 assert.equal(afterCashFacts.valuation_status,afterSale.valuation_status)
 assert.equal(ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length,cashBefore)
 await rpc(a,'archive',{holding_id:holding,version:(await state()).version})
 assert.ok(ok(await read(a)).records.every(r=>r.archived))
 pass('tax-ledger-exact-declared-facts-and-no-second-cash')

 assert.equal((await read(b)).error.code,'42501')
 assert.equal((await read(no)).error.code,'42501')
 assert.equal(ok(await read(b,{p_portfolio:null})).record_count,'0')
 assert.ok((await read(a,{p_portfolio:foreign})).error)
 for(const mode of ['write','revoked','expired']){
  await setAccess(mode);assert.ok((await read(a)).error)
 }
 await setAccess('read');assert.equal(ok(await read(a)).taxes,'29')
 await setAccess('full')
 pass('tax-RLS-owner-and-entitlement-boundaries')

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
 const build=await buildResponse.json()
 assert.equal(build.environment,'preview');assert.equal(build.commit,expectedCommit)
 const login=async(user,next)=>{
  await page.goto(`${appUrl}/login?next=${encodeURIComponent(next)}`)
  await page.locator('input[name=email]').fill(user.email)
  await page.locator('input[name=password]').fill(user.password)
  await page.getByRole('button',{name:'Entrar no painel',exact:true}).click()
  await page.waitForURL(url=>url.pathname===new URL(next,appUrl).pathname,{timeout:45000})
 }
 const url=`${appUrl}/apps/wealth/impostos?from=2026-09-01&to=2026-09-30&portfolio=${portfolio}`
 await login(a,url)
 await page.getByRole('heading',{name:'Tax Center',exact:true}).waitFor()
 assert.match(await page.locator('[data-tax-total]').innerText(),/0,29/)
 assert.match(await page.locator('[data-income-total]').innerText(),/3,50/)
 assert.match(await page.locator('[data-sell-total]').innerText(),/4,50/)
 assert.match(await page.locator('[data-realized-total]').innerText(),/1,50/)
 const body=await page.locator('body').innerText()
 assert.ok(body.includes('não calcula DARF'));assert.ok(body.includes('NOT_CONFIGURED'));assert.ok(body.includes('posição arquivada'))
 assert.deepEqual(errors,[])
 pass('protected-preview-exact-commit-authenticated-tax-render')

 await page.goto(`${appUrl}/apps/wealth/impostos?from=2026-09-01&to=2026-09-30&portfolio=${lab}`)
 await page.getByText('A carteira selecionada é um cenário do Portfolio Lab.',{exact:false}).waitFor()
 assert.equal(ok(await read(a,{p_portfolio:lab})).record_count,'0')
 await page.goto(`${appUrl}/apps/wealth/impostos?from=2024-01-01&to=2025-01-01`)
 await page.getByRole('heading',{name:'Revise os filtros'}).waitFor()
 await page.goto(url)
 pass('tax-Lab-and-invalid-window-UI-states')

 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'})
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${scheme}`)
   if(width===320||width===1440){
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
    assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
   }
   await page.screenshot({path:`${output}/tax-${scheme}-${width}.png`,fullPage:true})
  }
 }
 const nav=page.getByRole('navigation',{name:'Tax Center Wealth'})
 await nav.getByRole('link').first().focus();await page.keyboard.press('Tab')
 assert.equal(await nav.getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 await page.getByLabel('Data inicial',{exact:true}).fill('2026-09-26')
 await page.getByLabel('Data final',{exact:true}).fill('2026-09-26')
 await page.getByRole('button',{name:'Revisar período'}).click()
 await page.getByRole('heading',{name:'Tax Center',exact:true}).waitFor()
 assert.match(await page.locator('[data-tax-total]').innerText(),/0,29/)
 pass('tax-six-widths-two-themes-Axe-keyboard-reduced-motion-filter')

 const otherContext=await makeContext()
 await authorizePreview(otherContext)
 const otherPage=await otherContext.newPage()
 await otherPage.goto(`${appUrl}/login?next=${encodeURIComponent(url)}`)
 await otherPage.locator('input[name=email]').fill(b.email);await otherPage.locator('input[name=password]').fill(b.password)
 await otherPage.getByRole('button',{name:'Entrar no painel',exact:true}).click()
 await otherPage.getByText('A carteira não está disponível para esta conta.',{exact:true}).waitFor()
 assert.equal(await otherPage.getByText('Hosted tax',{exact:false}).count(),0)
 const anonymousContext=await makeContext()
 await authorizePreview(anonymousContext)
 const anon=await anonymousContext.request.get(url,{maxRedirects:0})
 assert.ok([303,307].includes(anon.status()))
 assert.ok(String(anon.headers().location||'').includes('/login'))
 await anonymousContext.close()
 await otherContext.close()
 pass('tax-cross-user-UI-and-anonymous-redirect')

 await context.close()
 await Promise.all([a.db.auth.signOut(),b.db.auth.signOut(),no.db.auth.signOut()])
 await fs.writeFile(`${output}/report.json`,JSON.stringify({commit:expectedCommit,appUrl,report,errors,finishedAt:new Date().toISOString()},null,2))
 console.log(JSON.stringify({checks:report.length,failed:report.filter(r=>r.status!=='PASS').length,errors},null,2))
}catch(error){
 await fs.writeFile(`${output}/failure.txt`,String(error?.stack??error))
 throw error
}finally{
 await browser?.close().catch(()=>{})
}
