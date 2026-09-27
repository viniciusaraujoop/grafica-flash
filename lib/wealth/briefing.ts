import { financialDate } from './core'

export type BriefingMode='morning'|'night'
export type BriefingStatus='info'|'attention'|'upcoming'
export type BriefingItem={
 priority:number;source:string;kind:string;title:string;observe:string;understand:string;
 action_label:string;href:string;amount_cents:string|null;event_date:string|null;status:BriefingStatus
}
export type DailyBriefing={
 mode:BriefingMode;date:string;timezone:string;currency:'BRL';coverage:'DECLARED_WEALTH_DATA_ONLY';
 market_provider_status:'NOT_CONFIGURED';bank_provider_status:'NOT_CONFIGURED';generated_from:'CURRENT_READ_MODEL';
 stats:{
  today_income:string;today_expenses:string;today_cash_flow:string;today_cash_records:string;
  overdue_recurrences:string;overdue_debts:string;tomorrow_items:string;next7_recurrences:string;
  next7_debts:string;active_goals:string;open_debts:string;unknown_valuations:string;tax_gaps:string
 };
 items:BriefingItem[]
}

const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const signed=(v:unknown)=>typeof v==='string'&&/^-?\d{1,60}$/.test(v)
const unsigned=(v:unknown)=>typeof v==='string'&&/^\d{1,60}$/.test(v)

export function briefingMode(value:unknown):BriefingMode{
 if(value==='morning'||value==='night')return value
 throw Error('Modo de briefing inválido.')
}

export function readDailyBriefing(value:unknown):DailyBriefing{
 if(!object(value))throw Error('Briefing indisponível.')
 const v=value as unknown as DailyBriefing
 briefingMode(v.mode);financialDate(v.date)
 if(typeof v.timezone!=='string'||!v.timezone||v.currency!=='BRL'||v.coverage!=='DECLARED_WEALTH_DATA_ONLY'||v.market_provider_status!=='NOT_CONFIGURED'||v.bank_provider_status!=='NOT_CONFIGURED'||v.generated_from!=='CURRENT_READ_MODEL')throw Error('Cobertura do briefing inválida.')
 if(!object(v.stats))throw Error('Resumo do briefing inválido.')
 for(const key of ['today_income','today_expenses','today_cash_records','overdue_recurrences','overdue_debts','tomorrow_items','next7_recurrences','next7_debts','active_goals','open_debts','unknown_valuations','tax_gaps'] as const)if(!unsigned(v.stats[key]))throw Error('Contagem do briefing inválida.')
 if(!signed(v.stats.today_cash_flow))throw Error('Fluxo do briefing inválido.')
 if(!Array.isArray(v.items)||v.items.length>12)throw Error('Itens do briefing inválidos.')
 let last=-1
 for(const item of v.items){
  if(!Number.isInteger(item.priority)||item.priority<0||item.priority<last)throw Error('Prioridade do briefing inválida.')
  last=item.priority
  if(typeof item.source!=='string'||typeof item.kind!=='string'||typeof item.title!=='string'||typeof item.observe!=='string'||typeof item.understand!=='string'||typeof item.action_label!=='string')throw Error('Item do briefing inválido.')
  if(!item.href.startsWith('/apps/wealth/'))throw Error('Ação do briefing fora do Wealth.')
  if(item.amount_cents!==null&&!signed(item.amount_cents))throw Error('Valor do briefing inválido.')
  if(item.event_date!==null)financialDate(item.event_date)
  if(!['info','attention','upcoming'].includes(item.status))throw Error('Estado do briefing inválido.')
 }
 return v
}
