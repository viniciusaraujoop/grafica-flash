import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'

export async function testWealthHealth({page,other,a,b,appUrl,grant,active,ok,pass,output}){
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 ok(await a.db.rpc('capture_wealth_net_worth',{p_idempotency_key:randomUUID()}))
 const response=ok(await a.db.rpc('wealth_health_inputs')),own=ok(await a.db.rpc('wealth_net_worth'));assert.equal(response.positions.netWorth,own.netWorth)
 const foreign=ok(await b.db.rpc('wealth_health_inputs'));assert.notEqual(foreign.positions.positionCount,own.positionCount)
 await page.goto(`${appUrl}/apps/wealth/saude`)
 for(const name of ['Cobertura de reserva','Comprometimento com dívidas','Taxa de poupança registrada','Superávit mensal registrado','Cobertura de liquidez','Variação do patrimônio','Cobertura das metas','Concentração na maior posição','Obrigações recorrentes pendentes']){
  const region=page.getByRole('article',{name,exact:true});await region.waitFor();assert.equal(await region.locator('dt').count(),5);assert.equal(await region.locator('dd').count(),5)
 }
 await page.getByRole('region',{name:'Trajetória de quitação',exact:true}).waitFor()
 const simulator=page.getByRole('form',{name:'Simular dívidas'})
 if(await simulator.count()){await simulator.getByLabel('Orçamento mensal total (R$)').fill('100');await simulator.getByRole('button',{name:'Simular quitação'}).click();await page.getByRole('heading',{name:'Resultado da simulação'}).waitFor();await page.getByText('Ver evolução mensal',{exact:true}).click()}
 pass('financial-health-ten-explained-indicators-own-complete-inputs-and-payoff-scenario')
 await grant(a,{...active,permissions:['wealth.read']});await page.reload();await page.getByRole('article',{name:'Superávit mensal registrado',exact:true}).waitFor()
 await grant(a,{...active,status:'revoked'});assert.ok((await a.db.rpc('wealth_health_inputs')).error);await page.reload();await page.getByText('O acesso ao Wealth não está disponível para esta conta.',{exact:true}).waitFor()
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']});await page.reload()
 await other.page.goto(`${appUrl}/apps/wealth/saude`);assert.ok(!(await other.page.locator('main').innerText()).includes('Reserva patrimônio QA'))
 pass('financial-health-read-only-entitlement-revocation-and-cross-user-browser-isolation')
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Health overflow ${width}`)}
 await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/health-hosted-top.png`})
 const after=ok(await a.db.rpc('wealth_net_worth'));assert.equal(after.netWorth,own.netWorth);assert.equal(after.positionCount,own.positionCount);assert.deepEqual(after.classes,own.classes)
 pass('financial-health-WCAG-and-six-responsive-widths')
}
