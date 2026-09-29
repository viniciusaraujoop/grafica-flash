import {integer,moneyLimit} from './core'

export const debtStrategies={snowball:'Menor saldo primeiro',avalanche:'Maior taxa primeiro',custom:'Minha ordem'} as const
export type DebtStrategy=keyof typeof debtStrategies
export type DebtPlanInput={id:string;title:string;balanceCents:number;monthlyRateBps:number;minimumCents:number;priority:number}
export type DebtMonth={month:number;paidCents:string;interestCents:string;remainingCents:string}
export type DebtTerms={principal_cents:number;monthly_rate_bps:number;minimum_cents:number;installment_count:number|null;remaining_installments:number|null;next_due_date:string|null;priority:number}
export type DebtEntry={id:string;title:string;amount_cents:number;financial_date:string;version:number;terms:DebtTerms|null}

// Declared fixed monthly rates, rounded half-up per debt; payments occur after interest.
// This is a bounded hypothetical calculation, never an instruction to a creditor.
export function simulateDebtPlan(input:DebtPlanInput[],monthlyBudgetCents:number,strategy:DebtStrategy,horizon=360){
 if(!Object.hasOwn(debtStrategies,strategy))throw Error('Estratégia inválida.')
 if(input.length>50)throw Error('A simulação aceita no máximo 50 dívidas por vez.')
 integer(monthlyBudgetCents,1,moneyLimit);integer(horizon,1,600)
 const seen=new Set<string>()
 const debts=input.map(d=>{
  if(!d.id||seen.has(d.id))throw Error('Dívida repetida ou sem identificação.')
  seen.add(d.id)
  integer(d.balanceCents,0,moneyLimit);integer(d.monthlyRateBps,0,10000);integer(d.minimumCents,0,moneyLimit);integer(d.priority,1,1000)
  return {...d,balance:BigInt(d.balanceCents),paid:BigInt(0),interest:BigInt(0),paidOffMonth:d.balanceCents===0?0:null as number|null}
 })
 const initial=debts.reduce((sum,d)=>sum+d.balance,BigInt(0)),budget=BigInt(monthlyBudgetCents)
 const timeline:DebtMonth[]=[]
 let status:'paid_off'|'budget_below_minimums'|'horizon_reached'='horizon_reached',required=BigInt(0),totalInterest=BigInt(0),totalPaid=BigInt(0)
 for(let month=1;month<=horizon;month++){
  const active=debts.filter(d=>d.balance>BigInt(0))
  if(!active.length){status='paid_off';break}
  let interest=BigInt(0)
  for(const d of active){const charge=(d.balance*BigInt(d.monthlyRateBps)+BigInt(5000))/BigInt(10000);d.balance+=charge;d.interest+=charge;interest+=charge}
  totalInterest+=interest
  required=active.reduce((sum,d)=>sum+(BigInt(d.minimumCents)<d.balance?BigInt(d.minimumCents):d.balance),BigInt(0))
  if(required>budget){status='budget_below_minimums';timeline.push({month,paidCents:'0',interestCents:interest.toString(),remainingCents:active.reduce((s,d)=>s+d.balance,BigInt(0)).toString()});break}
  let available=budget,paid=BigInt(0)
  const pay=(d:typeof debts[number],amount:bigint)=>{const value=amount<d.balance?amount:d.balance;d.balance-=value;d.paid+=value;available-=value;paid+=value;if(d.balance===BigInt(0)&&d.paidOffMonth===null)d.paidOffMonth=month}
  for(const d of active)pay(d,BigInt(d.minimumCents))
  const sorted=active.filter(d=>d.balance>BigInt(0)).sort((a,b)=>{
   if(strategy==='avalanche'&&a.monthlyRateBps!==b.monthlyRateBps)return b.monthlyRateBps-a.monthlyRateBps
   if(strategy==='custom'&&a.priority!==b.priority)return a.priority-b.priority
   if(a.balance!==b.balance)return a.balance<b.balance?-1:1
   return a.id.localeCompare(b.id)
  })
  for(const d of sorted){if(available<=BigInt(0))break;pay(d,available)}
  totalPaid+=paid
  const remaining=debts.reduce((sum,d)=>sum+d.balance,BigInt(0))
  timeline.push({month,paidCents:paid.toString(),interestCents:interest.toString(),remainingCents:remaining.toString()})
  if(remaining===BigInt(0)){status='paid_off';break}
 }
 if(initial===BigInt(0))status='paid_off'
 return {status,months:timeline.length,initialCents:initial.toString(),interestCents:totalInterest.toString(),paidCents:totalPaid.toString(),remainingCents:debts.reduce((sum,d)=>sum+d.balance,BigInt(0)).toString(),requiredMinimumCents:required.toString(),timeline,
  debts:debts.map(d=>({id:d.id,title:d.title,paidCents:d.paid.toString(),interestCents:d.interest.toString(),remainingCents:d.balance.toString(),paidOffMonth:d.paidOffMonth}))}
}
