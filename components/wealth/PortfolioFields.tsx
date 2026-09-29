import {assetClasses,liquidityLabels} from '@/lib/wealth/net-worth'
import {moneyInputValue} from '@/lib/wealth/core'
import type {Holding,Portfolio} from '@/lib/wealth/portfolio'
import {transactionLabels,valuationLabels} from '@/lib/wealth/portfolio'

export function PortfolioSettings({portfolio,goals=[]}:{portfolio?:Portfolio;goals?:{id:string;title:string}[]}){
 return <>
  <label>Nome da carteira<input name="name" required maxLength={120} defaultValue={portfolio?.name}/></label>
  {portfolio?<input type="hidden" name="kind" value={portfolio.kind}/>:<label>Tipo de carteira<select name="kind"><option value="real">Carteira real · registros pessoais</option><option value="lab">Lab · cenário hipotético</option></select></label>}
  <label>Meta vinculada<select name="goal_id" defaultValue={portfolio?.goal_id??''}><option value="">Sem vínculo</option>{goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
 </>
}
export function AllocationFields({portfolio}:{portfolio:Portfolio}){
 return <>{Object.entries(assetClasses).map(([key,label])=><label key={key}>Alvo: {label} (%)<input name={`target_${key}`} inputMode="decimal" defaultValue={portfolio.targets[key]===undefined?'':String(portfolio.targets[key]/100)} placeholder="Sem alvo"/></label>)}
  {portfolio.kind==='lab'&&Object.entries(assetClasses).map(([key,label])=><label key={`lab-${key}`}>Hipótese: {label} (R$)<input name={`lab_${key}`} inputMode="decimal" defaultValue={portfolio.lab_positions.filter(p=>p.class===key).length?moneyInputValue(Number(portfolio.lab_positions.filter(p=>p.class===key).reduce((s,p)=>s+BigInt(p.amount),BigInt(0)))):''} placeholder="Sem posição"/></label>)}
 </>
}
export function HoldingFields({holding,today,link=false}:{holding?:Holding;today:string;link?:boolean}){
 return <>
  {!holding&&<><label>Identificador do ativo<input name="instrument" maxLength={80} required placeholder="Como consta no seu registro"/></label><label>Quantidade<input name="quantity" inputMode="decimal" required placeholder="Até 8 casas decimais"/></label><label>Custo total de aquisição (R$)<input name="cost_basis" inputMode="decimal" placeholder="Deixe vazio se desconhecido"/></label></>}
  {!holding&&!link&&<label>Nome da posição<input name="title" maxLength={160} required/></label>}
  {!link&&<><label>Valor total da posição (R$)<input name="amount" inputMode="decimal" required defaultValue={holding?moneyInputValue(Number(holding.amount_cents)):''}/></label>
   <label>Origem da avaliação<select name="valuation_status" defaultValue={holding?.valuation_status??'MANUAL_VALUE'}>{Object.entries(valuationLabels).filter(([v])=>v!=='PROVIDER_MARKET_VALUE').map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   <label>Data da avaliação<input name="financial_date" type="date" required defaultValue={holding?.financial_date??today}/></label>
   <label>Classe do ativo<select name="position_class" defaultValue={holding?.class==='unclassified'?'other':holding?.class??'investment'}>{Object.entries(assetClasses).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>
   <label>Liquidez declarada<select name="liquidity" defaultValue={holding?.liquidity??'unknown'}>{Object.entries(liquidityLabels).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label></>}
  <label>Referência da origem<input name="reference" maxLength={240} required defaultValue={holding?.valuation_source} placeholder="Declaração pessoal ou extrato e data"/></label>
  <label>Emissor<input name="issuer" maxLength={120} defaultValue={holding?.issuer??''} placeholder="Se conhecido"/></label>
  <label>Setor<input name="sector" maxLength={80} defaultValue={holding?.sector??''} placeholder="Se conhecido"/></label>
  <label>Moeda de exposição declarada<select name="exposure_currency" defaultValue={holding?.exposure_currency??''}><option value="">Não informada</option>{['BRL','USD','EUR','GBP','JPY','CHF','CAD','AUD','CNY'].map(c=><option key={c}>{c}</option>)}</select></label>
  <label>Vencimento<input name="maturity" type="date" defaultValue={holding?.maturity??''}/></label>
 </>
}
export function TransactionFields({holding,destinations,today}:{holding:Holding;destinations:Holding[];today:string}){
 return <>
  <label>Tipo de movimento<select name="type">{Object.entries(transactionLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label>Quantidade do movimento<input name="quantity" inputMode="decimal" required defaultValue="0"/></label>
  <label>Valor do movimento (R$)<input name="amount" inputMode="decimal" required defaultValue="0"/></label>
  <label>Data do movimento<input name="financial_date" type="date" required defaultValue={today}/></label>
  <label>Referência do movimento<input name="reference" required maxLength={240}/></label>
  <label>Novo custo total, apenas para ajuste (R$)<input name="cost_basis" inputMode="decimal" placeholder="Vazio significa desconhecido"/></label>
  <label>Destino, apenas para transferência<select name="destination"><option value="">Sem destino</option>{destinations.filter(h=>h.id!==holding.id&&!h.archived_at&&h.instrument===holding.instrument&&h.exposure_currency===holding.exposure_currency).map(h=><option key={h.id} value={`${h.id}|${h.version}`}>{h.title}</option>)}</select></label>
 </>
}
