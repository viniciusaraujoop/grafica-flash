'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {parseMoney,integer,financialDate,title,uuid} from '@/lib/wealth/core'
import type {WealthActionState} from '@/app/apps/wealth/actions'

export async function manageWealthDebt(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return {ok:false,message:'Sua sessão ou permissão não permite alterar dívidas.'}
 try{
  if(form.get('confirmed')!=='yes')throw Error('Confirme que os dados são uma declaração pessoal.')
  const id=form.get('entry_id')?uuid(form.get('entry_id')):null
  const version=id?integer(form.get('version'),1,Number.MAX_SAFE_INTEGER):null
  const operation=form.get('operation')
  let result
  if(operation==='settle'){
   if(!id)throw Error('Dívida inválida.')
   result=await read.identity.db.rpc('settle_wealth_debt',{p_entry_id:id,p_version:version,p_confirmed:true})
  }else if(operation==='save'){
   const optionalInteger=(name:string)=>form.get(name)?integer(form.get(name),name==='installment_count'?1:0,1200):null
   const payload={title:title(form.get('title')),balance_cents:parseMoney(form.get('balance')),principal_cents:parseMoney(form.get('principal')),
    monthly_rate_bps:integer(parseMoney(form.get('monthly_rate')),0,10000),minimum_cents:parseMoney(form.get('minimum')),
    installment_count:optionalInteger('installment_count'),remaining_installments:optionalInteger('remaining_installments'),
    next_due_date:form.get('next_due_date')?financialDate(form.get('next_due_date')):null,priority:integer(form.get('priority'),1,1000),
    financial_date:financialDate(form.get('financial_date')),idempotency_key:id?undefined:uuid(form.get('idempotency_key')),confirmed:'yes'}
   if((payload.installment_count===null)!==(payload.remaining_installments===null)||(payload.remaining_installments??0)>(payload.installment_count??0))throw Error('Informe total e parcelas restantes juntos; restantes não podem superar o total.')
   result=await read.identity.db.rpc('save_wealth_debt',{p_input:payload,p_entry_id:id,p_version:version})
  }else throw Error('Operação inválida.')
  if(result.error)return {ok:false,message:result.error.code==='PT409'?'A dívida mudou em outra aba. Reabra a versão atual.':'Não foi possível salvar a dívida nesta conta. Confira os dados e tente novamente.'}
  if(!result.data)return {ok:false,message:'A dívida mudou em outra aba ou está indisponível. Reabra a versão atual.'}
  for(const path of ['/apps/wealth','/apps/wealth/dividas','/apps/wealth/lancamentos',...(id?[`/apps/wealth/dividas/${id}`,`/apps/wealth/lancamentos/${id}`]:[])])revalidatePath(path)
  return {ok:true,message:operation==='settle'?'Quitação declarada. O saldo registrado agora é zero. Nenhum pagamento foi executado.':'Dívida salva no seu espaço pessoal.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
}
