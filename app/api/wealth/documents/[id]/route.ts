import {createHash} from 'node:crypto'
import {documentAccess} from '@/lib/wealth/documents-server'
import {documentBucket,documentExtension} from '@/lib/wealth/documents'
import {uuid} from '@/lib/wealth/core'
export const runtime='nodejs'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}
 const identity=await documentAccess();if(!identity)return new Response('Acesso negado.',{status:403,headers})
 let id:string;try{id=uuid((await params).id)}catch{return new Response('Documento inválido.',{status:404,headers})}
 const {db,user}=identity,result=await db.from('wealth_documents').select('object_path,status,mime_type,size_bytes,sha256').eq('id',id).eq('user_id',user.id).eq('status','active').maybeSingle()
 if(result.error||!result.data)return new Response('Documento indisponível.',{status:404,headers})
 const file=await db.storage.from(documentBucket).download(result.data.object_path)
 if(file.error||!file.data)return new Response('Download indisponível.',{status:503,headers})
 const bytes=Buffer.from(await file.data.arrayBuffer())
 if(bytes.length!==result.data.size_bytes||createHash('sha256').update(bytes).digest('hex')!==result.data.sha256)return new Response('Integridade não confirmada. Remova o envio e envie novamente.',{status:409,headers})
 // Recheck after object retrieval to honor an access change during the download request.
 const still=await db.from('wealth_documents').select('id').eq('id',id).eq('status','active').maybeSingle()
 if(still.error||!still.data)return new Response('Acesso encerrado.',{status:403,headers})
 return new Response(bytes,{headers:{...headers,'Content-Type':result.data.mime_type,'Content-Disposition':`attachment; filename="documento-${id}.${documentExtension(result.data.mime_type)}"`}})
}
