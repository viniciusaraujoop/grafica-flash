import {formatMoney,financialDate} from './core'
import type {WealthSummary} from './summary'
import type {NetWorth} from './net-worth'
import type {HealthIndicator} from './health'
import type {WealthAlertsOverview} from './alerts'
import type {TaxCenter} from './tax'
import type {FeeAnalysis} from './fees'

export const askModes={
 education:'Educação',
 analysis:'Análise',
 simulation:'Simulação',
 planning:'Planejamento',
} as const
export type AskMode=keyof typeof askModes
export type AskIntent='overview'|'net_worth'|'debt'|'goals'|'portfolio'|'tax'|'fees'|'alerts'|'market'
export type AskProviderStatus='NOT_CONFIGURED'|'OPENAI_CONFIGURED'|'DEGRADED'
export type AskSourceId='summary'|'net_worth'|'health'|'goals'|'alerts'|'tax'|'fees'
export type AskSource={id:AskSourceId;label:string;href:string;period:string;status:'AVAILABLE'|'UNAVAILABLE';coverage:string}
export type AskGoal={id:string;title:string;target_cents:string;saved_cents:string;monthly_contribution_cents:string;target_date:string;status:string}
export type AskContext={
 date:string;timezone:string;month:string;year_from:string;
 summary:WealthSummary|null;netWorth:NetWorth|null;health:HealthIndicator[];
 goals:AskGoal[];alerts:WealthAlertsOverview|null;tax:TaxCenter|null;fees:FeeAnalysis|null;
 unavailable:AskSourceId[];
}
export type AskRequest={question:string;mode:AskMode}
export type AskAction={label:string;href:string}
export type AskResult={
 ok:true;mode:AskMode;intent:AskIntent;answer:string;provider_status:AskProviderStatus;
 regulated_advice:'OFF';execution:'OFF';cross_product_context:'DISABLED';market_provider_status:'NOT_CONFIGURED';
 context_id:string;period:{from:string;to:string;timezone:string};
 sources:AskSource[];hypotheses:string[];limitations:string[];actions:AskAction[];warning?:string
}

const sourceMeta:Record<AskSourceId,{label:string;href:string;coverage:string}>={
 summary:{label:'Resumo Wealth',href:'/apps/wealth',coverage:'Lançamentos e metas owner-scoped.'},
 net_worth:{label:'Patrimônio',href:'/apps/wealth/patrimonio',coverage:'Ativos, passivos e composição declarados.'},
 health:{label:'Saúde financeira',href:'/apps/wealth/saude',coverage:'Indicadores determinísticos com regras e limitações abertas.'},
 goals:{label:'Metas',href:'/apps/wealth/metas',coverage:'Metas pessoais não arquivadas.'},
 alerts:{label:'Wealth Alerts',href:'/apps/wealth/alertas',coverage:'Sinais factuais derivados das fontes Wealth.'},
 tax:{label:'Tax Center',href:'/apps/wealth/impostos',coverage:'Fatos fiscais declarados; não é apuração tributária.'},
 fees:{label:'Fee Analyzer',href:'/apps/wealth/tarifas',coverage:'Tarifas e impostos declarados no ledger.'},
}

const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const cents=(value:unknown):value is string=>typeof value==='string'&&/^-?\d{1,60}$/.test(value)

export function parseAskRequest(value:unknown):AskRequest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Solicitação inválida.')
 const body=value as Record<string,unknown>
 const question=typeof body.question==='string'?body.question.trim():''
 const mode=typeof body.mode==='string'?body.mode:''
 if(!question||question.length>2000)throw Error('Digite uma pergunta com até 2.000 caracteres.')
 if(!Object.hasOwn(askModes,mode))throw Error('Modo do Ask Wealth inválido.')
 if(Object.hasOwn(body,'include_cross_product')||Object.hasOwn(body,'tools')||Object.hasOwn(body,'sql'))throw Error('Ask Wealth não aceita contexto, ferramentas ou SQL enviados pelo cliente.')
 return {question,mode:mode as AskMode}
}

