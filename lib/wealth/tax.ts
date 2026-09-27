import {financialDate,integer,uuid} from './core'

export type TaxCenter={
 from:string;to:string;days:number;page:number;currency:'BRL';coverage:'DECLARED_LEDGER_ONLY';
 tax_provider_status:'NOT_CONFIGURED';tax_rules_status:'NOT_CONFIGURED';jurisdiction_status:'UNSPECIFIED';filing_status:'NOT_CONFIGURED';
 selected:{id:string;name:string;kind:'real'|'lab'}|null;
 taxes:string;income:string;sell_proceeds:string;basis_removed:string;realized_gain:string;
 record_count:string;tax_count:string;income_count:string;sell_count:string;complete_sell_count:string;incomplete_sell_count:string;
 holding_count:string;portfolio_count:string;covered_portfolios:string;lab_count:string;
 portfolios:{id:string;name:string;records:string;taxes:string;income:string;sell_proceeds:string;basis_removed:string;realized_gain:string;incomplete_sells:string}[];
 months:{month:string;records:string;taxes:string;income:string;sell_proceeds:string;basis_removed:string;realized_gain:string;incomplete_sells:string}[];
 records:{id:string;holding_id:string;portfolio_id:string;portfolio_name:string;title:string;archived:boolean;type:'tax'|'income'|'dividend'|'interest'|'sell';amount_cents:string;basis_removed_cents:string|null;realized_gain_cents:string|null;financial_date:string;reference:string}[];
}

const unsigned=(value:unknown):value is string=>typeof value==='string'&&/^\d{1,60}$/.test(value)
const signed=(value:unknown):value is string=>typeof value==='string'&&/^-?\d{1,60}$/.test(value)

export function taxFilters(raw:Record<string,unknown>,today:string){
 if(Object.values(raw).some(Array.isArray))throw Error('Use um valor por filtro.')
 const to=financialDate(raw.to??today),from=financialDate(raw.from??`${to.slice(0,4)}-01-01`),page=integer(raw.page??1,1,100000)
 const days=(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000+1
 if(days<1||days>366)throw Error('Consulte até 366 dias por vez.')
 const portfolio=raw.portfolio===undefined||raw.portfolio===''?null:uuid(raw.portfolio)
 return {from,to,page,portfolio}
}

export function readTaxCenter(value:unknown):TaxCenter{
 if(!value||typeof value!=='object')throw Error('Tax Center indisponível')
 const v=value as TaxCenter
 taxFilters({from:v.from,to:v.to,page:v.page},v.to)
 if(v.currency!=='BRL'||v.coverage!=='DECLARED_LEDGER_ONLY'||v.tax_provider_status!=='NOT_CONFIGURED'||v.tax_rules_status!=='NOT_CONFIGURED'||v.jurisdiction_status!=='UNSPECIFIED'||v.filing_status!=='NOT_CONFIGURED')throw Error('Cobertura fiscal inválida')
 const unsignedTotals=['taxes','income','sell_proceeds','basis_removed','record_count','tax_count','income_count','sell_count','complete_sell_count','incomplete_sell_count','holding_count','portfolio_count','covered_portfolios','lab_count'] as const
 for(const key of unsignedTotals)if(!unsigned(v[key]))throw Error('Totais fiscais inválidos')
 if(!signed(v.realized_gain))throw Error('Resultado realizado inválido')
 if(BigInt(v.complete_sell_count)+BigInt(v.incomplete_sell_count)!==BigInt(v.sell_count))throw Error('Cobertura de vendas inconsistente')
 if(!Array.isArray(v.records)||v.records.length>25||!Array.isArray(v.portfolios)||v.portfolios.length>25||!Array.isArray(v.months)||v.months.length>13)throw Error('Paginação fiscal inválida')
 if(v.selected){uuid(v.selected.id);if(!['real','lab'].includes(v.selected.kind)||typeof v.selected.name!=='string')throw Error('Carteira selecionada inválida')}
 for(const r of v.records){
  uuid(r.id);uuid(r.holding_id);uuid(r.portfolio_id);financialDate(r.financial_date)
  if(!['tax','income','dividend','interest','sell'].includes(r.type)||!unsigned(r.amount_cents))throw Error('Registro fiscal inválido')
  if(r.basis_removed_cents!==null&&!unsigned(r.basis_removed_cents))throw Error('Base declarada inválida')
  if(r.realized_gain_cents!==null&&!signed(r.realized_gain_cents))throw Error('Resultado declarado inválido')
 }
 for(const row of v.portfolios){
  uuid(row.id)
  for(const key of ['records','taxes','income','sell_proceeds','basis_removed','incomplete_sells'] as const)if(!unsigned(row[key]))throw Error('Grupo fiscal inválido')
  if(!signed(row.realized_gain))throw Error('Resultado de carteira inválido')
 }
 for(const row of v.months){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month))throw Error('Mês fiscal inválido')
  for(const key of ['records','taxes','income','sell_proceeds','basis_removed','incomplete_sells'] as const)if(!unsigned(row[key]))throw Error('Histórico fiscal inválido')
  if(!signed(row.realized_gain))throw Error('Resultado mensal inválido')
 }
 const sumUnsigned=(key:'taxes'|'income'|'sell_proceeds'|'basis_removed'|'records'|'incomplete_sells')=>v.months.reduce((sum,row)=>sum+BigInt(row[key]),BigInt(0))
 const sumSigned=(key:'realized_gain')=>v.months.reduce((sum,row)=>sum+BigInt(row[key]),BigInt(0))
 if(sumUnsigned('taxes')!==BigInt(v.taxes)||sumUnsigned('income')!==BigInt(v.income)||sumUnsigned('sell_proceeds')!==BigInt(v.sell_proceeds)||sumUnsigned('basis_removed')!==BigInt(v.basis_removed)||sumUnsigned('records')!==BigInt(v.record_count)||sumUnsigned('incomplete_sells')!==BigInt(v.incomplete_sell_count)||sumSigned('realized_gain')!==BigInt(v.realized_gain))throw Error('Histórico fiscal incompleto')
 return v
}
