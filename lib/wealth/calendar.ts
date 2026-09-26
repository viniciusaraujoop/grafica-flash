import {financialDate,integer,uuid} from './core'
import type {WealthRecurrence} from './recurrence'

export const eventStates={REALIZED:'Registrado',SCHEDULED:'Agendado',RECURRING:'Recorrente',EXPECTED:'Previsto',HYPOTHETICAL:'Hipótese',OVERDUE:'Data vencida',CANCELLED:'Cancelado'} as const
export const eventSources={entry:'Lançamentos',recurrence:'Recorrências',debt:'Dívidas',goal:'Metas',holding:'Vencimentos de investimentos',portfolio:'Movimentos de carteira'} as const
export const calendarViews={month:'Mês',week:'Semana',agenda:'Agenda',upcoming:'Próximos',overdue:'Vencidos'} as const
export const billTypes={subscription:'Assinatura',utility:'Conta de consumo',rent:'Aluguel',salary:'Salário',installment:'Parcela',contribution:'Aporte planejado',income:'Receita recorrente',expense:'Despesa recorrente',renewal:'Renovação anual'} as const
export type FinancialEvent={event_id:string;source_id:string;source_type:keyof typeof eventSources;event_type:string;event_at:string;timezone:string;amount:string|null;currency:string;status:keyof typeof eventStates;certainty:'DECLARED'|'SCHEDULE'|'UNKNOWN';direction:'income'|'expense'|'neutral';title:string;portfolio_id:string|null;href:string;context:{scope:'personal';cash:boolean;recurring?:boolean;meaning?:string}}
export type CalendarResult={from:string;to:string;localDate:string;timezone:string;count:string;page:number;days:{date:string;count:string}[];events:FinancialEvent[]}
export type Bill=Omit<WealthRecurrence,'amount_cents'>&{amount_cents:string;bill_type:keyof typeof billTypes|null;provider:string|null;predecessor_id:string|null;detail_version:number;reviewed_at:string|null;price_change:string|null;previous_amount:string|null;duplicate_candidates:string;annual_amount:string;month_amount:string}
export type BillsResult={today:string;annualEnd:string;month:string;count:string;page:number;totals:{active:string;paused:string;cancelled:string;annualExpense:string;annualIncome:string;monthExpense:string;monthIncome:string};bills:Bill[]}
export type Search=Record<string,string|string[]|undefined>
export function single(input:Search,key:string,fallback=''){if(Array.isArray(input[key]))throw Error('Filtro repetido.');return input[key]??fallback}
export function addDays(date:string,days:number){return new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10)}
export function monthEnd(date:string){const d=new Date(`${date.slice(0,7)}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);return addDays(d.toISOString().slice(0,10),-1)}
export function parseCalendar(input:Search,today:string){
 const view=single(input,'view','month');if(!Object.hasOwn(calendarViews,view))throw Error('Visualização inválida.')
 const date=financialDate(single(input,'date',today)),page=integer(single(input,'page','1'),1,100000)
 const source=single(input,'source'),direction=single(input,'direction'),status=single(input,'status',view==='overdue'?'OVERDUE':''),portfolio=single(input,'portfolio')
 if(source&&!Object.hasOwn(eventSources,source)||direction&&!['income','expense','neutral'].includes(direction)||status&&!Object.hasOwn(eventStates,status))throw Error('Filtro inválido.')
 if(portfolio)uuid(portfolio)
 let from=date,to=date
 if(view==='month'){from=`${date.slice(0,7)}-01`;to=monthEnd(date)}
 else if(view==='week'){const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();from=addDays(date,-((weekday+6)%7));to=addDays(from,6)}
 else if(view==='overdue'){to=date<today?date:addDays(today,-1);from=addDays(to,-365)}
 else to=addDays(date,integer(single(input,'days','30'),1,366)-1)
 financialDate(from);financialDate(to)
 return {view:view as keyof typeof calendarViews,date,from,to,page,source,direction,status,portfolio,days:single(input,'days','30')}
}
export function readCalendar(value:unknown):CalendarResult{
 const r=value as CalendarResult
 if(!r||!/^\d+$/.test(r.count)||!Array.isArray(r.events)||r.events.length>50||!Array.isArray(r.days))throw Error('Resposta de calendário inválida.')
 for(const e of r.events)if(!Object.hasOwn(eventStates,e.status)||!Object.hasOwn(eventSources,e.source_type)||(e.amount!==null&&!/^\d+$/.test(e.amount))||!e.href.startsWith('/apps/wealth/'))throw Error('Evento inválido.')
 return r
}
export function readBills(value:unknown):BillsResult{
 const r=value as BillsResult
 if(!r||!/^\d+$/.test(r.count)||!Array.isArray(r.bills)||r.bills.length>25||!r.totals)throw Error('Resposta de contas inválida.')
 for(const b of r.bills)for(const k of ['amount_cents','annual_amount','month_amount'] as const)if(!/^\d+$/.test(b[k]))throw Error('Valor inválido.')
 return r
}
export function eventExplanation(e:FinancialEvent){
 if(e.context.meaning==='goal_gap')return 'Valor que falta para a meta; não é uma despesa.'
 if(e.context.meaning==='no_redemption_value')return 'Data declarada. Valor de resgate ainda desconhecido.'
 if(e.context.meaning==='declared_minimum')return 'Mínimo declarado da dívida; pagamento não confirmado.'
 if(e.context.meaning==='investment_ledger')return 'Registro da carteira; não gera lançamento de caixa.'
 if(e.source_type==='recurrence')return e.status==='CANCELLED'?'Próxima data que deixou de ser gerada.':'Previsão de lançamento às 12h no fuso indicado; não confirma pagamento.'
 return e.context.cash?'Lançamento declarado; não comprova movimentação bancária.':'Posição patrimonial declarada; não integra fluxo de caixa.'
}
