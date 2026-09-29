'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {financialDate,integer,parseMoney,title,uuid} from '@/lib/wealth/core'
import type {WealthActionState} from '../actions'
export async function savePlanning(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return {ok:false,message:'Sua sessão ou permissão não permite esta alteração.'}
 try{
  if(form.get('confirmed')!=='yes')throw Error('Confirme que os valores são de planejamento.')
  const s=(key:string)=>String(form.get(key)??'').trim(),operation=s('operation')
  const input:Record<string,unknown>={idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes',notes:s('notes')}
  if(s('id')){input.id=uuid(s('id'));input.version=integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)}
  const links=[]
  for(let i=0;i<20;i++){
   const source=s(`source_${i}`);if(!source)continue
   const [kind,id]=source.split('|')
   links.push({kind,id:id?uuid(id):null,...(operation==='funding'?{planned_cents:String(parseMoney(s(`planned_${i}`)||'0'))}:{})})
  }
  if(operation==='funding'){input.priority=s('priority');input.category=s('category');input.sources=links}
  else if(operation==='life'){
   input.title=title(form.get('title'));input.target_date=financialDate(form.get('target_date'));input.impact_months=integer(form.get('impact_months'),0,600)
   for(const field of ['event_type','scenario','status','assumptions'])input[field]=s(field)
   for(const field of ['upfront','monthly_impact','current_funding','monthly_capacity','reserve_draw'])input[`${field}_cents`]=String(parseMoney(s(field)||'0'))
   input.reserve_cents=s('reserve')?String(parseMoney(s('reserve'))):null;input.links=links
  }else throw Error('Operação inválida.')
  const result=await read.identity.db.rpc('manage_wealth_planning',{p_operation:operation,p_input:input})
  if(result.error||!result.data)return {ok:false,message:result.error?.code==='PT409'?'O registro mudou. Reabra a versão atual.':result.error?.code==='23505'?'Este comando já foi usado. Reabra a página para outro comando.':'Não foi possível salvar. Confira fontes, valores, datas e permissões.'}
  revalidatePath('/apps/wealth','layout')
  return {ok:true,message:'Planejamento salvo. Nenhum saldo ou pagamento foi alterado.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
}
