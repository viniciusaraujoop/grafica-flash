import {financialDate,integer,uuid} from './core'

export type FeeAnalysis={from:string;to:string;days:number;page:number;currency:'BRL';coverage:'DECLARED_ONLY';external_status:'NOT_CONFIGURED';selected:{id:string;name:string;kind:'real'|'lab'}|null;previous:{from:string;to:string;fees:string;taxes:string;records:string}|null;fees:string;taxes:string;record_count:string;holding_count:string;portfolio_count:string;covered_portfolios:string;lab_count:string;portfolios:{id:string;name:string;records:string;fees:string;taxes:string}[];months:{month:string;fees:string;taxes:string;records:string}[];records:{id:string;holding_id:string;portfolio_id:string;portfolio_name:string;title:string;archived:boolean;type:'fee'|'tax';amount_cents:string;financial_date:string;reference:string}[]}

export function feeFilters(raw:Record<string,unknown>,today:string){
 if(Object.values(raw).some(Array.isArray))throw Error('Use um valor por filtro.')
 const to=financialDate(raw.to??today),from=financialDate(raw.from??`${to.slice(0,7)}-01`),page=integer(raw.page??1,1,100000)
 const days=(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000+1
 if(days<1||days>366)throw Error('Consulte até 366 dias por vez.')
 const portfolio=raw.portfolio===undefined||raw.portfolio===''?null:uuid(raw.portfolio)
 return {from,to,page,portfolio}
}
export function readFeeAnalysis(value:unknown):FeeAnalysis{
 if(!value||typeof value!=='object')throw Error('Análise indisponível')
 const v=value as FeeAnalysis,amount=(n:unknown)=>typeof n==='string'&&/^\d{1,60}$/.test(n)
 feeFilters({from:v.from,to:v.to,page:v.page},v.to)
 if(v.currency!=='BRL'||v.coverage!=='DECLARED_ONLY'||v.external_status!=='NOT_CONFIGURED')throw Error('Cobertura inválida')
 for(const k of ['fees','taxes','record_count','holding_count','portfolio_count','covered_portfolios','lab_count'] as const)if(!amount(v[k]))throw Error('Totais inválidos')
 if(!Array.isArray(v.records)||v.records.length>25||!Array.isArray(v.portfolios)||v.portfolios.length>25||!Array.isArray(v.months)||v.months.length>13)throw Error('Paginação inválida')
 for(const r of v.records){uuid(r.id);uuid(r.holding_id);uuid(r.portfolio_id);financialDate(r.financial_date);if(!['fee','tax'].includes(r.type)||!amount(r.amount_cents))throw Error('Registro inválido')}
 for(const row of [...v.portfolios,...v.months])for(const k of ['fees','taxes','records'] as const)if(!amount(row[k]))throw Error('Grupo inválido')
 for(const k of ['fees','taxes'] as const)if(v.months.reduce((sum,r)=>sum+BigInt(r[k]),BigInt(0))!==BigInt(v[k]))throw Error('Histórico incompleto')
 if(v.previous){financialDate(v.previous.from);financialDate(v.previous.to);for(const k of ['fees','taxes','records'] as const)if(!amount(v.previous[k]))throw Error('Comparação inválida')}
 return v
}
