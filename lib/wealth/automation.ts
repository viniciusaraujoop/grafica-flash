import {integer,uuid} from './core'
export const automationOperations={configure:'Preferências atualizadas',run:'Lote de recorrências',pause:'Agendamento pausado',resume:'Agendamento retomado',cancel:'Agendamento cancelado',retry:'Nova tentativa autorizada'}
export const automationJobStates={queued:'Na fila',running:'Em execução',completed:'Concluído',failed:'Falhou',retrying:'Aguardando nova tentativa',needs_attention:'Precisa de revisão'}
export type AutomationJob={id:string;status:keyof typeof automationJobStates;attempts:number;max_attempts:number;run_after:string;can_retry:boolean}
export type AutomationSchedule={id:string;title:string;status:'active'|'paused'|'completed'|'cancelled';version:number;next_date:string;timezone:string;pause_reason:string|null;job:AutomationJob|null}
export type AutomationResult={status:string;command_id:string;generated?:number;skipped?:number;retrying?:number;needs_attention?:number}
export type AutomationOverview={preferences:{history_days:number;show_inactive:boolean;version:number};days:number;clock:'ACTIVE'|'PAUSED'|'NOT_CONFIGURED';summary:{active:string;paused:string;closed:string;due:string;attention:string};schedules:AutomationSchedule[];commands:{id:string;operation:keyof typeof automationOperations;recorded_at:string;result:AutomationResult}[];occurrences:{schedule_id:string;occurrence_index:number;financial_date:string;created_at:string;title:string;entry_id:string|null}[];schedule_count:string;command_count:string;occurrence_count:string}
export function automationCommand(form:FormData){
 const operation=String(form.get('operation')??'')
 if(!Object.hasOwn(automationOperations,operation)||form.get('confirmed')!=='yes')throw Error('Confira e confirme a ação.')
 const input:Record<string,string|number|boolean>={idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes'}
 if(operation==='configure'){
  const days=integer(form.get('history_days'),7,365);if(![7,30,90,365].includes(days))throw Error('Período inválido.')
  Object.assign(input,{version:integer(form.get('version'),0,Number.MAX_SAFE_INTEGER),history_days:days,show_inactive:form.get('show_inactive')==='yes'})
 }else if(operation!=='run'){
  input.id=uuid(form.get('id'));if(operation==='retry')input.attempts=integer(form.get('attempts'),0,24);else input.version=integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)
 }
 return {operation,input}
}
export function automationError(code?:string){return code==='PT409'?'O estado mudou ou a ação não está mais disponível. Atualize a página antes de repetir.':code==='23505'?'Este comando já foi usado. Atualize a página para uma nova ação.':code==='54000'?'O limite de tentativas foi atingido. Revise o agendamento antes de continuar.':'Não foi possível concluir. Confira o acesso e tente novamente.'}
