'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {protectionCommand} from '@/lib/wealth/shield'
export type ShieldActionState={ok:boolean;message:string;id?:string}
export async function manageProtection(_state:ShieldActionState,form:FormData):Promise<ShieldActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return {ok:false,message:'Sua sessão ou permissão não permite alterar este registro.'}
 try{
  const {operation,input}=protectionCommand(form),r=await read.identity.db.rpc('manage_wealth_protection',{p_operation:operation,p_input:input})
  if(r.error||!r.data)return {ok:false,message:r.error?.code==='PT409'?'O registro mudou. Reabra a versão atual antes de editar.':r.error?.code==='23505'?'Este comando já foi usado com outros dados. Reabra a página.':r.error?.code==='54000'?'O limite de 1.000 registros foi atingido.':'Não foi possível salvar. Confira os vínculos, os campos e sua permissão.'}
  revalidatePath('/apps/wealth/shield')
  return {ok:true,message:operation==='save'?'Declaração salva. Nenhuma contratação ou cobrança foi realizada.':operation==='archive'?'Registro arquivado. Isso não cancela o seguro ou a recorrência.':'Registro restaurado. Nenhuma cobertura foi confirmada.',id:r.data}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
}
