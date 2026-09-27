import assert from 'node:assert/strict'
import {test} from 'node:test'
import {registerHooks} from 'node:module'
const hook=registerHooks({resolve(s,c,next){return next(s==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:s,c)}})
const {
 parseAskRequest,classifyAsk,hasRestrictedFinancialIntent,localAskAnswer,askSources,compactAskContext,
 validateAskGoals,providerInstructions,providerInput,providerOutputText
}=await import('../lib/wealth/ask.ts');hook.deregister()

const summary={currency:'BRL',month:'2026-09',income:'500000',expenses:'200000',assets:'1000000',liabilities:'250000',netWorth:'750000',cashFlow:'300000',entryCount:'8',goalCount:'1',completedGoals:'0',goalTarget:'600000',goalSaved:'120000',goalContributions:'20000',reserveTarget:'400000',contributionCapacity:'100000',unknownValuations:'1',months:Array.from({length:12},(_,i)=>({month:'2025-'+String(i+1).padStart(2,'0'),income:'0',expenses:'0',cashFlow:'0'})),categories:[]}
const netWorth={currency:'BRL',source:'owner_declared',capturedAt:'2026-09-27T12:00:00-03:00',localDate:'2026-09-27',timezone:'America/Sao_Paulo',assets:'1000000',liabilities:'250000',netWorth:'750000',positionCount:'3',unknownValuations:'1',classes:[{kind:'asset',class:'cash',amount:'400000',count:'1'},{kind:'asset',class:'stock',amount:'600000',count:'1'},{kind:'liability',class:'personal_loan',amount:'250000',count:'1'}],liquidity:[{liquidity:'immediate',amount:'400000',count:'1'},{liquidity:'short_term',amount:'600000',count:'1'}],largest:[{id:'a',title:'Ações QA',kind:'asset',amount:'600000',class:'stock',liquidity:'short_term'},{id:'b',title:'Caixa QA',kind:'asset',amount:'400000',class:'cash',liquidity:'immediate'},{id:'c',title:'Dívida QA',kind:'liability',amount:'250000',class:'personal_loan',liquidity:'unknown'}]}
const health=[
 {id:'burden',title:'Comprometimento',value:'10,00%',source:'Debt Center',period:'2026-09',rule:'x',interpretation:'y',limitation:'termos declarados'},
 {id:'trend',title:'Variação',value:'R$ 500,00',source:'Snapshots',period:'2026-08 → 2026-09',rule:'x',interpretation:'y',limitation:'não é rentabilidade'},
 {id:'concentration',title:'Concentração',value:'60,00%',source:'Patrimônio',period:'2026-09-27',rule:'x',interpretation:'y',limitation:'por registro'},
]
const alerts={date:'2026-09-27',timezone:'America/Sao_Paulo',preferences:{enabled:true,minimum_priority:'info',cooldown_hours:24,muted_sources:[],version:0},summary:{active:'2',urgent:'1',attention:'1',snoozed:'0',dismissed:'0',muted:'0'},source_coverage:{recurrence:'ACTIVE',debt:'ACTIVE',goal:'ACTIVE',vault:'ACTIVE',shield:'ACTIVE',portfolio:'ACTIVE',tax:'ACTIVE',automation:'ACTIVE'},view:'active',count:'2',alerts:[{alert_key:'x',priority:'urgent',source:'debt',reason:'Vencida',entity_id:'a',title:'Dívida vencida',detail:'Detalhe',deep_link:'/apps/wealth/dividas',event_date:'2026-09-26',state:'active',notification_eligible:true,cooldown_until:null,snoozed_until:null,dismissed_at:null}]}
const tax={from:'2026-01-01',to:'2026-09-27',days:270,page:1,currency:'BRL',coverage:'DECLARED_LEDGER_ONLY',tax_provider_status:'NOT_CONFIGURED',tax_rules_status:'NOT_CONFIGURED',jurisdiction_status:'UNSPECIFIED',filing_status:'NOT_CONFIGURED',selected:null,taxes:'12000',income:'50000',sell_proceeds:'100000',basis_removed:'70000',realized_gain:'30000',record_count:'3',tax_count:'1',income_count:'1',sell_count:'1',complete_sell_count:'0',incomplete_sell_count:'1',holding_count:'1',portfolio_count:'1',covered_portfolios:'1',lab_count:'0',portfolios:[],months:[],records:[]}
const fees={from:'2026-09-01',to:'2026-09-27',days:27,page:1,currency:'BRL',coverage:'DECLARED_ONLY',external_status:'NOT_CONFIGURED',selected:null,previous:null,fees:'3500',taxes:'12000',record_count:'2',holding_count:'1',portfolio_count:'1',covered_portfolios:'1',lab_count:'0',portfolios:[],months:[],records:[]}
const goals=[{id:'g',title:'Casa',target_cents:'600000',saved_cents:'120000',monthly_contribution_cents:'20000',target_date:'2027-12-01',status:'active'}]
const context={date:'2026-09-27',timezone:'America/Sao_Paulo',month:'2026-09-01',year_from:'2026-01-01',summary,netWorth,health,goals,alerts,tax,fees,unavailable:[]}