export function classifyAsk(question:string):AskIntent{
 const q=normalized(question)
 if(/\b(cotacao|preco agora|mercado hoje|selic agora|dolar agora|cambio agora|noticia|radar|ibovespa hoje)\b/.test(q))return 'market'
 if(/\b(imposto|tribut|fiscal|darf|ganho realizado)\b/.test(q))return 'tax'
 if(/\b(taxas?|tarifas?|fees?|custos?)\b/.test(q))return 'fees'
 if(/\b(alerta|pendencia|vencid|atrasad)\b/.test(q))return 'alerts'
 if(/\b(metas?|objetivos?|casa|carro|viagem|prazo)\b/.test(q))return 'goals'
 if(/\b(divida|passivo|emprest|financi|cartao|parcel)\b/.test(q))return 'debt'
 if(/\b(carteira|portfolio|alocacao|concentracao|liquidez|ativo|investimento)\b/.test(q))return 'portfolio'
 if(/\b(patrimonio|quanto tenho|quanto devo|ativos e passivos|net worth)\b/.test(q))return 'net_worth'
 return 'overview'
}

export function hasRestrictedFinancialIntent(question:string){
 const q=normalized(question)
 return /\b(devo comprar|devo vender|qual ativo comprar|qual acao comprar|compre para mim|venda para mim|execute|transfira|invista por mim|rebalanceie automaticamente|garanta retorno|melhor investimento para mim)\b/.test(q)
}

export function validateAskGoals(value:unknown):AskGoal[]{
 if(!Array.isArray(value)||value.length>50)throw Error('Metas do contexto inválidas.')
 return value.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Meta do contexto inválida.')
  const r=row as Record<string,unknown>
  if(typeof r.id!=='string'||typeof r.title!=='string'||typeof r.target_date!=='string'||typeof r.status!=='string')throw Error('Meta do contexto inválida.')
  financialDate(r.target_date)
  for(const key of ['target_cents','saved_cents','monthly_contribution_cents'] as const)if(!cents(String(r[key]??''))||BigInt(String(r[key]))<BigInt(0))throw Error('Valor de meta inválido.')
  return {id:r.id,title:r.title,target_cents:String(r.target_cents),saved_cents:String(r.saved_cents),monthly_contribution_cents:String(r.monthly_contribution_cents),target_date:r.target_date,status:r.status}
 })
}

const intentSources:Record<AskIntent,AskSourceId[]>={
 overview:['summary','net_worth','health','alerts'],
 net_worth:['net_worth','health','summary'],
 debt:['health','net_worth','alerts'],
 goals:['goals','summary','health','alerts'],
 portfolio:['net_worth','health','fees','tax'],
 tax:['tax','fees'],
 fees:['fees','tax'],
 alerts:['alerts','health'],
 market:['net_worth'],
}

export function askSources(context:AskContext,intent:AskIntent):AskSource[]{
 return intentSources[intent].map(id=>{
  const unavailable=context.unavailable.includes(id)
  const period=id==='tax'?context.year_from+' a '+context.date:id==='fees'||id==='summary'?context.month:context.date
  return {id,...sourceMeta[id],period,status:unavailable?'UNAVAILABLE':'AVAILABLE'}
 })
}

function indicator(context:AskContext,id:string){return context.health.find(row=>row.id===id)}
function topAlerts(context:AskContext){return context.alerts?.alerts.slice(0,3)??[]}

