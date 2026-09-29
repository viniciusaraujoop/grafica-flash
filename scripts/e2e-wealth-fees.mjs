import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthFees({page,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output}){
 await grant(a,active);await grant(b,active)
 const rpc=async(u,op,v)=>ok(await u.db.rpc('manage_wealth_portfolio',{p_operation:op,p_input:{confirmed:'yes',idempotency_key:randomUUID(),...v}}))
 const p=await rpc(a,'create',{name:'Fee Analyzer QA',kind:'real'}),foreign=await rpc(b,'create',{name:'Custos privados B',kind:'real'}),lab=await rpc(a,'create',{name:'Hipóteses Fee QA',kind:'lab'})
 const h=await rpc(a,'holding',{portfolio_id:p,title:'Posição Fee QA',instrument:'QA-FEES',quantity:'1',cost_basis_cents:'100',amount_cents:'100',financial_date:'2024-02-01',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Synthetic only'})
 const e=()=>a.db.from('wealth_entries').select('version,amount_cents').eq('id',h).single().then(ok)
 const read=(u,extra={})=>u.db.rpc('wealth_fee_analysis',{p_from:'2024-02-01',p_to:'2024-02-29',p_portfolio:p,...extra})
 const original=await e(),cashBefore=ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length
 await page.goto(`${appUrl}/apps/wealth/carteiras/${p}?holding=${h}`);await page.locator('summary').filter({hasText:/^Registrar movimento$/}).click()
 const movement=page.getByRole('form',{name:'Registrar movimento',exact:true});await movement.getByLabel('Tipo de movimento').selectOption('fee');await movement.getByLabel('Valor do movimento (R$)').fill('16,79');await movement.getByLabel('Data do movimento').fill('2024-02-29');await movement.getByLabel('Referência do movimento').fill('Tarifa sintética do extrato QA');await movement.getByRole('checkbox').check();await movement.getByRole('button').click();await movement.getByRole('status').filter({hasText:'Registro confirmado'}).waitFor()
 for(const [type,amount_cents,financial_date] of [['tax','29','2024-02-01'],['fee','11','2024-01-03']])await rpc(a,'transaction',{holding_id:h,version:(await e()).version,type,quantity:'0',amount_cents,financial_date,reference:'Referência sintética Fee QA'})
 let v=ok(await read(a));assert.equal(v.fees,'1679','Recorded fee must remain 1679 cents');assert.equal(v.taxes,'29','Tax must stay separate at 29 cents');assert.equal(v.previous.fees,'11','Prior equal-length window should contain 11 cents');assert.equal((await e()).amount_cents,original.amount_cents,'Fee must not change asset value');assert.equal(ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length,cashBefore,'Fee must not create another cash entry')
 await rpc(a,'archive',{holding_id:h,version:(await e()).version});assert.ok(ok(await read(a)).records.every(r=>r.archived))
 const url=`${appUrl}/apps/wealth/tarifas?from=2024-02-01&to=2024-02-29&portfolio=${p}`
 await page.goto(url);await page.getByRole('heading',{name:'Fee Analyzer',exact:true}).waitFor();assert.match(await page.locator('[data-fee-total]').innerText(),/16,79/);assert.match(await page.locator('[data-tax-total]').innerText(),/0,29/);assert.ok((await page.locator('body').innerText()).includes('posição arquivada'))
 await page.getByRole('link',{name:'Revisar carteira de origem',exact:true}).first().click();await page.waitForURL(u=>u.pathname===`/apps/wealth/carteiras/${p}`);assert.equal(new URL(page.url()).pathname,`/apps/wealth/carteiras/${p}`)
 pass('fees-original-Portfolio-Server-Action-exact-costs-tax-separation-archived-history-and-no-second-balance')
 assert.equal((await read(b)).error.code,'42501');assert.equal((await read(no)).error.code,'42501');assert.equal(ok(await read(b,{p_portfolio:null})).record_count,'0');assert.ok((await read(a,{p_portfolio:foreign})).error)
 for(const patch of [{...active,permissions:['wealth.write']},{...active,status:'revoked'},{...active,starts_at:'2020-01-01T00:00:00Z',expires_at:'2021-01-01T00:00:00Z'}]){await grant(a,patch);assert.ok((await read(a)).error);await page.goto(url);assert.equal(await page.locator('[data-fee-total]').count(),0)}
 await grant(a,{...active,permissions:['wealth.read']});assert.equal(ok(await read(a)).fees,'1679');await page.goto(url);assert.match(await page.locator('[data-fee-total]').innerText(),/16,79/);await grant(a,active)
 await other.page.goto(url);await other.page.getByText('A carteira não está disponível para esta conta.',{exact:true}).waitFor();assert.equal(await other.page.getByText('Tarifa sintética do extrato QA',{exact:false}).count(),0)
 const anon=await anonymous.request.get(url,{maxRedirects:0});assert.ok([303,307].includes(anon.status()));assert.ok(anon.headers().location.includes('/login'))
 pass('fees-hosted-RLS-cross-user-scope-read-only-write-only-expired-revoked-and-anonymous-server-denial')
 await page.goto(`${appUrl}/apps/wealth/tarifas?portfolio=${lab}&from=2024-02-01&to=2024-02-29`);await page.getByText('Esta carteira é um cenário do Portfolio Lab.',{exact:false}).waitFor();assert.equal(ok(await read(a,{p_portfolio:lab})).portfolio_count,'0')
 await page.goto(`${appUrl}/apps/wealth/tarifas?portfolio=${p}&from=1900-01-01&to=1900-01-31`);await page.getByText('Nenhum custo registrado neste período.',{exact:false}).waitFor();assert.ok((await page.locator('body').innerText()).includes('comparação completa ultrapassa'))
 await page.goto(`${appUrl}/apps/wealth/tarifas?from=2024-01-01&to=2025-01-01`);await page.getByRole('heading',{name:'Revise os filtros'}).waitFor()
 ok(await admin.from('wealth_portfolio_transactions').insert(Array.from({length:27},()=>({user_id:a.id,holding_id:h,type:'fee',quantity:0,amount_cents:100000000000000,financial_date:'2050-01-01',reference:'Synthetic pagination only',position_before:{},position_after:{}}))))
 v=ok(await read(a,{p_from:'2050-01-01',p_to:'2050-01-01'}));assert.equal(v.fees,'2700000000000000');assert.equal(v.records.length,25)
 await page.goto(`${appUrl}/apps/wealth/tarifas?portfolio=${p}&from=2050-01-01&to=2050-01-01`);await page.getByRole('link',{name:'Próxima página',exact:true}).click();await page.getByText('27 evento(s) · página 2',{exact:false}).waitFor();assert.equal(await page.locator('[data-fee-record]').count(),2,'Second page must contain 2 cost records')
 pass('fees-Lab-empty-lower-bound-invalid-period-hosted-pagination-and-full-aggregate')
 await page.goto(url)
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Fee overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
  await page.screenshot({path:`${output}/fees-${colorScheme}-${width}.png`,fullPage:true})
 }}
 await page.getByRole('navigation',{name:'Custos Wealth'}).getByRole('link').first().focus();await page.keyboard.press('Tab');assert.equal(await page.getByRole('navigation',{name:'Custos Wealth'}).getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 await page.getByLabel('Data inicial',{exact:true}).fill('2024-01-03');await page.getByLabel('Data final',{exact:true}).fill('2024-01-31');await page.getByRole('button',{name:'Analisar período'}).click();assert.match(await page.locator('[data-fee-total]').innerText(),/0,11/)
 pass('fees-six-widths-two-themes-Axe-keyboard-focus-reduced-motion-and-interactive-period-filter')
}
