import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthCalendar({page,context,a,b,admin,appUrl,grant,active,ok,pass,output}){
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 const input={title:'Assinatura anterior QA',kind:'expense',category:'other',amount_cents:500,frequency:'monthly',interval_count:1,start_date:'2027-01-31',end_date:'2027-05-31',timezone:'America/Sao_Paulo',confirmed:'yes'}
 const create=async(title,amount_cents=600)=>ok(await a.db.rpc('create_wealth_recurrence',{p_input:{...input,title,amount_cents,idempotency_key:randomUUID()}}))
 const old=await create(input.title,500);ok(await a.db.rpc('change_wealth_recurrence',{p_id:old,p_version:1,p_operation:'cancel'}))
 const id=await create('Streaming Calendar QA'),duplicate=await create('Streaming duplicado QA')
 const billsUrl=`${appUrl}/apps/wealth/recorrencias?schedule=${id}&month=2027-02`
 await page.goto(billsUrl);await page.getByText('Classificar e revisar conta',{exact:true}).click()
 const form=page.getByRole('form',{name:'Classificar Streaming Calendar QA',exact:true})
 await form.getByLabel('Tipo de conta').selectOption('subscription');await form.getByLabel('Fornecedor ou referência').fill('Calendar Provider QA');await form.getByLabel('Versão anterior cancelada').selectOption(old)
 await form.evaluate((node,owner)=>{const el=document.createElement('input');el.name='user_id';el.value=owner;el.type='hidden';node.appendChild(el)},b.id)
 const stale=await context.newPage();await stale.goto(billsUrl);await stale.getByText('Classificar e revisar conta',{exact:true}).click()
 await form.getByRole('checkbox').check();await form.getByRole('button').click();await form.getByRole('status').filter({hasText:'Revisão salva'}).waitFor()
 const saved=ok(await a.db.from('wealth_bill_details').select('*').eq('id',id).single());assert.equal(saved.user_id,a.id);assert.equal(saved.version,1)
 await page.getByText('Aumento declarado:',{exact:false}).waitFor()
 const staleForm=stale.getByRole('form',{name:'Classificar Streaming Calendar QA',exact:true});await staleForm.getByRole('checkbox').check();await staleForm.getByRole('button').click();await staleForm.getByRole('status').filter({hasText:'mudou em outra aba'}).waitFor();await stale.close()
 assert.deepEqual(ok(await b.db.from('wealth_bill_details').select('*').eq('id',id)),[])
 assert.ok((await b.db.rpc('save_wealth_bill',{p_id:id,p_version:1,p_type:'expense',p_provider:'forged'})).error)
 ok(await a.db.rpc('save_wealth_bill',{p_id:duplicate,p_version:0,p_type:'subscription',p_provider:'Calendar Provider QA'}))
 await page.reload();await page.getByText('1 possível(is) duplicidade(s)',{exact:false}).waitFor()
 const totals=ok(await a.db.rpc('wealth_bills',{p_month:'2027-02-01',p_id:id}));assert.equal(totals.bills[0].price_change,'100');assert.equal(totals.bills[0].month_amount,'600')
 assert.equal(ok(await a.db.from('wealth_recurring_schedules').select('amount_cents').eq('id',id).single()).amount_cents,600)
 pass('calendar-bills-Server-Action-owner-CAS-comparable-price-change-and-duplicate-evidence')
 await page.getByText('Classificar e revisar conta',{exact:true}).click();await form.getByRole('checkbox').check();await grant(a,{...active,permissions:['wealth.read']});await form.getByRole('button').click();await form.getByRole('status').filter({hasText:'não permite revisar contas'}).waitFor()
 assert.equal(ok(await admin.from('wealth_bill_details').select('version').eq('id',id).single()).version,1)
 await grant(a,{...active,permissions:['wealth.write']});assert.ok((await a.db.rpc('wealth_calendar',{p_from:'2027-02-01',p_to:'2027-02-28'})).error);assert.ok((await a.db.rpc('wealth_bills',{p_month:'2027-02-01'})).error)
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 const cal=ok(await a.db.rpc('wealth_calendar',{p_from:'2027-02-01',p_to:'2027-02-28',p_source:'recurrence'}))
 assert.equal(cal.events.find(e=>e.source_id===id).event_at,'2027-02-28');assert.equal(cal.events.find(e=>e.source_id===id).context.cash,false)
 assert.equal(ok(await b.db.rpc('wealth_calendar',{p_from:'2027-02-01',p_to:'2027-02-28'})).events.some(e=>e.source_id===id),false)
 assert.ok((await a.db.rpc('wealth_calendar',{p_from:'2020-01-01',p_to:'2027-02-28'})).error)
 pass('calendar-hosted-RLS-read-only-write-only-range-bound-and-leap-anchor')
 const calendarUrl=`${appUrl}/apps/wealth/calendario?date=2027-02-01&source=recurrence`
 await page.goto(calendarUrl);await page.getByRole('heading',{name:'O que vem pela frente.'}).waitFor()
 await page.getByRole('link',{name:/28\/02\/2027: .* eventos/}).click()
 await page.waitForURL(url=>url.searchParams.get('days')==='1')
 assert.equal(new URL(page.url()).searchParams.get('days'),'1');await page.getByRole('link',{name:'Streaming Calendar QA',exact:true}).click()
 await page.waitForURL(url=>url.searchParams.get('schedule')===id);assert.equal(new URL(page.url()).searchParams.get('schedule'),id)
 for(const view of ['week','agenda','upcoming','overdue']){await page.goto(`${appUrl}/apps/wealth/calendario?view=${view}&date=2027-02-01`);await page.getByRole('heading',{name:'Seu roteiro financeiro'}).waitFor()}
 await page.goto(`${calendarUrl}&status=HYPOTHETICAL`);await page.getByText('Não há hipóteses com datas nesta fonte.',{exact:false}).waitFor()
 pass('calendar-month-week-agenda-upcoming-overdue-hypothesis-and-source-deep-links')
 for(const [name,url] of [['calendar',calendarUrl],['bills',billsUrl]]){
  await page.goto(url)
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
 pass('calendar-bills-six-widths-light-dark-Axe-keyboard-and-reduced-motion')
}
