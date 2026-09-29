'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {integer,uuid} from '@/lib/wealth/core'
import {classLabels,liquidityLabels} from '@/lib/wealth/net-worth'
import type {WealthActionState} from '@/app/apps/wealth/actions'

export async function manageNetWorth(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return {ok:false,message:'Sua sessão ou permissão não permite alterar o patrimônio.'}
 try{
  let result
  if(form.get('operation')==='capture'){
   if(form.get('confirmed')!=='yes')throw Error('Confirme que deseja registrar os valores atuais.')
   result=await read.identity.db.rpc('capture_wealth_net_worth',{p_idempotency_key:uuid(form.get('idempotency_key'))})
  }else if(form.get('operation')==='classify'){
   const classification=String(form.get('position_class')),liquidity=String(form.get('liquidity'))
   if(!Object.hasOwn(classLabels,classification)||!Object.hasOwn(liquidityLabels,liquidity))throw Error('Classificação inválida.')
   result=await read.identity.db.rpc('classify_wealth_position',{p_entry_id:uuid(form.get('entry_id')),p_version:integer(form.get('version'),1,Number.MAX_SAFE_INTEGER),p_class:classification,p_liquidity:liquidity})
  }else throw Error('Operação inválida.')
  if(result.error||!result.data)return {ok:false,message:result.error?.code==='PT409'?'O registro mudou ou está indisponível. Reabra a versão atual.':'Não foi possível confirmar a alteração. Confira os dados e tente novamente.'}
  revalidatePath('/apps/wealth','layout')
  return {ok:true,message:form.get('operation')==='capture'?'Snapshot registrado com os valores atuais.':'Classificação salva.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
}