export function localAskAnswer(context:AskContext,request:AskRequest,intent=classifyAsk(request.question)){
 const limitations:string[]=['Os números refletem apenas dados registrados no Orçaly Wealth; ausência de registro não prova ausência de saldo, obrigação ou evento externo.']
 const hypotheses:string[]=[]
 let answer=''
 const actions:AskAction[]=[]
 const summary=context.summary,net=context.netWorth

 if(hasRestrictedFinancialIntent(request.question)){
  return {
   answer:'Posso explicar seus dados, comparar cenários e ajudar no planejamento, mas aconselhamento individualizado regulado e execução financeira estão desativados. Não vou escolher um ativo para você nem executar compra, venda, transferência ou rebalanceamento.',
   hypotheses:[],limitations:['regulated_advice = OFF','execution = OFF','Nenhuma ordem financeira é criada pelo Ask Wealth.'],
   actions:[{label:'Abrir Portfolio Lab',href:'/apps/wealth/carteiras'},{label:'Revisar sua saúde financeira',href:'/apps/wealth/saude'}],
   boundary:'REGULATED_OR_EXECUTION_OFF' as const
  }
 }

 if(intent==='market'){
  return {
   answer:'O Ask Wealth não possui feed de mercado configurado. Não vou inventar cotação, notícia, câmbio ou taxa atual. Posso analisar como os valores que você já registrou estão distribuídos e quais dados faltam.',
   hypotheses:[],limitations:['market_provider_status = NOT_CONFIGURED','Nenhum dado de mercado em tempo real foi consultado.'],
   actions:[{label:'Revisar carteiras declaradas',href:'/apps/wealth/carteiras'}],
   boundary:'MARKET_NOT_CONFIGURED' as const
  }
 }

 if(intent==='net_worth'&&net){
  const trend=indicator(context,'trend')
  answer='Seu patrimônio líquido registrado é '+formatMoney(net.netWorth)+': '+formatMoney(net.assets)+' em ativos menos '+formatMoney(net.liabilities)+' em passivos.'
  if(net.unknownValuations&&net.unknownValuations!=='0')answer+=' Há '+net.unknownValuations+' posição(ões) sem avaliação, então o total é parcial.'
  if(trend)answer+=' O indicador de variação informa: '+trend.value+'.'
  limitations.push('Patrimônio usa valores declarados, não cotações de mercado. Diferença entre snapshots não é rentabilidade.')
  actions.push({label:'Abrir patrimônio',href:'/apps/wealth/patrimonio'})
 }else if(intent==='debt'){
  const burden=indicator(context,'burden')
  answer='Os passivos declarados somam '+(net?formatMoney(net.liabilities):'valor indisponível')+'.'
  if(burden)answer+=' O comprometimento com mínimos de dívidas está descrito como '+burden.value+'.'
  limitations.push('O Debt Center usa saldos e termos declarados; não consulta credores.')
  actions.push({label:'Abrir Central de Dívidas',href:'/apps/wealth/dividas'})
 }else if(intent==='goals'){
  const active=context.goals.filter(g=>g.status==='active')
  const nearest=[...active].sort((a,b)=>a.target_date.localeCompare(b.target_date)).slice(0,3)
  answer='Você tem '+active.length+' meta(s) ativa(s) no contexto carregado.'
  if(summary)answer+=' O reservado declarado para metas é '+formatMoney(summary.goalSaved)+' de '+formatMoney(summary.goalTarget)+'.'
  if(nearest.length)answer+=' As próximas são: '+nearest.map(g=>g.title+' ('+formatMoney(g.saved_cents)+' de '+formatMoney(g.target_cents)+', prazo '+g.target_date+')').join('; ')+'.'
  limitations.push('Reservado em metas é declaração e pode apontar para os mesmos ativos; não comprova segregação bancária.')
  actions.push({label:'Abrir metas',href:'/apps/wealth/metas'})
 }else if(intent==='portfolio'&&net){
  const largest=net.largest.filter(x=>x.kind==='asset').slice(0,3)
  answer='Seus ativos declarados somam '+formatMoney(net.assets)+'.'
  if(largest.length)answer+=' As maiores posições registradas são '+largest.map(x=>x.title+': '+formatMoney(x.amount)).join('; ')+'.'
  const concentration=indicator(context,'concentration');if(concentration)answer+=' Concentração na maior posição: '+concentration.value+'.'
  if(net.unknownValuations&&net.unknownValuations!=='0')answer+=' '+net.unknownValuations+' posição(ões) estão sem avaliação.'
  limitations.push('Não há cotação de mercado nem consolidação automática por emissor nesta resposta.')
  actions.push({label:'Abrir Portfolio',href:'/apps/wealth/carteiras'})
 }else if(intent==='tax'&&context.tax){
  answer='No período de '+context.tax.from+' a '+context.tax.to+', o Tax Center registra '+formatMoney(context.tax.taxes)+' em impostos declarados, '+formatMoney(context.tax.income)+' em rendimentos e '+formatMoney(context.tax.sell_proceeds)+' em vendas.'
  if(context.tax.incomplete_sell_count!=='0')answer+=' '+context.tax.incomplete_sell_count+' venda(s) têm evidência incompleta de base removida ou resultado realizado.'
  limitations.push('Isso não é imposto devido, DARF, declaração fiscal nem aconselhamento tributário.')
  actions.push({label:'Abrir Tax Center',href:'/apps/wealth/impostos'})
 }else if(intent==='fees'&&context.fees){
  answer='No mês consultado, o Fee Analyzer registra '+formatMoney(context.fees.fees)+' em tarifas e '+formatMoney(context.fees.taxes)+' em impostos declarados.'
  limitations.push('São eventos declarados do ledger; nenhum custo externo é buscado automaticamente.')
  actions.push({label:'Abrir Fee Analyzer',href:'/apps/wealth/tarifas'})
 }else if(intent==='alerts'&&context.alerts){
  answer='Há '+context.alerts.summary.active+' alerta(s) ativo(s), sendo '+context.alerts.summary.urgent+' urgente(s) e '+context.alerts.summary.attention+' de atenção.'
  const rows=topAlerts(context);if(rows.length)answer+=' Principais sinais: '+rows.map(a=>a.title+' — '+a.reason).join('; ')+'.'
  limitations.push('Alertas são sinais derivados dos seus próprios dados; não confirmam eventos externos.')
  actions.push({label:'Abrir Alerts',href:'/apps/wealth/alertas'})
 }else if(summary&&net){
  answer='No contexto atual, seu patrimônio líquido registrado é '+formatMoney(net.netWorth)+' e o fluxo do mês é '+formatMoney(summary.cashFlow)+'.'
  if(context.alerts)answer+=' Existem '+context.alerts.summary.active+' alerta(s) ativo(s).'
  if(net.unknownValuations&&net.unknownValuations!=='0')answer+=' O patrimônio é parcial porque há '+net.unknownValuations+' posição(ões) sem avaliação.'
  actions.push({label:'Abrir visão geral',href:'/apps/wealth'})
 }else{
  answer='Não há dados confirmados suficientes nas fontes carregadas para responder sem estimar.'
  limitations.push('As fontes principais do Wealth estão indisponíveis nesta consulta.')
  actions.push({label:'Abrir Wealth',href:'/apps/wealth'})
 }

 if(request.mode==='simulation'){
  hypotheses.push('Modo simulação: nenhuma premissa numérica ausente é inferida.')
  limitations.push('Para projeções numéricas, use apenas premissas explicitamente informadas e simuladores determinísticos do Wealth.')
  actions.unshift({label:'Abrir simuladores e planejamento',href:'/apps/wealth/planejamento'})
 }
 if(request.mode==='planning')hypotheses.push('Modo planejamento: sugestões são próximos passos organizacionais, não ordens ou recomendações reguladas.')
 if(request.mode==='education')limitations.push('Conteúdo educacional não substitui orientação profissional individualizada.')

 return {answer,hypotheses,limitations,actions,boundary:null}
}

