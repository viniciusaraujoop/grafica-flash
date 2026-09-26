export const assetClasses = {cash:'Dinheiro',checking:'Conta corrente',savings:'Poupança',investment:'Investimento',fixed_income:'Renda fixa',stock:'Ações',fund:'Fundos',ETF:'ETF',FII:'FII',pension:'Previdência',crypto:'Criptoativos',real_estate:'Imóveis',vehicle:'Veículos',business_equity:'Participação societária',receivable:'Recebíveis',other:'Outros ativos'}
export const liabilityClasses = {credit_card:'Cartão de crédito',personal_loan:'Empréstimo pessoal',payroll_loan:'Consignado',vehicle_financing:'Financiamento de veículo',mortgage:'Financiamento imobiliário',tax:'Tributos',installment:'Parcelamentos',other_debt:'Outras dívidas'}
export const liquidityLabels = {immediate:'Imediata',short_term:'Curto prazo',medium_term:'Médio prazo',illiquid:'Ilíquido',unknown:'Não informada'}
export const classLabels:Record<string,string> = {...assetClasses,...liabilityClasses,unclassified:'Não classificado'}
export type NetWorth = {
 currency:'BRL';source:'owner_declared';capturedAt:string;localDate:string;timezone:string;assets:string;liabilities:string;netWorth:string;positionCount:string;
 classes:{kind:'asset'|'liability';class:string;amount:string;count:string}[];
 liquidity:{liquidity:keyof typeof liquidityLabels;amount:string;count:string}[];
 largest:{id:string;title:string;kind:'asset'|'liability';amount:string;class:string;liquidity:keyof typeof liquidityLabels}[];
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const cents=(v:unknown):v is string=>typeof v==='string'&&/^-?\d{1,60}$/.test(v)
const positive=(v:unknown):v is string=>cents(v)&&BigInt(v)>=BigInt(0)
const kind=(v:unknown)=>v==='asset'||v==='liability'
export function readNetWorth(v:unknown):NetWorth {
 if(!object(v)||v.currency!=='BRL'||v.source!=='owner_declared'||typeof v.capturedAt!=='string'||!Number.isFinite(Date.parse(v.capturedAt))||typeof v.timezone!=='string'||typeof v.localDate!=='string')throw Error('Snapshot inválido')
 new Intl.DateTimeFormat('pt-BR',{timeZone:v.timezone})
 if(!positive(v.assets)||!positive(v.liabilities)||!cents(v.netWorth)||!positive(v.positionCount)||BigInt(v.assets)-BigInt(v.liabilities)!==BigInt(v.netWorth))throw Error('Totais inconsistentes')
 if(!Array.isArray(v.classes)||!v.classes.every(r=>object(r)&&kind(r.kind)&&typeof r.class==='string'&&Object.hasOwn(classLabels,r.class)&&positive(r.amount)&&positive(r.count)))throw Error('Composição inválida')
 if(!Array.isArray(v.liquidity)||!v.liquidity.every(r=>object(r)&&typeof r.liquidity==='string'&&Object.hasOwn(liquidityLabels,r.liquidity)&&positive(r.amount)&&positive(r.count)))throw Error('Liquidez inválida')
 if(!Array.isArray(v.largest)||v.largest.length>20||!v.largest.every(r=>object(r)&&kind(r.kind)&&typeof r.id==='string'&&typeof r.title==='string'&&positive(r.amount)&&typeof r.class==='string'&&Object.hasOwn(classLabels,r.class)&&typeof r.liquidity==='string'&&Object.hasOwn(liquidityLabels,r.liquidity)))throw Error('Posições inválidas')
 for(const k of ['asset','liability'])if(v.classes.filter(r=>r.kind===k).reduce((s,r)=>s+BigInt(r.amount),BigInt(0))!==BigInt(k==='asset'?v.assets:v.liabilities))throw Error('Composição incompleta')
 if(v.liquidity.reduce((s,r)=>s+BigInt(r.amount),BigInt(0))!==BigInt(v.assets))throw Error('Liquidez incompleta')
 return v as NetWorth
}
/** Two decimal places, half up, independent of Number's monetary precision. */
export function sharePercent(part:string,total:string):string {
 if(!positive(part)||!positive(total)||BigInt(part)>BigInt(total))throw Error('Participação inválida')
 if(BigInt(total)===BigInt(0))return '—'
 const bps=(BigInt(part)*BigInt(10000)+BigInt(total)/BigInt(2))/BigInt(total)
 return `${bps/BigInt(100)},${String(bps%BigInt(100)).padStart(2,'0')}%`
}
