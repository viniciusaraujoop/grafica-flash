import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'

export async function testWealthNetWorth({page,context,a,b,admin,appUrl,grant,active,ok,pass,errors,output}){
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 const asset=ok(await a.db.from('wealth_entries').insert({user_id:a.id,kind:'asset',title:'Reserva patrimônio QA',category:'investment',amount_cents:11229,financial_date:'2026-09-26',idempotency_key:randomUUID()}).select('*').single())
 const countResult=await a.db.from('wealth_entries').select('id',{count:'exact',head:true}).eq('user_id',a.id).in('kind',['asset','liability']).is('archived_at',null).lt('id',asset.id);assert.equal(countResult.error,null)
 const url=`${appUrl}/apps/wealth/patrimonio?page=${Math.floor(countResult.count/25)+1}`
 await page.goto(url)
 await page.getByText('Reserva patrimônio QA ·',{exact:false}).click()
 const form=page.getByRole('form',{name:'Classificar Reserva patrimônio QA',exact:true})
 await form.waitFor({state:'visible'});
 const stale=await context.newPage();stale.setDefaultTimeout(30000);stale.on('pageerror',e=>errors.push(e.message));await stale.goto(url);await stale.getByText('Reserva patrimônio QA ·',{exact:false}).click()
 await form.getByLabel('Classe').selectOption('savings');await form.getByLabel('Liquidez declarada').selectOption('immediate')
 await form.evaluate((node,owner)=>{const i=document.createElement('input');i.name='user_id';i.type='hidden';i.value=owner;node.appendChild(i)},b.id)
 await form.getByRole('button',{name:'Salvar classificação'}).click()
 await page.waitForFunction(()=>document.body.textContent.includes('Poupança · Imediata'))
 const updated=ok(await a.db.from('wealth_entries').select('*').eq('id',asset.id).single());assert.equal(updated.user_id,a.id);assert.equal(updated.position_class,'savings');assert.equal(updated.version,2);assert.equal(updated.amount_cents,11229)
 const old=stale.getByRole('form',{name:'Classificar Reserva patrimônio QA',exact:true});await old.getByRole('button').click();await old.getByRole('status').filter({hasText:'mudou ou está indisponível'}).waitFor();await stale.close()
 const denied=await b.db.rpc('classify_wealth_position',{p_entry_id:asset.id,p_version:2,p_class:'cash',p_liquidity:'immediate'}).abortSignal(AbortSignal.timeout(7000));assert.equal(denied.status,409)
 const summary=ok(await a.db.rpc('wealth_net_worth'));const totals=ok(await a.db.rpc('wealth_summary',{p_month:'2026-09-01'}));assert.equal(summary.netWorth,totals.netWorth);assert.equal(summary.assets,totals.assets);assert.equal(summary.liabilities,totals.liabilities)
 assert.equal(summary.classes.filter(c=>c.kind==='asset').reduce((s,c)=>s+BigInt(c.amount),0n).toString(),summary.assets)
 pass('net-worth-classification-Server-Action-version-conflict-isolation-and-complete-exact-aggregates')

 const capture=page.getByRole('form',{name:'Registrar snapshot',exact:true}),token=await capture.locator('input[name="idempotency_key"]').inputValue()
 await capture.getByRole('checkbox').check();await capture.getByRole('button').click();await capture.getByRole('status').filter({hasText:'Snapshot registrado'}).waitFor()
 const saved=ok(await a.db.from('wealth_net_worth_snapshots').select('*').eq('idempotency_key',token).single());assert.equal(saved.composition.netWorth,summary.netWorth);assert.equal(saved.user_id,a.id)
 assert.equal(ok(await a.db.rpc('capture_wealth_net_worth',{p_idempotency_key:token})),saved.id)
 assert.deepEqual(ok(await b.db.from('wealth_net_worth_snapshots').select('*').eq('id',saved.id)),[])
 assert.ok((await a.db.from('wealth_net_worth_snapshots').update({source:'forged'}).eq('id',saved.id)).error)
 ok(await a.db.from('wealth_entries').update({amount_cents:12229}).eq('id',asset.id))
 assert.equal(ok(await a.db.from('wealth_net_worth_snapshots').select('composition').eq('id',saved.id).single()).composition.assets,summary.assets)
 await page.goto(`${url}&snapshot=${saved.id}`);await page.getByRole('region',{name:'Snapshot selecionado'}).waitFor();await page.getByText('Diferença do patrimônio atual em relação a este snapshot:',{exact:false}).waitFor()
 const section=page.getByRole('region',{name:'Snapshot selecionado'});assert.match((await section.innerText()).replace(/\s+/g,' '),/R\$ 10,00/)
 const foreign=await b.db.from('wealth_net_worth_snapshots').select('id').eq('id',saved.id);assert.deepEqual(ok(foreign),[])
 await grant(a,{...active,permissions:['wealth.read']})
 const oldCapture=page.getByRole('form',{name:'Registrar snapshot'});await oldCapture.getByRole('checkbox').check();await oldCapture.getByRole('button').click();await oldCapture.getByRole('status').filter({hasText:'não permite alterar o patrimônio'}).waitFor()
 assert.ok((await a.db.rpc('capture_wealth_net_worth',{p_idempotency_key:randomUUID()})).error)
 await page.reload();assert.equal(await page.getByRole('form',{name:'Registrar snapshot'}).count(),0)
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']});await page.reload()
 pass('net-worth-immutable-explicit-snapshot-timezone-idempotency-history-and-entitlement')

 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[])
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Net worth overflow ${width}`)}
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:`${output}/net-worth-hosted.png`,fullPage:true})
 const audit=ok(await admin.from('ecosystem_audit_events').select('event_type').eq('entity_id',saved.id));assert.ok(audit.some(e=>e.event_type==='wealth_net_worth_snapshots.insert'))
 pass('net-worth-audit-WCAG-and-six-responsive-widths')
}