export function compactAskContext(context:AskContext,intent:AskIntent){
 const ids=intentSources[intent]
 const out:Record<string,unknown>={date:context.date,timezone:context.timezone}
 if(ids.includes('summary')&&context.summary)out.summary={month:context.summary.month,income:context.summary.income,expenses:context.summary.expenses,cashFlow:context.summary.cashFlow,assets:context.summary.assets,liabilities:context.summary.liabilities,netWorth:context.summary.netWorth,goalCount:context.summary.goalCount,goalTarget:context.summary.goalTarget,goalSaved:context.summary.goalSaved,months:context.summary.months}
 if(ids.includes('net_worth')&&context.netWorth)out.net_worth={assets:context.netWorth.assets,liabilities:context.netWorth.liabilities,netWorth:context.netWorth.netWorth,unknownValuations:context.netWorth.unknownValuations??'0',classes:context.netWorth.classes,liquidity:context.netWorth.liquidity,largest:context.netWorth.largest.slice(0,10)}
 if(ids.includes('health'))out.health=context.health.map(x=>({id:x.id,value:x.value,source:x.source,period:x.period,interpretation:x.interpretation,limitation:x.limitation}))
 if(ids.includes('goals'))out.goals=context.goals.slice(0,20)
 if(ids.includes('alerts')&&context.alerts)out.alerts={summary:context.alerts.summary,alerts:context.alerts.alerts.slice(0,10).map(a=>({priority:a.priority,source:a.source,title:a.title,reason:a.reason,event_date:a.event_date,deep_link:a.deep_link}))}
 if(ids.includes('tax')&&context.tax)out.tax={from:context.tax.from,to:context.tax.to,taxes:context.tax.taxes,income:context.tax.income,sell_proceeds:context.tax.sell_proceeds,basis_removed:context.tax.basis_removed,realized_gain:context.tax.realized_gain,incomplete_sell_count:context.tax.incomplete_sell_count,tax_provider_status:context.tax.tax_provider_status,tax_rules_status:context.tax.tax_rules_status,jurisdiction_status:context.tax.jurisdiction_status}
 if(ids.includes('fees')&&context.fees)out.fees={from:context.fees.from,to:context.fees.to,fees:context.fees.fees,taxes:context.fees.taxes,external_status:context.fees.external_status,previous:context.fees.previous}
 return out
}

