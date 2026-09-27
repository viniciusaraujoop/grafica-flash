'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {alertCommand,alertError} from '@/lib/wealth/alerts'
export type AlertActionState={ok:boolean;message:string}
export async function manageAlert(_state:AlertActionState,form:FormData):Promise<AlertActionState>{
 const access=await getPersonalProductAccess('wealth','wealth.write')
 if(!access.allowed||!access.identity)return {ok:false,message:'Acesso de escrita indisponível.'}
 try{
  const {operation,input}=alertCommand(form)
  const result=await access.identity.db.rpc('manage_wealth_alerts',{p_operation:operation,p_input:input})
  if(result.error)return {ok:false,message:alertError(result.error.code)}
  revalidatePath('/apps/wealth/alertas')
  return {ok:true,message:operation==='configure'?'Preferências atualizadas.':operation==='dismiss'?'Alerta dispensado.':operation==='snooze'?'Alerta adiado.':'Alerta reativado.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Não foi possível concluir.'}}
}
