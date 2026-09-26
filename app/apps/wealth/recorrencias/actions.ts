'use server'
import {revalidatePath} from 'next/cache'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {financialDate,integer,uuid,validateEntry} from '@/lib/wealth/core'
import {recurrenceFrequencies} from '@/lib/wealth/recurrence'
import type {WealthActionState} from '../actions'

export async function manageWealthRecurrence(_state:WealthActionState,form:FormData):Promise<WealthActionState>{
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!write.allowed||!read.identity)return {ok:false,message:'Sua sessão ou permissão não permite alterar recorrências.'}
 if(form.get('confirmed')!=='yes')return {ok:false,message:'Confirme a operação para continuar.'}
 const db=read.identity.db,operation=form.get('operation')
 let message:string
 try{
  if(operation==='create'){
   const entry=validateEntry({...Object.fromEntries(form),recurrence:'none',financial_date:form.get('start_date')})
   if(!['income','expense'].includes(entry.kind))throw Error('Recorrências aceitam receitas e despesas.')
   const frequency=String(form.get('frequency')),timezone=String(form.get('timezone'))
   if(!Object.hasOwn(recurrenceFrequencies,frequency))throw Error('Frequência inválida.')
   try{new Intl.DateTimeFormat('pt-BR',{timeZone:timezone}).format(0)}catch{throw Error('Fuso horário inválido.')}
   const endDate=form.get('end_date')?financialDate(form.get('end_date')):null
   if(endDate&&endDate<entry.financial_date)throw Error('A data final precisa ser igual ou posterior à inicial.')
   const result=await db.rpc('create_wealth_recurrence',{p_input:{
    title:entry.title,kind:entry.kind,category:entry.category,amount_cents:entry.amount_cents,frequency,
    interval_count:integer(form.get('interval_count'),1,36),start_date:entry.financial_date,end_date:endDate,
    max_occurrences:form.get('max_occurrences')?integer(form.get('max_occurrences'),1,1200):null,
    timezone,idempotency_key:entry.idempotency_key,confirmed:'yes',
   }})
   if(result.error)return {ok:false,message:result.error.code==='23505'?'Este envio já foi usado com outros valores. Reabra a página.':'Não foi possível criar o agendamento. Confira os campos e tente novamente.'}
   message='Agendamento salvo. Atualize os lançamentos vencidos para registrar as ocorrências.'
  }else if(operation==='run'){
   const result=await db.rpc('run_my_wealth_recurrences')
   if(result.error||!result.data||typeof result.data!=='object')return {ok:false,message:'Não foi possível atualizar as pendências agora.'}
   const count=integer(result.data.generated,0,10)
   message=`${count} lançamento(s) gerado(s). ${integer(result.data.retrying,0,10)} pendência(s) aguardando nova tentativa; ${integer(result.data.needs_attention,0,10)} precisa(m) de revisão.`
  }else{
   if(!['pause','resume','cancel'].includes(String(operation)))throw Error('Operação inválida.')
   const result=await db.rpc('change_wealth_recurrence',{p_id:uuid(form.get('record_id')),p_version:integer(form.get('version'),1,Number.MAX_SAFE_INTEGER),p_operation:operation})
   if(result.error)return {ok:false,message:'Não foi possível confirmar a alteração.'}
   if(result.data!==true)return {ok:false,message:'Agendamento indisponível ou alterado em outra aba. Reabra a página.'}
   message=operation==='pause'?'Agendamento pausado.':operation==='resume'?'Agendamento retomado, incluindo datas vencidas.':'Agendamento cancelado. Lançamentos anteriores foram preservados.'
  }
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Confira os campos.'}}
 for(const path of ['/apps/wealth','/apps/wealth/lancamentos','/apps/wealth/recorrencias'])revalidatePath(path)
 return {ok:true,message}
}
