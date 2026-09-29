'use server'
import {revalidatePath} from 'next/cache'
import {getEcosystemIdentity,getPersonalProductAccess} from '@/lib/ecosystem/server'
import {familyCommand,familyError} from '@/lib/wealth/family'
export type FamilyActionState={ok:boolean;message:string;invitation?:string}
export async function manageFamily(_state:FamilyActionState,form:FormData):Promise<FamilyActionState>{
 const identity=await getEcosystemIdentity();if(!identity||identity.mfaRequired)return {ok:false,message:'Acesso negado.'}
 try{
  const {operation,input}=familyCommand(form)
  if(!['disconnect','revoke'].includes(operation)){
   if(!(await getPersonalProductAccess('wealth','wealth.read')).allowed||(['invite','share'].includes(operation)&&!(await getPersonalProductAccess('wealth','wealth.write')).allowed))return {ok:false,message:'Acesso negado.'}
  }
  const result=await identity.db.rpc('manage_wealth_family',{p_operation:operation,p_input:input})
  if(result.error)return {ok:false,message:familyError(result.error.code)}
  revalidatePath('/apps/wealth/familia')
  return {ok:true,message:operation==='invite'?'Convite criado. Entregue o código à pessoa indicada; nenhum email foi enviado.':operation==='share'?'Acesso proposto. Aguardando aceite do destinatário.':operation==='join'?'Conexão aceita. Nenhum dado financeiro foi compartilhado.':operation==='accept'?'Compartilhamento aceito.': 'Acesso encerrado para novas leituras.',...(operation==='invite'?{invitation:`${input.id}.${input.code}`}:{})}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Não foi possível concluir.'}}
}
