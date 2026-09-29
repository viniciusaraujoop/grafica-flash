'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {financialDate,parseMoney,uuid,integer,title} from '@/lib/wealth/core'
import {assetClasses} from '@/lib/wealth/net-worth'
import {quantity} from '@/lib/wealth/portfolio'
import type {WealthActionState} from '@/app/apps/wealth/actions'

export async function managePortfolio(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return {ok:false,message:'Sua sessão ou permissão não permite alterar carteiras.'}
 try{
  if(form.get('confirmed')!=='yes')throw Error('Confirme os dados antes de salvar.')
  const operation=String(form.get('operation')),s=(key:string)=>String(form.get(key)??'').trim()
  const input:Record<string,unknown>={confirmed:'yes',idempotency_key:uuid(form.get('idempotency_key'))}
  if(form.has('portfolio_id'))input.portfolio_id=uuid(form.get('portfolio_id'))
  if(form.has('holding_id'))input.holding_id=uuid(form.get('holding_id'))
  if(form.has('version'))input.version=integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)
  if(['create','configure'].includes(operation)){
   input.name=title(form.get('name'));input.kind=s('kind');input.goal_id=s('goal_id')?uuid(s('goal_id')):null
   const targets:Record<string,number>={},labs:{class:string;amount:string}[]=[]
   for(const key of Object.keys(assetClasses)){
    if(s(`target_${key}`))targets[key]=parseMoney(s(`target_${key}`))
    if(s(`lab_${key}`))labs.push({class:key,amount:String(parseMoney(s(`lab_${key}`)))})
   }
   if(Object.keys(targets).length&&Object.values(targets).reduce((a,b)=>a+b,0)!==10000)throw Error('Os percentuais devem somar 100%.')
   input.targets=targets;input.lab_positions=labs
  }else if(['holding','link','value','transaction'].includes(operation)){
   if(operation!=='link')input.financial_date=financialDate(form.get('financial_date'))
   if(operation!=='link')input.amount_cents=String(parseMoney(s('amount')))
   input.reference=s('reference');input.valuation_source=s('reference')
   if(['holding','link','transaction'].includes(operation))input.quantity=quantity(form.get('quantity'))
   if(['holding','link'].includes(operation)||s('type')==='adjustment')input.cost_basis_cents=s('cost_basis')?String(parseMoney(s('cost_basis'))):null
   if(['holding','link','value'].includes(operation)){
    for(const key of ['valuation_status','position_class','liquidity','issuer','sector','exposure_currency','maturity'])input[key]=s(key)||null
    if(s('maturity'))input.maturity=financialDate(s('maturity'))
    if(operation!=='value')input.instrument=title(form.get('instrument'))
    if(operation==='holding')input.title=title(form.get('title'))
    if(operation==='link'){const [id,version]=s('existing_entry').split('|');input.entry_id=uuid(id);input.version=integer(version,1,Number.MAX_SAFE_INTEGER)}
   }
   if(operation==='transaction'){
    input.type=s('type')
    if(s('destination')){const [id,version]=s('destination').split('|');input.destination_id=uuid(id);input.destination_version=integer(version,1,Number.MAX_SAFE_INTEGER)}
   }
  }else if(!['archive','restore'].includes(operation))throw Error('Operação inválida.')
  const result=await read.identity.db.rpc('manage_wealth_portfolio',{p_operation:operation,p_input:input})
  if(result.error||!result.data)return {ok:false,message:result.error?.code==='PT409'?'O registro mudou. Reabra a versão atual.':result.error?.code==='23505'?'Este comando já foi usado com outros dados. Reabra a página.':'Não foi possível salvar. Confira quantidade, saldo, origem e permissões.'}
  revalidatePath('/apps/wealth','layout')
  return {ok:true,message:'Registro confirmado. Os valores exibidos já refletem a alteração.'}
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
}
