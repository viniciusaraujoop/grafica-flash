'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {integer,uuid} from '@/lib/wealth/core'
import {billTypes} from '@/lib/wealth/calendar'
import type {WealthActionState} from '../actions'
export async function saveBillDetails(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!write.allowed||!read.identity)return {ok:false,message:'Sua sessão ou permissão não permite revisar contas.'}
 try{
  if(form.get('confirmed')!=='yes')throw Error('Confirme a revisão.')
  const type=String(form.get('bill_type')),provider=String(form.get('provider')||'').trim()
  if(!Object.hasOwn(billTypes,type)||provider.length>120)throw Error('Confira a classificação e o fornecedor.')
  const result=await read.identity.db.rpc('save_wealth_bill',{p_id:uuid(form.get('id')),p_version:integer(form.get('version'),0,Number.MAX_SAFE_INTEGER),p_type:type,p_provider:provider,p_predecessor:form.get('predecessor')?uuid(form.get('predecessor')):null})
  if(result.error)return {ok:false,message:result.error.code==='PT409'?'A revisão mudou em outra aba. Reabra a página.':result.error.code==='23505'?'A versão anterior já está vinculada a outra conta.':'Não foi possível salvar. Confira se a versão anterior é sua, está cancelada, é mais antiga e tem a mesma frequência e movimento.'}
 }catch(e){return {ok:false,message:e instanceof Error?e.message:'Confira os campos.'}}
 revalidatePath('/apps/wealth/recorrencias');revalidatePath('/apps/wealth/calendario')
 return {ok:true,message:'Revisão salva. Nenhum valor ou agendamento foi alterado.'}
}
