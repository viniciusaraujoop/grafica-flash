import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { startTestGateway } from './helpers/ecosystem-test-gateway.mjs'
import { ids } from './helpers/ecosystem-test-db.mjs'

const publicUrl=process.env.ECOSYSTEM_QA_URL||'http://127.0.0.1:4173'
const artifactDir='.local-qa/ecosystem-browser'
await mkdir(artifactDir,{recursive:true})
const browser=await chromium.launch({channel:process.env.ECOSYSTEM_BROWSER_CHANNEL||'chrome',headless:true})
const report=[]
const consoleErrors=[]
let fixture,app
try {
  for(const width of [320,390,768,1440,1920]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'})
    const page=await context.newPage()
    page.on('pageerror',error=>consoleErrors.push(error.message))
    const response=await page.goto(publicUrl,{waitUntil:'networkidle'})
    assert.equal(response.status(),200)
    await page.getByRole('heading',{level:1,name:'Um Orçaly. Várias possibilidades.'}).waitFor()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`Overflow ${width}`)
    assert.equal(await page.locator('a[href="/produtos/wealth"]').count()>0,true)
    for (const img of await page.locator('img').all()) await img.scrollIntoViewIfNeeded()
    await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete && image.naturalWidth>0))
    await page.evaluate(()=>window.scrollTo(0,0))
    await page.screenshot({path:`${artifactDir}/home-${width}.png`,fullPage:true})
    report.push({check:`public-home-${width}`,status:'PASS'})
    if(width===1440){
      const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
      assert.deepEqual(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
      report.push({check:'home-WCAG-A-AA-axe',status:'PASS'})
      await page.getByRole('link',{name:'Quero organizar meu patrimônio',exact:true}).click()
      await page.getByRole('heading',{level:1,name:'Mais clareza para as escolhas que constroem seu futuro.'}).waitFor()
      await page.goto(`${publicUrl}/produtos/life`);assert.equal(await page.title().then(title=>/404|não encontrado/i.test(title)),true)
      await page.goto(`${publicUrl}/apps/wealth`);assert.ok(page.url().includes('/login'))
      await page.goto(`${publicUrl}/business`);await page.getByRole('heading',{level:1}).waitFor()
      assert.ok((await page.locator('body').innerText()).includes('49,90'))
      report.push({check:'product-discovery-business-pricing-private-redirect-invalid-product',status:'PASS'})
    }
    await context.close()
  }
  fixture=await startTestGateway()
  let appLog=''
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4174'],{
    windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only-anon',SUPABASE_SERVICE_ROLE_KEY:'test-only-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:4174',ORCALY_WEALTH_ENABLED:'true'},stdio:['ignore','pipe','pipe']
  })
  app.stdout.on('data',chunk=>{appLog+=chunk});app.stderr.on('data',chunk=>{appLog+=chunk})
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Fixture application did not start')),60000);app.stdout.on('data',chunk=>{if(String(chunk).includes('Ready')){clearTimeout(timer);resolve()}});app.on('error',reject)})
  async function contextFor(label){
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
    const session=fixture.session(label)
    await context.addCookies([{name:'sb-127-auth-token',value:`base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,domain:'127.0.0.1',path:'/',sameSite:'Lax'}])
    return context
  }
  const context=await contextFor('a')
  const page=await context.newPage()
  page.on('pageerror',error=>consoleErrors.push(error.message))
  await page.goto('http://127.0.0.1:4174/apps/wealth',{waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Seu dinheiro. Suas possibilidades.'}).waitFor()
  const wealthA11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
  assert.deepEqual(wealthA11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  report.push({check:'wealth-WCAG-A-AA-axe',status:'PASS'})
  report.push({check:'authenticated-wealth-loaded-with-postgres-RLS',status:'PASS'})
  const profile=page.locator('form').filter({has:page.getByLabel('Renda mensal declarada (R$)')})
  await profile.getByLabel('Renda mensal declarada (R$)').fill('5000,00')
  await profile.getByLabel('Orçamento mensal (R$)').fill('2500,00')
  await profile.getByRole('button',{name:'Salvar no meu Wealth'}).click()
  await profile.getByRole('status').filter({hasText:'Registro salvo'}).waitFor()
  const entry=page.locator('form').filter({has:page.getByLabel('Nome do lançamento')})
  await entry.getByLabel('Nome do lançamento').fill('Receita pessoal de teste')
  await entry.getByLabel('Valor (R$)',{exact:true}).fill('499,90')
  await entry.getByRole('button',{name:'Salvar no meu Wealth'}).click()
  await entry.getByRole('status').filter({hasText:'Registro salvo'}).waitFor()
  await page.getByRole('cell',{name:'Receita pessoal de teste',exact:true}).waitFor()
  const goal=page.locator('form').filter({has:page.getByLabel('Nome da meta')})
  await goal.getByLabel('Nome da meta').fill('Reserva de teste')
  await goal.getByLabel('Objetivo (R$)',{exact:true}).fill('10000')
  await goal.getByLabel('Aporte mensal planejado (R$)').fill('500')
  await goal.getByLabel('Data desejada').fill('2027-09-26')
  await goal.getByRole('button',{name:'Salvar no meu Wealth'}).click()
  await goal.getByRole('status').filter({hasText:'Registro salvo'}).waitFor()
  await page.getByRole('cell',{name:'Reserva de teste',exact:true}).waitFor()
  await page.getByRole('button',{name:'Calcular cenário'}).click()
  await page.getByText(/Valor no cenário: R\$\s*1\.200,00/).waitFor()
  const persisted=await fixture.inspect('select amount_cents from public.wealth_entries where user_id=$1',[ids.a])
  assert.equal(Number(persisted.rows[0].amount_cents),49990)
  assert.equal((await fixture.inspect('select * from public.wealth_goals where user_id=$1',[ids.a])).rows.length,1)
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('cell',{name:'Receita pessoal de teste',exact:true}).waitFor()
  await page.screenshot({path:`${artifactDir}/wealth-personal.png`,fullPage:true})
  report.push({check:'profile-budget-entry-goal-simulation-reload-persistence',status:'PASS'})
  const other=await contextFor('b');const otherPage=await other.newPage()
  await otherPage.goto('http://127.0.0.1:4174/apps/wealth',{waitUntil:'networkidle'})
  assert.equal(await otherPage.getByText('Receita pessoal de teste',{exact:true}).count(),0)
  const denied=await contextFor('member');const deniedPage=await denied.newPage()
  await deniedPage.goto('http://127.0.0.1:4174/apps/wealth',{waitUntil:'networkidle'})
  await deniedPage.getByText(/ainda não está liberado/).waitFor()
  assert.equal(await deniedPage.getByLabel('Nome do lançamento').count(),0)
  await page.goto('http://127.0.0.1:4174/',{waitUntil:'networkidle'});assert.ok(page.url().endsWith('/apps'))
  report.push({check:'cross-user-privacy-unentitled-denial-authenticated-home-hub',status:'PASS'})
  await Promise.all([context.close(),other.close(),denied.close()])
  await writeFile(`${artifactDir}/fixture-app.log`,appLog)
  assert.deepEqual(consoleErrors,[])
} catch(error){report.push({check:'execution',status:'FAIL',message:error.message});throw error}
finally{
  await browser.close()
  if(app){app.kill();await new Promise(resolve=>{app.once('exit',resolve);setTimeout(resolve,5000)})}
  await fixture?.close()
  await writeFile(`${artifactDir}/report.json`,JSON.stringify({report,consoleErrors,limits:['Auth/PostgREST protocol fixture; hosted Supabase Auth is not certified','No production database changes or test accounts created']},null,2))
  console.log(JSON.stringify(report,null,2))
}
