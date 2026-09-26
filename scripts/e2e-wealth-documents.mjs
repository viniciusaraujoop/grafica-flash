import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
export async function testWealthDocuments({page,context,other,anonymous,a,b,admin,appUrl,grant,active,ok,pass,output}){
 const bucket='wealth-documents',pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'),sha=createHash('sha256').update(pdf).digest('hex')
 const command=(op,input)=>a.db.rpc('manage_wealth_document',{p_operation:op,p_input:input})
 const input=(id,version,extra={})=>({id,version,idempotency_key:randomUUID(),confirmed:'yes',...extra})
 const reserve=(extra={})=>({id:randomUUID(),idempotency_key:randomUUID(),confirmed:'yes',title:'Cofre API QA',category:'receipt',document_date:'2024-02-29',notes:'Synthetic only',links:[],mime_type:'application/pdf',size_bytes:pdf.length,sha256:sha,...extra})
 await grant(a,{...active,permissions:['wealth.read','wealth.write','wealth.export']})
 const reserved=reserve(),id=ok(await command('reserve',reserved)),path=`${a.id}/${id}/document`
 assert.equal(ok(await command('reserve',reserved)),id);assert.ok((await command('reserve',{...reserved,title:'changed'})).error)
 assert.ok((await b.db.storage.from(bucket).upload(path,pdf,{contentType:'application/pdf'})).error)
 const upload=await a.db.storage.from(bucket).upload(path,pdf,{contentType:'application/pdf',upsert:false,cacheControl:'0'});assert.equal(upload.error,null,'Storage upload: '+upload.error?.message)
 assert.ok((await a.db.storage.from(bucket).download(path)).error)
 ok(await command('finalize',input(id,1)))
 const downloaded=await a.db.storage.from(bucket).download(path);assert.equal(downloaded.error,null,'Storage active download: '+downloaded.error?.message);assert.equal(Buffer.from(await downloaded.data.arrayBuffer()).toString(),pdf.toString())
 assert.ok((await a.db.storage.from(bucket).upload(path,pdf,{contentType:'application/pdf',upsert:true})).error)
 for(const db of [a.db,b.db]){assert.ok((await db.storage.from(bucket).createSignedUrl(path,60)).error);assert.deepEqual(ok(await db.storage.from(bucket).list(a.id)),[])}
 assert.ok((await b.db.storage.from(bucket).download(path)).error);assert.deepEqual(ok(await b.db.from('wealth_documents').select('id')),[])
 assert.ok((await a.db.from('wealth_documents').update({title:'bypass'}).eq('id',id)).error)
 pass('documents-real-private-Storage-owner-RLS-no-sign-list-upsert-and-replay')
 const fields={title:'CAS winner',category:'receipt',document_date:null,notes:'',links:[]}
 const racing=await Promise.all([command('edit',input(id,2,fields)),command('edit',input(id,2,{...fields,title:'Other winner'}))]);assert.equal(racing.filter(r=>!r.error).length,1);assert.equal(racing.find(r=>r.error).error.code,'PT409')
 for(const permissions of [[],['wealth.write'],['wealth.read']]){
  await grant(a,{...active,permissions});assert.ok((await command('reserve',reserve())).error)
  const down=await a.db.storage.from(bucket).download(path);assert.equal(Boolean(down.error),!permissions.includes('wealth.read'))
 }
 await grant(a,{...active,status:'revoked'});assert.ok((await a.db.storage.from(bucket).download(path)).error)
 await grant(a,active)
 pass('documents-real-CAS-concurrency-and-entitlement-revocation')
 await page.goto(`${appUrl}/apps/wealth/documentos`);await page.getByText('Guardar um documento',{exact:true}).click()
 const form=page.locator('form').filter({has:page.locator('input[name=file]')})
 await form.getByLabel('Título do documento').fill('Contrato pessoal QA');await form.locator('select[name=category]').selectOption('contract');await form.getByLabel('Observações').fill('Documento sintético para validar o cofre.')
 await form.locator('input[name=file]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf});await form.getByRole('checkbox').check()
 let uploadRequest;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/wealth/documents')uploadRequest=r})
 const uploaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/wealth/documents'&&r.request().method()==='POST');await form.getByRole('button',{name:'Guardar documento',exact:true}).click();const uploadResponse=await uploaded;assert.equal(uploadResponse.status(),200,'Upload route: '+(await uploadResponse.json()).message);await form.getByRole('status').filter({hasText:'Documento guardado'}).waitFor()
 const saved=ok(await a.db.from('wealth_documents').select('*').eq('title','Contrato pessoal QA').single()),url=`${appUrl}/apps/wealth/documentos/${saved.id}`,download=`${appUrl}/api/wealth/documents/${saved.id}`
 assert.equal(saved.sha256,sha);assert.equal(saved.user_id,a.id)
 const headers={'content-type':uploadRequest.headers()['content-type'],origin:appUrl},body=uploadRequest.postDataBuffer()
 const replay=await context.request.post(`${appUrl}/api/wealth/documents`,{headers,data:body});assert.equal(replay.status(),200)
 assert.equal((await anonymous.request.post(`${appUrl}/api/wealth/documents`,{headers,data:body})).status(),403)
 assert.equal((await context.request.post(`${appUrl}/api/wealth/documents`,{headers:{...headers,origin:'https://invalid.example'},data:body})).status(),403)
 const invalid=await context.request.post(`${appUrl}/api/wealth/documents`,{headers:{origin:appUrl},multipart:{title:'bad',category:'other',confirmed:'yes',id:randomUUID(),idempotency_key:randomUUID(),finish_token:randomUUID(),file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('<script>evil</script>')}}});assert.equal(invalid.status(),400)
 const huge=await context.request.post(`${appUrl}/api/wealth/documents`,{headers:{origin:appUrl,'content-type':'application/octet-stream'},data:Buffer.alloc(3145728+32769)});assert.equal(huge.status(),413)
 const response=await context.request.get(download);assert.equal(response.status(),200);assert.match(response.headers()['content-disposition'],/^attachment/);assert.match(response.headers()['cache-control'],/no-store/);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),sha)
 assert.equal((await other.context.request.get(download)).status(),404);assert.equal((await anonymous.request.get(download)).status(),403)
 pass('documents-upload-route-signature-size-CSRF-idempotency-and-authenticated-download')
 await page.goto(url);await page.getByText('Editar informações',{exact:true}).click()
 const edit=page.locator('form').filter({has:page.locator('input[name=operation][value=edit]')})
 const stale=await context.newPage();await stale.goto(url);await stale.getByText('Editar informações',{exact:true}).click()
 await edit.getByLabel('Título do documento').fill('Contrato organizado QA');await edit.getByRole('checkbox').check();await edit.getByRole('button',{name:'Salvar informações'}).click();await edit.getByRole('status').filter({hasText:'Informações atualizadas'}).waitFor()
 const staleEdit=stale.locator('form').filter({has:stale.locator('input[name=operation][value=edit]')});await staleEdit.getByRole('checkbox').check();await staleEdit.getByRole('button',{name:'Salvar informações'}).click();await staleEdit.getByRole('status').filter({hasText:'mudou'}).waitFor();await stale.close()
 await grant(a,{...active,permissions:['wealth.read']});await edit.getByRole('checkbox').check();await edit.getByRole('button',{name:'Salvar informações'}).click();await edit.getByRole('status').filter({hasText:'Acesso negado'}).waitFor();await page.reload();assert.equal(await page.getByText('Editar informações',{exact:true}).count(),0)
 await grant(a,{...active,status:'revoked'});assert.equal((await context.request.get(download)).status(),403);await grant(a,active)
 pass('documents-Server-Actions-stale-version-read-only-and-download-revocation')
 for(const [name,target] of [['vault',`${appUrl}/apps/wealth/documentos`],['document',url]]){
  await page.goto(target);await page.getByText(name==='vault'?'Guardar um documento':'Editar informações',{exact:true}).click()
  for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme,reducedMotion:'reduce'});for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow ${width} ${colorScheme}`)
   if([320,1440].includes(width)){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
   await page.screenshot({path:`${output}/${name}-${colorScheme}-${width}.png`,fullPage:true})
  }}
 }
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body))
 pass('documents-six-widths-two-themes-Axe-keyboard-and-reduced-motion')
 await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:1440,height:1000})
 await page.goto(url);await page.getByText('Remover do cofre',{exact:true}).click();const remove=page.locator('form').filter({has:page.locator('input[name=operation][value=delete]')});await remove.getByRole('checkbox').check();await remove.getByRole('button',{name:'Remover documento'}).click();await page.getByRole('heading',{name:'Documento removido',exact:true}).waitFor()
 assert.equal((await context.request.get(download)).status(),404);assert.ok((await a.db.storage.from(bucket).download(saved.object_path)).error)
 const before=ok(await a.db.from('wealth_documents').select('version').eq('id',id).single());ok(await command('delete_begin',input(id,before.version)))
 assert.ok((await a.db.storage.from(bucket).download(path)).error)
 assert.ok((await command('delete_finish',input(id,before.version+1))).error)
 await page.goto(`${appUrl}/apps/wealth/documentos/${id}`);await page.getByText('Retomar exclusão pendente',{exact:true}).click();const resume=page.locator('form').filter({has:page.locator('input[name=operation][value=delete]')});await resume.getByRole('checkbox').check();await resume.getByRole('button',{name:'Retomar exclusão',exact:true}).click();await page.getByRole('heading',{name:'Documento removido',exact:true}).waitFor()
 assert.deepEqual(ok(await admin.storage.from(bucket).list(a.id)),[])
 pass('documents-delete-and-recover-interrupted-Storage-cleanup-with-immediate-download-revocation')
}
