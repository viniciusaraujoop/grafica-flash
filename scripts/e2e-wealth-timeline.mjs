import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthTimeline({page,context,other,anonymous,a,b,admin,appUrl,grant,active,ok,pass,output}){
 await grant(a,{...active,permissions:['wealth.read','wealth.write']})
 const rows=ok(await a.db.from('wealth_entries').insert(Array.from({length:65},(_,i)=>({user_id:a.id,kind:'income',title:`Timeline synthetic ${i}`,category:'other',amount_cents:12345,financial_date:'2027-01-01',idempotency_key:randomUUID()}))).select('id'))
 await page.goto(`${appUrl}/apps/wealth/timeline`);await page.getByRole('heading',{name:'Timeline do Wealth',exact:true}).waitFor()
 const from=await page.locator('input[name=from]').inputValue(),to=await page.locator('input[name=to]').inputValue(),query={p_from:from,p_to:to,p_source:'entries'}
 const first=ok(await a.db.rpc('wealth_timeline',query));assert.equal(first.items.length,50);assert.ok(first.items.every(e=>!('entity_id'in e)&&!('amount_cents'in e)))
 const second=ok(await a.db.rpc('wealth_timeline',{...query,p_page:2,p_as_of:first.asOf}));assert.ok(second.items.length>=15);assert.equal(new Set([...first.items,...second.items].map(e=>e.id)).size,first.items.length+second.items.length)
 const foreign=ok(await b.db.rpc('wealth_timeline',query));assert.ok(foreign.items.every(e=>!e.title.startsWith('Timeline synthetic')))
 assert.ok((await a.db.from('ecosystem_audit_events').select('*')).error)
 assert.ok((await a.db.rpc('wealth_timeline',{p_from:'2024-01-01',p_to:'2025-01-01'})).error)
 await page.locator('select[name=source]').selectOption('entries');await page.locator('select[name=operation]').selectOption('insert');await page.getByRole('button',{name:'Consultar histórico'}).click();await page.waitForURL(u=>u.searchParams.get('source')==='entries')
 const ids=await page.locator('[data-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.eventId));assert.equal(ids.length,50)
 await page.getByRole('link',{name:'Próxima página',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('page')==='2');assert.ok(new URL(page.url()).searchParams.get('asOf'));assert.ok((await page.locator('[data-event-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.eventId))).every(id=>!ids.includes(id)))
 pass('timeline-owner-only-read-model-stable-pagination-filter-and-audit-table-denied')
 await page.goto(`${appUrl}/apps/wealth/lancamentos/${rows[0].id}`);await page.getByLabel('Nome do lançamento').fill('Timeline context updated');await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.getByRole('status').filter({hasText:'atualizado'}).waitFor()
 const current=ok(await a.db.rpc('wealth_timeline',{...query,p_operation:'update'}));assert.ok(current.items.some(e=>e.title==='Timeline context updated'))
 await page.goto(`${appUrl}/apps/wealth/timeline?source=entries&operation=update`);await page.getByText('Timeline context updated',{exact:true}).waitFor();await page.locator('[data-event-id]').filter({hasText:'Timeline context updated'}).getByRole('link',{name:'Abrir registro relacionado'}).click();await page.waitForURL(u=>u.pathname===`/apps/wealth/lancamentos/${rows[0].id}`)
 if(process.env.ORCALY_QA_DOCUMENTS==='true'){const documents=ok(await a.db.rpc('wealth_timeline',{p_from:from,p_to:to,p_source:'documents'}));assert.ok(documents.items.length>0);assert.ok(documents.items.every(e=>e.title==='Documento removido'&&e.href===null))}
 await grant(a,{...active,permissions:['wealth.read']});await page.goto(`${appUrl}/apps/wealth/timeline`);await page.getByRole('heading',{name:'Atividades registradas'}).waitFor();assert.ok(ok(await a.db.rpc('wealth_timeline',query)).items.length)
 for(const patch of [{permissions:['wealth.write']},{status:'revoked'}]){await grant(a,{...active,...patch});assert.ok((await a.db.rpc('wealth_timeline',query)).error);await page.reload();assert.equal(await page.getByRole('heading',{name:'Atividades registradas'}).count(),0)}
 await grant(a,active)
 await other.page.goto(`${appUrl}/apps/wealth/timeline`);assert.equal(await other.page.getByText('Timeline context updated',{exact:true}).count(),0)
 const anonResponse=await anonymous.request.get(`${appUrl}/apps/wealth/timeline`);assert.ok(!(await anonResponse.text()).includes('Timeline context updated'))
 pass('timeline-current-context-deep-link-deleted-document-privacy-and-entitlement-gates')
 await page.goto(`${appUrl}/apps/wealth/timeline?from=1900-01-01&to=1900-01-01`);await page.getByText('Nenhuma atividade registrada neste período e filtro.',{exact:false}).waitFor()
 await page.goto(`${appUrl}/apps/wealth/timeline?from=2024-01-01&to=2025-01-01`);await page.getByRole('heading',{name:'Revise o período'}).waitFor()
 await page.goto(`${appUrl}/apps/wealth/timeline?source=entries&operation=update`)
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Timeline overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
  await page.screenshot({path:`${output}/timeline-${colorScheme}-${width}.png`,fullPage:true})
 }}
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body))
 pass('timeline-empty-invalid-six-widths-two-themes-Axe-keyboard-reduced-motion')
}
