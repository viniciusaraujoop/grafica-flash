import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'

export async function testWealthTax({page,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output}){
 await grant(a,active);await grant(b,active)
 const rpc=async(u,op,v)=>ok(await u.db.rpc('manage_wealth_portfolio',{p_operation:op,p_input:{confirmed:'yes',idempotency_key:randomUUID(),...v}}))
 const portfolio=await rpc(a,'create',{name:'Tax Center QA',kind:'real'})
 const foreign=await rpc(b,'create',{name:'Fiscal privado B',kind:'real'})
 const lab=await rpc(a,'create',{name:'Cenário Tax QA',kind:'lab'})
 const holding=await rpc(a,'holding',{portfolio_id:portfolio,title:'Posição Tax QA',instrument:'QA-TAX',quantity:'10',cost_basis_cents:'1000',amount_cents:'1000',financial_date:'2026-09-01',position_class:'stock',liquidity:'short_term',valuation_status:'MANUAL_VALUE',valuation_source:'Synthetic only'})
 const state=()=>a.db.from('wealth_entries').select('version,amount_cents').eq('id',holding).single().then(ok)
 const tx=async(type,amount_cents,quantity='0',reference=type,financial_date='2026-09-26')=>rpc(a,'transaction',{holding_id:holding,version:(await state()).version,type,quantity,amount_cents,financial_date,reference})
 const read=(u,extra={})=>u.db.rpc('wealth_tax_center',{p_from:'2026-09-01',p_to:'2026-09-30',p_page:1,p_portfolio:portfolio,...extra})
 const original=await state(),cashBefore=ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length
 await tx('sell','450','3','Venda sintética Tax QA')
 await tx('income','100','0','Rendimento sintético Tax QA')
 await tx('dividend','200','0','Dividendo sintético Tax QA')
 await tx('interest','50','0','Juros sintéticos Tax QA')
 await tx('tax','29','0','Imposto sintético Tax QA')
 let v=ok(await read(a))
 assert.equal(v.taxes,'29');assert.equal(v.income,'350');assert.equal(v.sell_proceeds,'450');assert.equal(v.basis_removed,'300');assert.equal(v.realized_gain,'150')
 assert.equal(v.complete_sell_count,'1');assert.equal(v.incomplete_sell_count,'0');assert.equal(v.coverage,'DECLARED_LEDGER_ONLY')
 assert.equal(v.tax_provider_status,'NOT_CONFIGURED');assert.equal(v.tax_rules_status,'NOT_CONFIGURED');assert.equal(v.jurisdiction_status,'UNSPECIFIED');assert.equal(v.filing_status,'NOT_CONFIGURED')
 assert.equal((await state()).amount_cents,original.amount_cents,'Tax events must not mutate the asset value')
 assert.equal(ok(await a.db.from('wealth_entries').select('id').in('kind',['income','expense'])).length,cashBefore,'Tax Center must not create another cash ledger')
 await rpc(a,'archive',{holding_id:holding,version:(await state()).version});assert.ok(ok(await read(a)).records.every(r=>r.archived))
 const url=`${appUrl}/apps/wealth/impostos?from=2026-09-01&to=2026-09-30&portfolio=${portfolio}`
 await page.goto(url);await page.getByRole('heading',{name:'Tax Center',exact:true}).waitFor()
 assert.match(await page.locator('[data-tax-total]').innerText(),/0,29/)
 assert.match(await page.locator('[data-income-total]').innerText(),/3,50/)
 assert.match(await page.locator('[data-sell-total]').innerText(),/4,50/)
 assert.match(await page.locator('[data-realized-total]').innerText(),/1,50/)
 const body=await page.locator('body').innerText();assert.ok(body.includes('posição arquivada'));assert.ok(body.includes('não calcula DARF'));assert.ok(body.includes('NOT_CONFIGURED'))
 await page.getByRole('link',{name:'Conferir no ledger',exact:true}).first().click();await page.waitForURL(u=>u.pathname===`/apps/wealth/carteiras/${portfolio}`)
 pass('tax-original-Portfolio-ledger-exact-declared-basis-gain-income-archive-and-no-second-balance')

 assert.equal((await read(b)).error.code,'42501');assert.equal((await read(no)).error.code,'42501');assert.equal(ok(await read(b,{p_portfolio:null})).record_count,'0');assert.ok((await read(a,{p_portfolio:foreign})).error)
 for(const patch of [{...active,permissions:['wealth.write']},{...active,status:'revoked'},{...active,starts_at:'2020-01-01T00:00:00Z',expires_at:'2021-01-01T00:00:00Z'}]){
  await grant(a,patch);assert.ok((await read(a)).error);await page.goto(url);assert.equal(await page.locator('[data-tax-total]').count(),0)
 }
 await grant(a,{...active,permissions:['wealth.read']});assert.equal(ok(await read(a)).taxes,'29');await page.goto(url);assert.match(await page.locator('[data-tax-total]').innerText(),/0,29/);await grant(a,active)
 await other.page.goto(url);await other.page.getByText('A carteira não está disponível para esta conta.',{exact:true}).waitFor();assert.equal(await other.page.getByText('Imposto sintético Tax QA',{exact:false}).count(),0)
 const anon=await anonymous.request.get(url,{maxRedirects:0});assert.ok([303,307].includes(anon.status()));assert.ok(anon.headers().location.includes('/login'))
 pass('tax-hosted-RLS-cross-user-scope-read-only-write-only-expired-revoked-and-anonymous-server-denial')

 await page.goto(`${appUrl}/apps/wealth/impostos?portfolio=${lab}&from=2026-09-01&to=2026-09-30`);await page.getByText('A carteira selecionada é um cenário do Portfolio Lab.',{exact:false}).waitFor();assert.equal(ok(await read(a,{p_portfolio:lab})).record_count,'0')
 await page.goto(`${appUrl}/apps/wealth/impostos?portfolio=${portfolio}&from=1900-01-01&to=1900-01-31`);await page.getByText('Nenhum evento relevante registrado no período.',{exact:true}).waitFor()
 await page.goto(`${appUrl}/apps/wealth/impostos?from=2024-01-01&to=2025-01-01`);await page.getByRole('heading',{name:'Revise os filtros'}).waitFor()
 ok(await admin.from('wealth_portfolio_transactions').insert({user_id:a.id,holding_id:holding,type:'sell',quantity:0,amount_cents:700,basis_removed_cents:null,realized_gain_cents:null,financial_date:'2026-09-20',reference:'Venda importada incompleta QA',position_before:{},position_after:{}}))
 v=ok(await read(a));assert.equal(v.sell_count,'2');assert.equal(v.complete_sell_count,'1');assert.equal(v.incomplete_sell_count,'1');assert.equal(v.basis_removed,'300');assert.equal(v.realized_gain,'150')
 ok(await admin.from('wealth_portfolio_transactions').insert(Array.from({length:27},()=>({user_id:a.id,holding_id:holding,type:'tax',quantity:0,amount_cents:100000000000000,financial_date:'2050-01-01',reference:'Tax pagination synthetic',position_before:{},position_after:{}}))))
 v=ok(await read(a,{p_from:'2050-01-01',p_to:'2050-01-01'}));assert.equal(v.taxes,'2700000000000000');assert.equal(v.records.length,25)
 await page.goto(`${appUrl}/apps/wealth/impostos?portfolio=${portfolio}&from=2050-01-01&to=2050-01-01`);await page.getByRole('link',{name:'Próxima página',exact:true}).click();await page.getByText('Página 2 · até 25 eventos',{exact:false}).waitFor();assert.equal(await page.locator('[data-tax-record]').count(),2)
 pass('tax-Lab-empty-invalid-period-incomplete-sale-hosted-pagination-and-full-aggregate')

 await page.goto(url)
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Tax overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
  await page.screenshot({path:`${output}/tax-${colorScheme}-${width}.png`,fullPage:true})
 }}
 const nav=page.getByRole('navigation',{name:'Tax Center Wealth'});await nav.getByRole('link').first().focus();await page.keyboard.press('Tab');assert.equal(await nav.getByRole('link').nth(1).evaluate(n=>n===document.activeElement),true)
 await page.getByLabel('Data inicial',{exact:true}).fill('2050-01-01');await page.getByLabel('Data final',{exact:true}).fill('2050-01-01');await page.getByRole('button',{name:'Revisar período'}).click();assert.match(await page.locator('[data-tax-total]').innerText(),/27\.000\.000\.000\.000,00/)
 pass('tax-six-widths-two-themes-Axe-keyboard-focus-reduced-motion-and-interactive-period-filter')
}
