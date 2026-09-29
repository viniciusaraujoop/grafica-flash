import {createHash} from 'node:crypto'
import {documentAccess} from '@/lib/wealth/documents-server'
import {documentBucket,documentExtension} from '@/lib/wealth/documents'
import type {FamilyResource} from '@/lib/wealth/family'
import {uuid} from '@/lib/wealth/core'
export const runtime='nodejs'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}
 const identity=await documentAccess();if(!identity)return new Response('Acesso negado.',{status:403,headers})
 let id:string;try{id=uuid((await params).id)}catch{return new Response('Acesso indisponível.',{status:404,headers})}
 const {db}=identity,result=await db.rpc('read_wealth_family_share',{p_id:id}),d=result.data as FamilyResource|null
 if(result.error||!d?.object_path||!d.sha256||!d.mime_type||!d.size_bytes)return new Response('Acesso indisponível.',{status:404,headers})
 const file=await db.storage.from(documentBucket).download(d.object_path)
 if(file.error||!file.data)return new Response('Arquivo indisponível.',{status:404,headers})
 const bytes=Buffer.from(await file.data.arrayBuffer())
 if(bytes.length!==d.size_bytes||createHash('sha256').update(bytes).digest('hex')!==d.sha256)return new Response('Integridade não confirmada.',{status:409,headers})
 const current=await db.rpc('read_wealth_family_share',{p_id:id}),still=current.data as FamilyResource|null
 if(current.error||!still?.object_path||still.sha256!==d.sha256||still.object_path!==d.object_path)return new Response('Acesso encerrado.',{status:403,headers})
 return new Response(bytes,{headers:{...headers,'Content-Type':d.mime_type,'Content-Disposition':`attachment; filename="compartilhado-${id}.${documentExtension(d.mime_type)}"`}})
}
