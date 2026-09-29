import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthPlanning({page,context,a,b,admin,appUrl,grant,active,ok,pass,output}){
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 const goal=ok(await a.db.from('wealth_goals').insert({id:'00000000-0000-4000-8000-000000000001',user_id:a.id,title:'Casa no horizonte QA',target_cents:2500000,saved_cents:500000,monthly_contribution_cents:100000,target_date:'2028-12-31',idempotency_key:randomUUID()}).select().single())
 const goalUrl=`${appUrl}/apps/wealth/metas/${goal.id}`
 await page.goto(goalUrl);await page.getByRole('heading',{name:'Casa no horizonte QA'}).waitFor();await page.getByLabel('E se eu reservar outro valor por mês? (R$)').fill('2000,00');await page.getByRole('status').filter({hasText:'Simulação alternativa'}).waitFor()
 assert.equal(ok(await a.db.from('wealth_goals').select('monthly_contribution_cents').eq('id',goal.id).single()).monthly_contribution_cents,100000)
 await page.getByText('Editar fontes de funding',{exact:true}).click()
 const form=page.locator('form').filter({has:page.locator('input[name=operation][value=funding]')})
 await form.getByLabel('Prioridade').selectOption('high');await form.getByRole('button',{name:'Adicionar referência'}).click();await form.locator('select[name=source_0]').selectOption('manual');await form.getByLabel('Valor planejado da fonte 1 (R$)').fill('1000,00');await form.getByRole('checkbox').check()
 await form.evaluate((node,owner)=>{const el=document.createElement('input');el.name='user_id';el.value=owner;el.type='hidden';node.appendChild(el)},b.id)
 const stale=await context.newPage();await stale.goto(goalUrl);await stale.getByText('Editar fontes de funding',{exact:true}).click()
 await form.getByRole('button',{name:'Salvar funding',exact:true}).click()
 await form.getByRole('status').filter({hasText:'Planejamento salvo'}).waitFor()
 await page.getByText('Valor planejado da fonte: R$',{exact:false}).waitFor()
 const stored=ok(await a.db.from('wealth_goal_funding').select('*').eq('id',goal.id).single());assert.equal(stored.user_id,a.id);assert.equal(stored.sources[0].planned_cents,'100000')
 assert.equal(ok(await a.db.from('wealth_goals').select('saved_cents,version').eq('id',goal.id).single()).saved_cents,500000)
 const staleForm=stale.locator('form').filter({has:stale.locator('input[name=operation][value=funding]')});await staleForm.getByRole('checkbox').check();await staleForm.getByRole('button',{name:'Salvar funding'}).click();await staleForm.getByRole('status').filter({hasText:'mudou'}).waitFor();await stale.close()
 pass('planning-goal-Server-Action-owner-bound-CAS-and-alternative-without-balance-mutation')
 await page.goto(`${appUrl}/apps/wealth/planejamento`);await page.getByText('Criar plano de vida',{exact:true}).click()
 const lifeForm=page.locator('form').filter({has:page.locator('input[name=operation][value=life]')})
 await lifeForm.getByLabel('Nome do plano').fill('Mudança de cidade QA');await lifeForm.locator('select[name=event_type]').selectOption('moving');await lifeForm.getByLabel('Data desejada').fill('2028-12-31')
 await lifeForm.getByLabel('Custo inicial estimado (R$)').fill('10000,00');await lifeForm.getByLabel('Custo mensal adicional (R$)').fill('500,00');await lifeForm.getByLabel('Já destinado ao custo inicial (R$)').fill('2000,00');await lifeForm.getByLabel('Capacidade mensal antes do evento (R$)').fill('1000,00');await lifeForm.getByLabel('Reserva disponível declarada (R$) · opcional').fill('5000,00');await lifeForm.getByLabel('Parcela da reserva a usar (R$)').fill('1000,00');await lifeForm.getByLabel('Premissas do cenário').fill('Orçamento sintético, renda constante; nenhum retorno ou crédito presumido.')
 await lifeForm.getByRole('button',{name:'Adicionar referência'}).click();await lifeForm.locator('select[name=source_0]').selectOption(`goal|${goal.id}`);await lifeForm.getByRole('checkbox').check();await lifeForm.getByRole('button',{name:'Salvar plano de vida'}).click()
 await page.getByRole('link',{name:'Mudança de cidade QA',exact:true}).click();await page.waitForURL(u=>/\/planejamento\/[^/]+$/.test(u.pathname))
 const planUrl=page.url(),planId=new URL(planUrl).pathname.split('/').at(-1)
 let plan=ok(await a.db.from('wealth_life_plans').select('*').eq('id',planId).single());assert.equal(plan.upfront_cents,1000000);assert.equal(plan.current_funding_cents,200000)
 await page.getByText('R$ 16.000,00',{exact:false}).first().waitFor();assert.deepEqual(ok(await b.db.from('wealth_life_plans').select('*').eq('id',planId)),[])
 const input={...Object.fromEntries(Object.entries(plan).filter(([k])=>!['id','version','user_id','created_at','updated_at'].includes(k))),id:planId,version:1,confirmed:'yes',idempotency_key:randomUUID(),status:'active'}
 const second={...input,idempotency_key:randomUUID(),status:'paused'}
 const concurrent=await Promise.all([a.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:input}),a.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:second})])
 assert.equal(concurrent.filter(r=>!r.error).length,1);assert.equal(concurrent.find(r=>r.error).error.code,'PT409')
 const winning=concurrent[0].error?second:input
 if(winning){assert.equal(ok(await a.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:winning})),planId);assert.equal((await a.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:{...winning,title:'Changed token'}})).error.code,'23505')}
 assert.equal((await b.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:{...input,version:2,idempotency_key:randomUUID()}})).error.code,'42501')
 assert.ok((await a.db.from('wealth_life_plans').update({title:'Bypass'}).eq('id',planId)).error)
 pass('life-plan-Server-Action-exact-cost-references-concurrent-CAS-replay-and-cross-user-isolation')
 await page.reload();await page.getByText('Editar plano de vida',{exact:true}).click()
 const editForm=page.locator('form').filter({has:page.locator('input[name=operation][value=life]')});await editForm.getByRole('checkbox').check()
 await grant(a,{...active,permissions:['wealth.read']});await editForm.getByRole('button',{name:'Salvar plano de vida'}).click();await editForm.getByRole('status').filter({hasText:'não permite'}).waitFor()
 await page.goto(goalUrl);await page.getByRole('heading',{name:'Seu caminho até a meta'}).waitFor();assert.equal(await page.getByRole('button',{name:'Salvar meta',exact:true}).count(),0)
 await grant(a,{...active,permissions:['wealth.write']});assert.deepEqual(ok(await a.db.from('wealth_life_plans').select('id')),[]);assert.equal((await a.db.rpc('manage_wealth_planning',{p_operation:'life',p_input:input})).error.code,'42501')
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 assert.equal(ok(await admin.from('wealth_life_plans').select('version').eq('id',planId).single()).version,2)
 pass('planning-read-only-detail-and-revoked-write-Server-Action-write-only-database-gates')
 for(const [name,url,expand] of [['goal',goalUrl,'Editar fontes de funding'],['life',planUrl,'Editar plano de vida']]){
  await page.goto(url);await page.getByText(expand,{exact:true}).click()
  for(const colorScheme of ['light','dark']){
   await page.emulateMedia({colorScheme,reducedMotion:'reduce'})
   for(const width of [320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${name} overflow ${width} ${colorScheme}`)
    if([320,1440].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${name} ${width} ${colorScheme}`)}
    await page.screenshot({path:`${output}/${name}-${colorScheme}-${width}.png`,fullPage:true})
   }
  }
 }
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body))
 pass('planning-six-widths-light-dark-Axe-expanded-forms-keyboard-reduced-motion')
}