export function providerInstructions(mode:AskMode){
 return [
  'Você é o Ask Wealth, assistente contextual do Orçaly Wealth.',
  'Responda em português do Brasil e use SOMENTE o contexto JSON fornecido para fatos sobre o usuário.',
  'Nunca invente valores, saldos, cotações, notícias, provider, imposto devido ou dados ausentes.',
  'Nunca recomende compra/venda individualizada de ativo como aconselhamento regulado e nunca execute transações.',
  'regulated_advice e execution estão OFF.',
  'Não peça nem tente consultar outro produto. Cross-product context está desativado.',
  'Valores monetários no contexto são centavos inteiros exatos; converta para BRL com duas casas quando necessário.',
  'Modo solicitado: '+mode+'. Em simulation/planning, declare premissas e não invente as que faltarem.',
  'Se o contexto não sustentar uma afirmação, diga explicitamente que não há dado suficiente.',
  'Se a pergunta pedir mercado atual, diga que Market/Radar está NOT_CONFIGURED.',
  'Responda de forma curta, útil e explicável. Não inclua links inventados.'
 ].join('\n')
}

export function providerInput(context:AskContext,request:AskRequest,intent:AskIntent){
 return JSON.stringify({question:request.question,mode:request.mode,context:compactAskContext(context,intent)},null,2)
}

export function providerOutputText(value:unknown){
 if(!value||typeof value!=='object')return ''
 const root=value as Record<string,unknown>,output=Array.isArray(root.output)?root.output:[]
 const parts:string[]=[]
 for(const item of output){
  if(!item||typeof item!=='object')continue
  const content=Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[]
  for(const part of content)if(part&&typeof part==='object'&&(part as Record<string,unknown>).type==='output_text'&&typeof (part as Record<string,unknown>).text==='string')parts.push(String((part as Record<string,unknown>).text))
 }
 return parts.join('\n').trim().slice(0,8000)
}
