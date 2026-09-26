import {financialDate,integer,moneyLimit,type WealthGoal} from './core'

export const healthLabels={ON_TRACK:'No prazo planejado',SLIGHTLY_BEHIND:'Um aporte além do prazo',BEHIND:'Prazo precisa de revisão',AHEAD:'Pode chegar antes',NO_DATA:'Defina um aporte',COMPLETED:'Valor alcançado',PAUSED:'Meta pausada'} as const
export const sourceLabels={budget_surplus:'Sobra do orçamento',manual:'Aporte manual planejado',recurring:'Aporte recorrente',portfolio:'Carteira',income:'Receita pontual',goal:'Meta',debt:'Dívida'} as const
export const planningCategories={salary:'Renda',housing:'Moradia',food:'Alimentação',transport:'Transporte',education:'Educação',health:'Saúde',leisure:'Lazer',investment:'Investimento',property:'Bem',loan:'Dívida',other:'Outros'} as const
export const eventTypes={house:'Casa',car:'Carro',wedding:'Casamento',child:'Filho',education:'Educação',moving:'Mudança',business:'Abrir um negócio',retirement:'Aposentadoria',sabbatical:'Sabático',emergency:'Emergência',other:'Outro'} as const
export const scenarios={BASE:'Base',CONSERVATIVE:'Conservador',OPTIMISTIC:'Otimista',CUSTOM:'Personalizado'} as const
export const planStatuses={draft:'Rascunho',active:'Ativo',paused:'Pausado',completed:'Concluído',cancelled:'Cancelado'} as const
export type PlanningLink={kind:keyof typeof sourceLabels;id?:string|null;planned_cents?:string}
export type PlanningOption={kind:PlanningLink['kind'];id:string;title:string;href:string;amount:string|null}
export type GoalFunding={priority:'low'|'normal'|'high';category:string;sources:PlanningLink[];notes:string}
export type LifePlan={id:string;title:string;event_type:keyof typeof eventTypes;scenario:keyof typeof scenarios;status:keyof typeof planStatuses;target_date:string;upfront_cents:number;monthly_impact_cents:number;impact_months:number;current_funding_cents:number;monthly_capacity_cents:number;reserve_cents:number|null;reserve_draw_cents:number;links:PlanningLink[];assumptions:string;notes:string;version:number}

/** Same day next month, clamped to that month's end. No contribution is assumed today. */
export function contributionDate(anchor:string,months:number):string|null {
 financialDate(anchor);integer(months,0,3612)
 const [year,month,day]=anchor.split('-').map(Number)
 const end=new Date(Date.UTC(year,month-1+months+1,0)),date=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),Math.min(day,end.getUTCDate()))).toISOString().slice(0,10)
 return date>'2200-12-31'?null:date
}
export function availableMonths(today:string,target:string){
 financialDate(today);financialDate(target)
 if(target<=today)return 0
 const [y,m]=today.split('-').map(Number),[ty,tm]=target.split('-').map(Number)
 const approximate=(ty-y)*12+tm-m
 return Math.max(0,approximate-Number((contributionDate(today,approximate)||'9999-12-31')>target))
}
export function projectGoal(goal:Pick<WealthGoal,'target_cents'|'saved_cents'|'monthly_contribution_cents'|'target_date'|'status'>,today:string,alternative?:number){
 for(const n of [goal.target_cents,goal.saved_cents,goal.monthly_contribution_cents])integer(n,0,moneyLimit)
 const monthly=alternative===undefined?goal.monthly_contribution_cents:integer(alternative,0,moneyLimit)
 const remaining=BigInt(Math.max(0,goal.target_cents-goal.saved_cents)),slots=availableMonths(today,goal.target_date)
 const months=remaining===BigInt(0)?BigInt(0):monthly? (remaining+BigInt(monthly)-BigInt(1))/BigInt(monthly):null
 const projectedDate=months!==null&&months<=BigInt(3612)?contributionDate(today,Number(months)):null
 const required=remaining===BigInt(0)?BigInt(0):slots?(remaining+BigInt(slots)-BigInt(1))/BigInt(slots):null
 const health:keyof typeof healthLabels=goal.status==='paused'?'PAUSED':remaining===BigInt(0)?'COMPLETED':monthly===0?'NO_DATA':slots===0?'BEHIND':months!>BigInt(slots+1)?'BEHIND':months===BigInt(slots+1)?'SLIGHTLY_BEHIND':months!<BigInt(slots)?'AHEAD':'ON_TRACK'
 return {remaining:String(remaining),slots,months:months===null?null:String(months),projectedDate,required:required===null?null:String(required),health,monthly,
  explanation:health==='PAUSED'?'A meta está pausada; a simulação abaixo só vale se os aportes forem retomados.':health==='COMPLETED'?'O valor reservado declarado alcança o objetivo; isso não confirma disponibilidade bancária.':health==='NO_DATA'?'Não há aporte mensal positivo para estimar uma data.':slots===0?'Não cabe um aporte mensal futuro até a data desejada. Ajuste a data ou a reserva declarada.':`Faltam ${months} aporte(s) pelo plano atual e cabem ${slots} até a data desejada.`,
  assumption:'Simulação sem rendimentos, inflação, impostos ou taxas. Primeiro aporte daqui a um mês, no mesmo dia (ou último dia do mês). O ritmo é planejado, sem histórico de aportes realizados.'}
}
export function projectLife(plan:LifePlan,today:string){
 for(const n of [plan.upfront_cents,plan.monthly_impact_cents,plan.current_funding_cents,plan.monthly_capacity_cents,plan.reserve_draw_cents])integer(n,0,moneyLimit)
 integer(plan.impact_months,0,600)
 if(plan.reserve_cents!==null)integer(plan.reserve_cents,0,moneyLimit)
 if(plan.reserve_draw_cents>(plan.reserve_cents??0)||plan.reserve_draw_cents>plan.current_funding_cents)throw Error('O uso da reserva deve estar incluído no funding e não exceder a reserva declarada.')
 const cost=BigInt(plan.upfront_cents)+BigInt(plan.monthly_impact_cents)*BigInt(plan.impact_months)
 const upfrontGap=BigInt(Math.max(0,plan.upfront_cents-plan.current_funding_cents))
 const costGap=cost>BigInt(plan.current_funding_cents)?cost-BigInt(plan.current_funding_cents):BigInt(0)
 const projection=projectGoal({target_cents:plan.upfront_cents,saved_cents:plan.current_funding_cents,monthly_contribution_cents:plan.monthly_capacity_cents,target_date:plan.target_date,status:plan.status==='paused'?'paused':'active'},today)
 return {cost:String(cost),costGap:String(costGap),upfrontGap:String(upfrontGap),remainingReserve:plan.reserve_cents===null?null:String(plan.reserve_cents-plan.reserve_draw_cents),monthlyAfter:String(plan.monthly_capacity_cents-plan.monthly_impact_cents),projection}
}
