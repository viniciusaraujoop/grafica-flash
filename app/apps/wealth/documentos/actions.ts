'use server'
import {revalidatePath} from 'next/cache'
import {randomUUID} from 'node:crypto'
import {documentAccess,documentMetadata,documentCommand} from '@/lib/wealth/documents-server'
import {documentBucket,documentError} from '@/lib/wealth/documents'
export type DocumentActionState={ok:boolean;message:string}
export async function manageDocument(_state:DocumentActionState,form:FormData):Promise<DocumentActionState>{
 const identity=await documentAccess(true);if(!identity)return {ok:false,message:'Acesso negado.'}
 try{
  const operation=String(form.get('operation')),input=documentCommand(form),{db,user}=identity
  if(!['edit','delete'].includes(operation))throw Error('Ação inválida.')
  const first=await db.rpc('manage_wealth_document',{p_operation:operation==='edit'?'edit':'delete_begin',p_input:operation==='edit'?{...input,...documentMetadata(form)}:input})
  if(first.error)return {ok:false,message:documentError(first.error.code)}
  if(operation==='delete'){
   const current=await db.from('wealth_documents').select('object_path,version,status').eq('id',input.id).eq('user_id',user.id).single()
   if(current.error)throw Error('Não foi possível confirmar a exclusão.')
   if(current.data.status!=='deleted'){
    const removed=await db.storage.from(documentBucket).remove([current.data.object_path])
    if(removed.error)throw Error('O acesso foi encerrado; a remoção do arquivo está pendente. Use Retomar exclusão.')
    const final=await db.rpc('manage_wealth_document',{p_operation:'delete_finish',p_input:{id:input.id,version:current.data.version,idempotency_key:randomUUID(),confirmed:'yes'}})
    if(final.error)throw Error('A remoção ainda precisa ser confirmada. Use Retomar exclusão.')
   }
  }
  revalidatePath('/apps/wealth/documentos','layout')
  return {ok:true,message:operation==='edit'?'Informações atualizadas.':'Documento removido do cofre.'}
 }catch(error){revalidatePath('/apps/wealth/documentos','layout');return {ok:false,message:error instanceof Error?error.message:'Não foi possível concluir.'}}
}