test('request contract allows only non-regulated modes and rejects client-supplied context or SQL',()=>{
 assert.deepEqual(parseAskRequest({question:'Como estou?',mode:'analysis'}),{question:'Como estou?',mode:'analysis',provider_consent:false});assert.equal(parseAskRequest({question:'Como estou?',mode:'analysis',provider_consent:true}).provider_consent,true);assert.throws(()=>parseAskRequest({question:'x',mode:'analysis',provider_consent:'yes'}))
 for(const mode of ['regulated_advice','execution','free',''])assert.throws(()=>parseAskRequest({question:'x',mode}))
 for(const payload of [{question:'x',mode:'analysis',sql:'select *'},{question:'x',mode:'analysis',tools:['db']},{question:'x',mode:'analysis',include_cross_product:true}])assert.throws(()=>parseAskRequest(payload))
 assert.throws(()=>parseAskRequest({question:'x'.repeat(2001),mode:'analysis'}))
})

test('deterministic classifier covers Wealth sources and current-market boundary',()=>{
 assert.equal(classifyAsk('Como está meu patrimônio?'),'net_worth')
 assert.equal(classifyAsk('Minha dívida está alta?'),'debt')
 assert.equal(classifyAsk('Como estão minhas metas?'),'goals')
 assert.equal(classifyAsk('Explique minha carteira e liquidez'),'portfolio')
 assert.equal(classifyAsk('Tenho imposto ou DARF?'),'tax')
 assert.equal(classifyAsk('Quanto paguei de tarifas?'),'fees')
 assert.equal(classifyAsk('Quais alertas estão ativos?'),'alerts')
 assert.equal(classifyAsk('Qual o dólar agora?'),'market')
 assert.equal(classifyAsk('Me dê um resumo'),'overview')
})

test('local analysis is exact, traceable and never turns missing market data into facts',()=>{
 const r=localAskAnswer(context,{question:'Como está meu patrimônio?',mode:'analysis'})
 assert.ok(r.answer.includes('7.500,00'));assert.ok(r.answer.includes('10.000,00'));assert.ok(r.answer.includes('2.500,00'))
 assert.match(r.answer,/1 posição/)
 const sources=askSources(context,'net_worth');assert.deepEqual(sources.map(x=>x.id),['net_worth','health','summary']);assert.ok(sources.every(x=>x.href==='/apps/wealth'||x.href.startsWith('/apps/wealth/')))
 const market=localAskAnswer(context,{question:'Qual o dólar agora?',mode:'analysis'});assert.equal(market.boundary,'MARKET_NOT_CONFIGURED');assert.match(market.answer,/não possui feed de mercado/)
})

test('regulated recommendation and execution language is stopped before any provider',()=>{
 for(const q of ['Qual ativo comprar?','Devo vender minhas ações?','Compre para mim','Execute uma transferência','Melhor investimento para mim'])assert.equal(hasRestrictedFinancialIntent(q),true)
 const result=localAskAnswer(context,{question:'Qual ativo comprar?',mode:'planning'})
 assert.equal(result.boundary,'REGULATED_OR_EXECUTION_OFF');assert.match(result.answer,/execução financeira estão desativados/)
 assert.ok(result.limitations.includes('regulated_advice = OFF'));assert.ok(result.limitations.includes('execution = OFF'))
})

test('goal, tax and fee answers preserve declared-data limitations',()=>{
 const goal=localAskAnswer(context,{question:'Minha meta da casa está como?',mode:'planning'});assert.match(goal.answer,/Casa/);assert.ok(goal.answer.includes('1.200,00'));assert.ok(goal.hypotheses.length)
 const tx=localAskAnswer(context,{question:'Quanto tenho de imposto?',mode:'analysis'});assert.ok(tx.answer.includes('120,00'));assert.match(tx.limitations.join(' '),/não é imposto devido/i)
 const fee=localAskAnswer(context,{question:'Quais tarifas paguei?',mode:'analysis'});assert.ok(fee.answer.includes('35,00'));assert.match(fee.limitations.join(' '),/eventos declarados/i)
})

test('provider payload is allowlisted, bounded and output parser reads only output_text',()=>{
 const compact=compactAskContext(context,'debt')
 assert.ok(compact.net_worth);assert.ok(compact.health);assert.ok(!Object.hasOwn(compact,'tax'));assert.ok(!Object.hasOwn(compact,'fees'));assert.ok(!Object.hasOwn(compact,'goals'))
 const input=providerInput(context,{question:'Como estão minhas dívidas?',mode:'analysis'},'debt')
 assert.ok(!input.includes('Foreign User'));assert.ok(input.length<20000)
 const instructions=providerInstructions('analysis');assert.match(instructions,/regulated_advice e execution estão OFF/);assert.match(instructions,/SOMENTE o contexto JSON/)
 assert.equal(providerOutputText({output:[{content:[{type:'output_text',text:'Resposta segura'}]}]}),'Resposta segura')
 assert.equal(providerOutputText({output:[{content:[{type:'tool_call',text:'não'}]}]}),'')
})

test('goal validator rejects malformed monetary/date context',()=>{
 assert.equal(validateAskGoals(goals)[0].title,'Casa')
 assert.throws(()=>validateAskGoals([{...goals[0],target_cents:'1.5'}]))
 assert.throws(()=>validateAskGoals([{...goals[0],target_date:'2026-02-30'}]))
})
