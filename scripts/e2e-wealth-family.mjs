import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthFamily({page,context,other,anonymous,a,b,no,admin,appUrl,grant,active,ok,pass,output}){
 const command=(u,op,input)=>u.db.rpc('manage_wealth_family',{p_operation:op,p_input:input}),input=(extra={})=>({id:randomUUID(),idempotency_key:randomUUID(),confirmed:'yes',...extra}),read=(u,id)=>u.db.rpc('read_wealth_family_share',{p_id:id}),overview=u=>u.db.rpc('wealth_family_overview')
 await grant(a,active);await grant(b,active)
 await page.goto(`${appUrl}/apps/wealth/familia`);await page.getByRole('heading',{name:'Wealth Family',exact:true}).waitFor();await page.getByText('Convidar uma pessoa',{exact:true}).click()
 const invite=page.locator('[data-family-operation=invite]');await invite.getByLabel('Nome desta conexão').fill('Família sintética QA');await invite.getByLabel('Email confirmado da pessoa').fill(b.email);await invite.getByRole('checkbox').check()
 let request;page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action']&&new URL(r.url()).pathname==='/apps/wealth/familia')request=r})
 await invite.getByRole('button',{name:'Criar convite'}).click();await invite.getByRole('status').filter({hasText:'Convite criado'}).waitFor()
 const code=await invite.getByLabel('Código para entregar à pessoa').inputValue(),[connection,secret]=code.split('.')
 assert.equal(code.length,101);assert.ok((await command(no,'join',input({id:connection,code:secret}))).error)
 assert.ok((await command(b,'join',input({id:connection,code:'f'.repeat(64)}))).error)
 const replayBody=request.postDataBuffer(),replayHeaders={'content-type':request.headers()['content-type'],'next-action':request.headers()['next-action'],origin:appUrl}
 const denied=await anonymous.request.post(`${appUrl}/apps/wealth/familia`,{headers:replayHeaders,data:replayBody});const denialText=await denied.text();assert.ok(denialText.includes('Acesso negado')||denied.url().includes('/login')||denied.headers()['x-action-redirect']?.includes('/login'),'Anonymous action must deny or redirect to login')
 await other.page.goto(`${appUrl}/apps/wealth/familia`);await other.page.getByText('Tenho um convite',{exact:true}).click();const join=other.page.locator('[data-family-operation=join]');await join.getByLabel('Código de convite').fill(code);await join.getByRole('checkbox').check();await join.getByRole('button',{name:'Aceitar conexão'}).click();await join.getByRole('status').filter({hasText:'Conexão aceita'}).waitFor()
 assert.equal(ok(await overview(b)).connections.find(c=>c.id===connection).state,'active');assert.equal(ok(await overview(b)).shares.length,0)
 pass('family-email-bound-invitation-Server-Actions-no-automatic-sharing-and-anonymous-denial')
 const goal=ok(await a.db.from('wealth_goals').insert({user_id:a.id,title:'Reserva familiar QA',target_cents:99999999999999,saved_cents:12345,target_date:'2027-01-01',idempotency_key:randomUUID()}).select('id').single())
 await page.reload();await page.getByText('Compartilhar um registro',{exact:true}).click();const propose=page.locator('[data-family-operation=share]');await propose.locator('select[name=connection_id]').selectOption(connection);await propose.locator('select[name=resource]').selectOption(`goal.summary:${goal.id}`);await propose.getByLabel('Validade em dias').fill('30');await propose.getByLabel('Finalidade do acesso').fill('Planejar uma viagem juntos');await propose.getByRole('checkbox').check();await propose.getByRole('button',{name:'Propor compartilhamento'}).click();await propose.getByRole('status').filter({hasText:'Acesso proposto'}).waitFor()
 const share=ok(await overview(a)).shares[0];assert.equal(ok(await read(b,share.id)),null);assert.equal(ok(await overview(b)).shares[0].resource,null)
 await other.page.reload();const received=other.page.locator(`[data-share-id="${share.id}"]`),accept=received.locator('[data-family-operation=accept]');await accept.getByRole('checkbox').check();await accept.getByRole('button',{name:'Aceitar acesso'}).click();await received.getByRole('heading',{name:'Reserva familiar QA'}).waitFor()
 assert.equal(ok(await read(b,share.id)).target_cents,'99999999999999');assert.deepEqual(ok(await b.db.from('wealth_goals').select('id').eq('id',goal.id)),[])
 assert.equal(ok(await read(no,share.id)),null);assert.ok((await command(b,'share',input({connection_id:connection,scope:'goal.summary',resource_id:goal.id,purpose:'Forged',days:1}))).error)
 ok(await a.db.from('wealth_goals').update({saved_cents:23456}).eq('id',goal.id));assert.equal(ok(await read(b,share.id)).saved_cents,'23456')
 assert.ok((await command(a,'revoke',input({id:share.id,version:1}))).error?.code==='PT409')
 const timeline=ok(await b.db.rpc('wealth_timeline',{p_from:new Date().toISOString().slice(0,10),p_to:new Date().toISOString().slice(0,10)}));assert.ok(!timeline.items.some(e=>e.title==='Reserva familiar QA'))
 pass('family-explicit-scope-consent-live-minimal-projection-cross-user-and-private-Timeline')
 const pdf=Buffer.from('%PDF-1.4\nSynthetic family file\n%%EOF'),sha=createHash('sha256').update(pdf).digest('hex'),doc=input({title:'Contrato Family QA',category:'contract',document_date:null,notes:'Notes remain private',links:[{kind:'goal',id:goal.id}],mime_type:'application/pdf',size_bytes:pdf.length,sha256:sha})
 ok(await a.db.rpc('manage_wealth_document',{p_operation:'reserve',p_input:doc}));const path=`${a.id}/${doc.id}/document`;ok(await a.db.storage.from('wealth-documents').upload(path,pdf,{contentType:'application/pdf',upsert:false}));ok(await a.db.rpc('manage_wealth_document',{p_operation:'finalize',p_input:input({id:doc.id,version:1})}))
 const docInput=input({connection_id:connection,scope:'document.download',resource_id:doc.id,purpose:'Ler contrato combinado',days:1}),docShare=ok(await command(a,'share',docInput));assert.equal(ok(await command(a,'share',docInput)),docShare);assert.ok((await command(a,'share',{...docInput,days:2})).error?.code==='23505')
 assert.ok((await b.db.storage.from('wealth-documents').download(path)).error);ok(await command(b,'accept',input({id:docShare,version:1})))
 const file=ok(await b.db.storage.from('wealth-documents').download(path));assert.equal(createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),sha)
 assert.ok(!('notes' in ok(await read(b,docShare))));assert.deepEqual(ok(await b.db.from('wealth_documents').select('id')),[])
 assert.ok((await b.db.storage.from('wealth-documents').createSignedUrl(path,60)).error);assert.deepEqual(ok(await b.db.storage.from('wealth-documents').list(a.id)),[])
 assert.ok((await b.db.storage.from('wealth-documents').upload(path,pdf,{contentType:'application/pdf',upsert:true})).error)
 const url=`${appUrl}/api/wealth/family/${docShare}/document`,response=await other.context.request.get(url);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);assert.match(response.headers()['content-disposition'],/^attachment/);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),sha)
 assert.equal((await anonymous.request.get(url)).status(),403);assert.equal((await context.request.get(url)).status(),404)
 assert.equal((await other.context.request.get(`${appUrl}/api/wealth/documents/${doc.id}`)).status(),404)
 pass('family-real-private-Storage-authenticated-download-no-sign-list-upsert-or-metadata-leak')
 for(const u of [a,b]){await grant(u,{...active,status:'revoked'});assert.equal(ok(await read(b,docShare)),null);assert.ok((await b.db.storage.from('wealth-documents').download(path)).error);assert.ok([403,404].includes((await other.context.request.get(url)).status()));await grant(u,active)}
 await other.page.reload()
 for(const colorScheme of ['light','dark']){await other.page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await other.page.setViewportSize({width,height:1000});assert.ok(await other.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Family overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const result=await new AxeBuilder({page:other.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
  await other.page.screenshot({path:`${output}/family-${colorScheme}-${width}.png`,fullPage:true})
 }}
 await other.page.keyboard.press('Tab');assert.ok(await other.page.evaluate(()=>document.activeElement!==document.body))
 await page.goto(`${appUrl}/apps/wealth/familia`);await page.getByText('Convidar uma pessoa',{exact:true}).click();await page.getByText('Compartilhar um registro',{exact:true}).click();await page.getByText('Tenho um convite',{exact:true}).click()
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Family forms overflow ${width} ${colorScheme}`)
  if([320,1440].includes(width)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[])}
  await page.screenshot({path:`${output}/family-forms-${colorScheme}-${width}.png`,fullPage:true})
 }}
 pass('family-six-widths-two-themes-Axe-keyboard-reduced-motion-and-both-entitlement-gates')
 const races=await Promise.all([command(a,'revoke',input({id:docShare,version:2})),command(b,'revoke',input({id:docShare,version:2}))]);assert.equal(races.filter(r=>!r.error).length,1);assert.equal(races.find(r=>r.error).error.code,'PT409')
 assert.equal(ok(await read(b,docShare)),null);assert.ok((await b.db.storage.from('wealth-documents').download(path)).error);assert.equal((await other.context.request.get(url)).status(),404)
 await other.page.emulateMedia({colorScheme:'light'});await other.page.setViewportSize({width:1440,height:1000});await other.page.reload();await grant(b,{...active,status:'revoked'});await other.page.reload();await other.page.getByText('Seu acesso ao Wealth não está ativo.',{exact:false}).waitFor()
 const card=other.page.locator(`[data-share-id="${share.id}"]`);await card.getByText('Recusar ou encerrar acesso',{exact:true}).click();const revoke=card.locator('[data-family-operation=revoke]');await revoke.getByRole('checkbox').check();await revoke.getByRole('button',{name:'Encerrar acesso'}).click();await card.getByText('Encerrado',{exact:true}).waitFor();await grant(b,active)
 pass('family-real-concurrent-revocation-PT409-download-denial-and-withdrawal-without-entitlement')
 const pending=ok(await command(a,'share',input({connection_id:connection,scope:'goal.summary',resource_id:goal.id,purpose:'Concurrent leave',days:1})))
 await Promise.all([command(b,'accept',input({id:pending,version:1})),command(a,'disconnect',input({id:connection,version:2}))]);assert.equal(ok(await read(b,pending)),null)
 assert.ok((await command(b,'share',input({connection_id:connection,scope:'goal.summary',resource_id:goal.id,purpose:'After disconnect',days:1}))).error)
 await page.goto(`${appUrl}/apps/wealth/familia?page=0`);await page.getByRole('heading',{name:'Página inválida'}).waitFor()
 pass('family-concurrent-disconnect-accept-final-denial-and-invalid-page')
}
