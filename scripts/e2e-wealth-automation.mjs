import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthAutomation({page,context,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output}){
 const input=(extra={})=>({idempotency_key:randomUUID(),confirmed:'yes',...extra}),cmd=(u,op,data=input())=>u.db.rpc('manage_wealth_automation',{p_operation:op,p_input:data}),read=(u,extra={})=>u.db.rpc('wealth_automation_overview',extra)
 await grant(a,active);await grant(b,active)
 // Isolate this fixture's active work after earlier regression units; do not delete or rewrite their history.
 const prior=ok(await a.db.from('wealth_recurring_schedules').select('id,version').eq('status','active'));for(const s of prior)assert.equal(ok(await a.db.rpc('change_wealth_recurrence',{p_id:s.id,p_version:s.version,p_operation:'pause'})),true)
 const create=(u,title)=>u.db.rpc('create_wealth_recurrence',{p_input:{title,kind:'expense',category:'housing',amount_cents:29,frequency:'monthly',interval_count:1,start_date:'1900-01-31',max_occurrences:3,timezone:'America/Sao_Paulo',...input()}})
 const id=ok(await create(a,'Rotina Automation QA')),foreign=ok(await create(b,'Automação privada B'))
 const receipt=input(),races=await Promise.all([cmd(a,'run',receipt),cmd(a,'run',receipt)]);assert.deepEqual(ok(races[0]),ok(races[1]));assert.equal(races[0].data.generated,1)
 assert.equal(ok(await a.db.from('wealth_recurrence_occurrences').select('entry_id').eq('schedule_id',id)).length,1);assert.equal(ok(await b.db.from('wealth_recurrence_occurrences').select('entry_id').eq('schedule_id',foreign)).length,0)
 assert.ok(!JSON.stringify(ok(await read(a))).includes('Automação privada B'));assert.ok((await read(no)).error);assert.ok((await a.db.from('background_jobs').update({status:'retrying'}).eq('id',randomUUID())).error)
 assert.ok((await cmd(a,'run',input({user_id:b.id}))).error)
 pass('automation-real-engine-exact-concurrent-replay-owner-scope-and-no-direct-queue-writes')
 await page.goto(`${appUrl}/apps/wealth/automacoes`);await page.getByRole('heading',{name:'Automation Center',exact:true}).waitFor();await page.getByText('Preferências da central',{exact:true}).click()
 const prefs=page.locator('[data-automation-operation=configure]');await prefs.getByLabel('Período padrão do histórico').selectOption('7');await prefs.getByLabel('Mostrar agendamentos concluídos e cancelados por padrão').check();await prefs.locator('input[name=confirmed]').check()
 let request;page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action']&&new URL(r.url()).pathname==='/apps/wealth/automacoes')request=r})
 await prefs.getByRole('button',{name:'Salvar preferências'}).click();await prefs.getByRole('status').filter({hasText:'Preferências salvas'}).waitFor();assert.equal(ok(await read(a)).days,7);assert.equal(ok(await read(b)).preferences.version,0)
 const denied=await anonymous.request.post(request.url(),{headers:{'content-type':request.headers()['content-type'],'next-action':request.headers()['next-action'],origin:appUrl},data:request.postDataBuffer(),maxRedirects:0});assert.ok([303,307].includes(denied.status()));assert.ok(denied.headers().location.includes('/login'))
 const version=ok(await read(a)).preferences.version,cas=await Promise.all([cmd(a,'configure',input({version,history_days:7,show_inactive:true})),cmd(a,'configure',input({version,history_days:30,show_inactive:true}))]);assert.equal(cas.filter(x=>!x.error).length,1);assert.equal(cas.find(x=>x.error).error.code,'PT409')
 pass('automation-preferences-Server-Action-concurrent-CAS-and-anonymous-denial')
 await page.reload();const stale=await context.newPage();await stale.goto(`${appUrl}/apps/wealth/automacoes`);const staleCard=stale.locator(`[data-automation-schedule="${id}"]`);await staleCard.getByText('Controlar este agendamento',{exact:true}).click()
 const card=page.locator(`[data-automation-schedule="${id}"]`);await card.getByText('Controlar este agendamento',{exact:true}).click();const pause=card.locator('[data-automation-operation=pause]');await pause.getByRole('checkbox').check();await pause.getByRole('button',{name:'Pausar agendamento'}).click();await card.getByText('Pausada',{exact:true}).waitFor()
 const stalePause=staleCard.locator('[data-automation-operation=pause]');await stalePause.getByRole('checkbox').check();await stalePause.getByRole('button',{name:'Pausar agendamento'}).click();await stalePause.getByRole('status').filter({hasText:'O estado mudou'}).waitFor();await stale.close()
 const resume=card.locator('[data-automation-operation=resume]');await resume.getByRole('checkbox').check();await resume.getByRole('button',{name:'Retomar agendamento'}).click();await card.getByText('Ativa',{exact:true}).waitFor()
 await page.getByText('Executar pendências agora',{exact:true}).click();const run=page.locator('[data-automation-operation=run]');await run.getByRole('checkbox').check();await run.getByRole('button',{name:'Executar lote agora'}).click();await run.getByRole('status').filter({hasText:'1 lançamento(s) declarado(s)'}).waitFor()
 const occurrenceRows=ok(await a.db.from('wealth_recurrence_occurrences').select('entry_id').eq('schedule_id',id));assert.equal(occurrenceRows.length,2)
 assert.equal(ok(await a.db.from('wealth_entries').select('amount_cents').in('id',occurrenceRows.map(o=>o.entry_id))).reduce((n,e)=>n+e.amount_cents,0),58)
 await card.getByText('Controlar este agendamento',{exact:true}).evaluate(el=>{const d=el.parentElement;if(!d.open)el.click()});const cancel=card.locator('[data-automation-operation=cancel]');await cancel.getByRole('checkbox').check();await cancel.getByRole('button',{name:'Cancelar agendamento'}).click();await card.getByText('Cancelada',{exact:true}).waitFor()
 pass('automation-pause-resume-cancel-stale-UI-manual-batch-and-exact-cents-with-original-ledger')
 const retryId=ok(await create(a,'Retentativa Automation QA'));const job=ok(await admin.from('background_jobs').select('id').eq('job_type','wealth.recurrence').eq('payload->>recurrence_id',retryId).single())
 ok(await admin.from('background_jobs').update({status:'needs_attention',attempts:5,max_attempts:5,locked_by:null,locked_at:null,completed_at:new Date().toISOString(),last_error:'SYNTHETIC_INTERNAL_MESSAGE_MUST_STAY_PRIVATE'}).eq('id',job.id));assert.ok(!JSON.stringify(ok(await read(a))).includes('SYNTHETIC_INTERNAL_MESSAGE'))
 assert.equal((await cmd(b,'retry',input({id:job.id,attempts:5}))).error.code,'42501');await page.reload();const retryCard=page.locator(`[data-automation-schedule="${retryId}"]`);await retryCard.getByText('Revisar tentativa interrompida',{exact:true}).click();const retry=retryCard.locator('[data-automation-operation=retry]');await retry.getByRole('checkbox').check();await retry.getByRole('button',{name:'Autorizar nova tentativa'}).click();await retryCard.getByText('Trabalho: Aguardando nova tentativa',{exact:false}).waitFor()
 const updated=ok(await admin.from('background_jobs').select('attempts,max_attempts,status').eq('id',job.id).single());assert.equal(updated.attempts,5);assert.equal(updated.max_attempts,6);assert.equal(updated.status,'retrying')
 assert.equal((await cmd(a,'retry',input({id:job.id,attempts:5}))).error.code,'PT409');assert.ok(ok(await cmd(a,'run')).generated>=1)
 for(const permissions of [['wealth.read'],['wealth.write']]){await grant(a,{...active,permissions});assert.ok((await cmd(a,'run',receipt)).error);await page.reload();assert.equal(await page.getByText('Executar pendências agora',{exact:true}).count(),0);if(!permissions.includes('wealth.read'))assert.ok((await read(a)).error)}
 await grant(a,active);await page.goto(`${appUrl}/apps/wealth/automacoes`)
 pass('automation-scoped-retry-attempt-history-no-internal-error-leak-and-entitlement-recheck')
 await page.getByText('Executar pendências agora',{exact:true}).click();await page.getByText('Preferências da central',{exact:true}).click()
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Automation overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
  await page.screenshot({path:`${output}/automation-${colorScheme}-${width}.png`,fullPage:true})
 }}
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));await other.page.goto(`${appUrl}/apps/wealth/automacoes`);assert.equal(await other.page.getByRole('heading',{name:'Rotina Automation QA',exact:true}).count(),0)
 await page.goto(`${appUrl}/apps/wealth/automacoes?page=0`);await page.getByRole('heading',{name:'Revise os filtros'}).waitFor()
 pass('automation-history-six-widths-two-themes-Axe-keyboard-reduced-motion-invalid-filter-and-isolation')
}
