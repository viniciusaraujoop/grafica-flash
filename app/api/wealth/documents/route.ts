import {createHash} from 'node:crypto'
import {NextRequest} from 'next/server'
import {revalidatePath} from 'next/cache'
import {documentAccess,documentMetadata} from '@/lib/wealth/documents-server'
import {documentBucket,documentMaxBytes,documentMime,documentError} from '@/lib/wealth/documents'
import {uuid} from '@/lib/wealth/core'
export const runtime='nodejs'
const reply=(message:string,status=400,id?:string)=>Response.json({message,id},{status,headers:{'Cache-Control':'no-store'}})
export async function POST(request:NextRequest){
 // Exact origin and bounded streaming apply before multipart parsing.
 // Next's internal URL can use localhost behind its proxy. Compare the browser origin
 // against Host (browser-controlled forbidden header), as Server Actions do.
 let origin:URL;try{origin=new URL(request.headers.get('origin')??'')}catch{return reply('Origem inválida.',403)}
 if(!['https:','http:'].includes(origin.protocol)||origin.host!==request.headers.get('host'))return reply('Origem inválida.',403)
 const identity=await documentAccess(true);if(!identity)return reply('Acesso negado.',403)
 const max=documentMaxBytes+32768,reader=request.body?.getReader();if(!reader)return reply('Arquivo ausente.')
 const chunks:Uint8Array[]=[];let size=0
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return reply('Envio excede 3 MiB.',413)}chunks.push(value)}
  const body=Buffer.concat(chunks),form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData()
  if(form.get('confirmed')!=='yes')return reply('Confirme que você pode armazenar este documento.')
  const file=form.get('file');if(!(file instanceof File))return reply('Selecione um arquivo.')
  const bytes=Buffer.from(await file.arrayBuffer()),mime=documentMime(bytes),sha=createHash('sha256').update(bytes).digest('hex')
  if(file.type&&file.type!==mime)return reply('O tipo informado não corresponde ao arquivo.')
  const id=uuid(form.get('id')),token=uuid(form.get('idempotency_key')),finish=uuid(form.get('finish_token'))
  const {db,user}=identity,payload={...documentMetadata(form),id,idempotency_key:token,confirmed:'yes',mime_type:mime,size_bytes:bytes.length,sha256:sha}
  const reserved=await db.rpc('manage_wealth_document',{p_operation:'reserve',p_input:payload})
  if(reserved.error)return reply(documentError(reserved.error.code),reserved.error.code==='PT409'?409:400)
  const current=await db.from('wealth_documents').select('status,version,sha256').eq('id',id).eq('user_id',user.id).single()
  if(current.error||current.data.sha256!==sha)return reply('Envio indisponível.',409)
  if(current.data.status==='active')return reply('Documento já disponível.',200,id)
  if(current.data.status!=='pending')return reply('Envio encerrado.',409)
  const upload=await db.storage.from(documentBucket).upload(`${user.id}/${id}/document`,bytes,{contentType:mime,upsert:false,cacheControl:'0'})
  // A retry can encounter the same immutable blob after a lost response. Finalize verifies metadata.
  if(upload.error&&!['409','Duplicate'].includes(String(upload.error.statusCode))){return reply('Envio não concluído. Tente novamente com o mesmo arquivo ou remova o envio incompleto.',503,id)}
  const completed=await db.rpc('manage_wealth_document',{p_operation:'finalize',p_input:{id,version:current.data.version,idempotency_key:finish,confirmed:'yes'}})
  if(completed.error)return reply('Arquivo recebido; confirmação pendente. Repita o envio ou remova o registro incompleto.',409,id)
  revalidatePath('/apps/wealth/documentos');return reply('Documento guardado no seu cofre pessoal.',200,id)
 }catch(error){return reply(error instanceof Error&&error.message.length<180?error.message:'Não foi possível processar o arquivo.')}
}
