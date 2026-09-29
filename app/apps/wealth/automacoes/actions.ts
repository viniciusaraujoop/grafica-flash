'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {automationCommand,automationError,type AutomationResult} from '@/lib/wealth/automation'
export type AutomationActionState={ok:boolean;message:string}
export async function manageAutomation(_state:AutomationActionState,form:FormData):Promise<AutomationActionState>{
 const access=await getPersonalProductAccess('wealth','wealth.read');if(!access.allowed||!access.identity||!(await getPersonalProductAccess('wealth','wealth.write')).allowed)return {ok:false,message:'Acesso negado.'}
 try{
  const {operation,input}=automationCommand(form),r=await access.identity.db.rpc('manage_wealth_automation',{p_operation:operation,p_input:input})
  if(r.error)return {ok:false,message:automationError(r.error.code)}
  const result=r.data as AutomationResult
  for(const path of ['/apps/wealth/automacoes','/apps/wealth/recorrencias','/apps/wealth/lancamentos','/apps/wealth/calendario','/apps/wealth/timeline','/apps/wealth'])revalidatePath(path)
  return {ok:true,message:operation==='run'?`${result.generated??0} lançamento(s) declarado(s) gerado(s); ${result.retrying??0} em nova tentativa; ${result.needs_attention??0} precisa(m) de revisão.`:operation==='configure'?'Preferências salvas.':operation==='retry'?'Nova tentativa autorizada. Execute o lote ou aguarde um executor ativo.':'Agendamento atualizado.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Não foi possível concluir.'}}
}
