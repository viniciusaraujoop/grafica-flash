export const transactionLabels={buy:'Compra',sell:'Venda',contribution:'Aporte',withdrawal:'Retirada',income:'Rendimento',dividend:'Dividendo',interest:'Juros',fee:'Tarifa',tax:'Imposto',transfer:'Transferência interna',adjustment:'Ajuste de quantidade'}
export const valuationLabels={MANUAL_VALUE:'Valor informado',IMPORTED_VALUE:'Valor de extrato informado',PROVIDER_MARKET_VALUE:'Avaliação de provedor',NOT_AVAILABLE:'Avaliação indisponível'}
export type Holding={id:string;title:string;portfolio_id:string;instrument:string;quantity:string;cost_basis_cents:string|null;amount_cents:string;financial_date:string;valuation_status:keyof typeof valuationLabels;valuation_source:string;class:string;liquidity:string;version:number;archived_at:string|null;issuer:string|null;sector:string|null;exposure_currency:string|null;maturity:string|null}
export type Portfolio={id:string;name:string;kind:'real'|'lab';goal_id:string|null;targets:Record<string,number>;lab_positions:{class:string;amount:string}[];version:number}
export type PortfolioView={portfolio:Portfolio;marketStatus:'NOT_CONFIGURED';goalTitle:string|null;value:string;activeCount:string;unknownValuations:string;unknownBasis:string;knownBasis:string;comparableBasis:string;comparableValue:string;gain:string;holdingCount:string;transactionCount:string;groups:{dimension:string;label:string;amount:string;count:string}[];holdings:Holding[];transactions:{id:string;holding_id:string;destination_id:string|null;type:keyof typeof transactionLabels;quantity:string;amount_cents:string;basis_removed_cents:string|null;realized_gain_cents:string|null;financial_date:string;reference:string}[];cashFlows:{type:keyof typeof transactionLabels;amount:string;count:string}[]}
const zero=BigInt(0),one=BigInt(1),scale=BigInt(10000)
const unsigned=(v:unknown):v is string=>typeof v==='string'&&/^\d{1,60}$/.test(v)
const signed=(v:unknown):v is string=>typeof v==='string'&&/^-?\d{1,60}$/.test(v)
export function quantity(value:unknown){
 if(typeof value!=='string'||! /^-?\d{1,15}([.,]\d{1,8})?$/.test(value.trim()))throw Error('Use uma quantidade com até oito casas decimais.')
 return value.trim().replace(',','.')
}
export function readPortfolio(v:unknown):PortfolioView{
 if(typeof v!=='object'||v===null)throw Error('Carteira indisponível')
 const x=v as PortfolioView
 for(const k of ['value','activeCount','unknownValuations','unknownBasis','knownBasis','comparableBasis','comparableValue','holdingCount','transactionCount'] as const)if(!unsigned(x[k]))throw Error('Totais da carteira inválidos')
 if(!signed(x.gain)||BigInt(x.comparableValue)-BigInt(x.comparableBasis)!==BigInt(x.gain)||x.marketStatus!=='NOT_CONFIGURED'||!x.portfolio||!['real','lab'].includes(x.portfolio.kind))throw Error('Avaliação inconsistente')
 if(!Array.isArray(x.groups)||!Array.isArray(x.holdings)||!Array.isArray(x.transactions)||!Array.isArray(x.cashFlows))throw Error('Composição inválida')
 for(const g of x.groups)if(!unsigned(g.amount)||!unsigned(g.count))throw Error('Grupo inválido')
 for(const d of ['class','issuer','sector','currency','liquidity','maturity'])if(x.groups.filter(g=>g.dimension===d).reduce((s,g)=>s+BigInt(g.amount),zero)!==BigInt(x.value))throw Error('Composição incompleta')
 for(const h of x.holdings){if(!unsigned(h.amount_cents)||(h.cost_basis_cents!==null&&!unsigned(h.cost_basis_cents))||!Object.hasOwn(valuationLabels,h.valuation_status))throw Error('Posição inválida');quantity(h.quantity)}
 return x
}
/** Integer cents, deterministic remainder. Suggestions never execute trades. */
export function rebalance(current:{class:string;amount:string}[],targets:Record<string,number>,contribution:string){
 if(!unsigned(contribution)||current.some(r=>!unsigned(r.amount)))throw Error('Valores inválidos')
 const entries=Object.entries(targets).sort(([a],[b])=>a.localeCompare(b))
 if(!entries.length||entries.some(([,n])=>!Number.isInteger(n)||n<0||n>10000)||entries.reduce((s,[,n])=>s+n,0)!==10000)throw Error('Defina percentuais que somem 100%.')
 const byClass=new Map<string,bigint>();for(const r of current)byClass.set(r.class,(byClass.get(r.class)??zero)+BigInt(r.amount))
 const total=[...byClass.values()].reduce((s,n)=>s+n,BigInt(contribution))
 const allocations=entries.map(([name,bps])=>({class:name,target:total*BigInt(bps)/scale,remainder:total*BigInt(bps)%scale}))
 let leftover=total-allocations.reduce((s,r)=>s+r.target,zero)
 for(const row of [...allocations].sort((a,b)=>a.remainder===b.remainder?a.class.localeCompare(b.class):a.remainder>b.remainder?-1:1)){if(leftover===zero)break;row.target+=one;leftover-=one}
 for(const name of byClass.keys())if(!Object.hasOwn(targets,name))allocations.push({class:name,target:zero,remainder:zero})
 return allocations.map(r=>({class:r.class,current:(byClass.get(r.class)??zero).toString(),target:r.target.toString(),difference:(r.target-(byClass.get(r.class)??zero)).toString()}))
}
/** Net worth already includes liabilities. Monthly contribution is net of debt service. */
export function futureScenario(input:{initial:string;monthly:string;monthlyReturnBps:number;monthlyInflationBps:number;months:number;goalGap:string}){
 if(!signed(input.initial)||!unsigned(input.monthly)||!unsigned(input.goalGap)||!Number.isInteger(input.months)||input.months<1||input.months>600||!Number.isInteger(input.monthlyReturnBps)||input.monthlyReturnBps< -10000||input.monthlyReturnBps>10000||!Number.isInteger(input.monthlyInflationBps)||input.monthlyInflationBps<0||input.monthlyInflationBps>10000)throw Error('Premissas inválidas')
 let balance=BigInt(input.initial),priceIndex=BigInt(1000000000000),contributed=zero
 const round=(v:bigint,d:bigint)=>v<zero?-((-v+d/BigInt(2))/d):(v+d/BigInt(2))/d
 for(let m=0;m<input.months;m++){
  // Return only on positive investable net wealth; no fictional compounding of debts.
  if(balance>zero)balance=round(balance*BigInt(10000+input.monthlyReturnBps),scale)
  balance+=BigInt(input.monthly);contributed+=BigInt(input.monthly)
  priceIndex=round(priceIndex*BigInt(10000+input.monthlyInflationBps),scale)
  if(balance.toString().length>60||priceIndex.toString().length>60)throw Error('Cenário excede o limite de cálculo.')
 }
 return {nominal:balance.toString(),real:round(balance*BigInt(1000000000000),priceIndex).toString(),contributed:contributed.toString(),goalGap:input.goalGap}
}
