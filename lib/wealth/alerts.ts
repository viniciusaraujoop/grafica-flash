import {financialDate,integer,uuid} from './core'

export const alertSources={
 recurrence:'Recorrências',debt:'Dívidas',goal:'Metas',vault:'Vault',
 shield:'Shield',portfolio:'Portfolio',tax:'Tax',automation:'Automações'
} as const
export const alertPriorities={info:'Informativo',attention:'Atenção',urgent:'Urgente'} as const
export const alertViews={active:'Ativos',snoozed:'Adiados',dismissed:'Dispensados',muted:'Silenciados',all:'Todos'} as const
export type AlertSource=keyof typeof alertSources
export type AlertPriority=keyof typeof alertPriorities
export type AlertView=keyof typeof alertViews
export type WealthAlert={
 alert_key:string;priority:AlertPriority;source:AlertSource;reason:string;entity_id:string;
 title:string;detail:string;deep_link:string;event_date:string|null;state:AlertView|'muted';
 notification_eligible:boolean;cooldown_until:string|null;snoozed_until:string|null;dismissed_at:string|null
}
export type WealthAlertsOverview={
 date:string;timezone:string;
 preferences:{enabled:boolean;minimum_priority:AlertPriority;cooldown_hours:number;muted_sources:AlertSource[];version:number};
 summary:{active:string;urgent:string;attention:string;snoozed:string;dismissed:string;muted:string};
 source_coverage:Record<AlertSource,'ACTIVE'>;view:AlertView;count:string;alerts:WealthAlert[]
}
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const count=(v:unknown)=>typeof v==='string'&&/^\d{1,60}$/.test(v)
export function readAlertsOverview(value:unknown):WealthAlertsOverview{
 if(!obj(value))throw Error('Alertas indisponíveis.')
 const v=value as unknown as WealthAlertsOverview
 financialDate(v.date)
 if(typeof v.timezone!=='string'||!v.timezone||!Object.hasOwn(alertViews,v.view)||!obj(v.preferences)||!obj(v.summary)||!obj(v.source_coverage)||!Array.isArray(v.alerts))throw Error('Resumo de alertas inválido.')
 if(typeof v.preferences.enabled!=='boolean'||!Object.hasOwn(alertPriorities,v.preferences.minimum_priority)||!Number.isInteger(v.preferences.cooldown_hours)||v.preferences.cooldown_hours<1||v.preferences.cooldown_hours>720||!Number.isInteger(v.preferences.version)||v.preferences.version<0||!Array.isArray(v.preferences.muted_sources))throw Error('Preferências de alertas inválidas.')
 if(v.preferences.muted_sources.some(x=>!Object.hasOwn(alertSources,x)))throw Error('Fonte silenciada inválida.')
 for(const k of ['active','urgent','attention','snoozed','dismissed','muted'] as const)if(!count(v.summary[k]))throw Error('Contagem de alertas inválida.')
 for(const source of Object.keys(alertSources) as AlertSource[])if(v.source_coverage[source]!=='ACTIVE')throw Error('Cobertura de alertas inválida.')
 if(!count(v.count)||v.alerts.length>25)throw Error('Lista de alertas inválida.')
 for(const a of v.alerts){
  if(typeof a.alert_key!=='string'||!a.alert_key||a.alert_key.length>240||!Object.hasOwn(alertPriorities,a.priority)||!Object.hasOwn(alertSources,a.source)||typeof a.reason!=='string'||typeof a.entity_id!=='string'||typeof a.title!=='string'||typeof a.detail!=='string'||!a.deep_link.startsWith('/apps/wealth/')||typeof a.notification_eligible!=='boolean')throw Error('Alerta inválido.')
  if(a.event_date!==null)financialDate(a.event_date)
  if(!['active','snoozed','dismissed','muted'].includes(a.state))throw Error('Estado de alerta inválido.')
 }
 return v
}
export function alertCommand(form:FormData){
 const operation=String(form.get('operation')??'')
 if(!['configure','dismiss','snooze','restore'].includes(operation)||form.get('confirmed')!=='yes')throw Error('Confira e confirme a ação.')
 const input:Record<string,unknown>={idempotency_key:uuid(form.get('idempotency_key')),confirmed:'yes'}
 if(operation==='configure'){
  const priority=String(form.get('minimum_priority')??''),cooldown=integer(form.get('cooldown_hours'),1,720)
  if(!Object.hasOwn(alertPriorities,priority)||![1,6,12,24,48,72,168,720].includes(cooldown))throw Error('Preferências inválidas.')
  const muted=form.getAll('muted_source').map(String)
  if(muted.some(x=>!Object.hasOwn(alertSources,x))||new Set(muted).size!==muted.length)throw Error('Fontes silenciadas inválidas.')
  Object.assign(input,{version:integer(form.get('version'),0,Number.MAX_SAFE_INTEGER),enabled:form.get('enabled')==='yes',minimum_priority:priority,cooldown_hours:cooldown,muted_sources:muted})
 }else{
  const key=String(form.get('alert_key')??'');if(!key||key.length>240)throw Error('Alerta inválido.')
  input.alert_key=key
  if(operation==='snooze'){const hours=integer(form.get('snooze_hours'),1,720);if(![1,6,24,72,168,720].includes(hours))throw Error('Período de adiamento inválido.');input.snooze_hours=hours}
 }
 return {operation,input}
}
export function alertError(code?:string){
 return code==='PT409'?'O alerta mudou ou não está mais ativo. Atualize a página.':code==='23505'?'Este comando já foi usado. Atualize a página antes de repetir.':code==='54000'?'O limite de estados de alerta foi atingido.':'Não foi possível concluir. Confira o acesso e tente novamente.'
}
