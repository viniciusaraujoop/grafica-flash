import Link from 'next/link'
import {notFound} from 'next/navigation'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate,uuid} from '@/lib/wealth/core'
import {readPortfolio,transactionLabels,valuationLabels,type PortfolioView} from '@/lib/wealth/portfolio'
import {classLabels,liquidityLabels,sharePercent} from '@/lib/wealth/net-worth'
import {readHealthInputs} from '@/lib/wealth/health'
import PortfolioForm from '@/components/wealth/PortfolioForm'
import {PortfolioSettings,AllocationFields,HoldingFields,TransactionFields} from '@/components/wealth/PortfolioFields'
import PortfolioSimulators from '@/components/wealth/PortfolioSimulators'
import styles from '@/components/wealth/portfolio.module.css'

function Distribution({view,dimension}:{view:PortfolioView;dimension:string}){
 const rows=view.groups.filter(g=>g.dimension===dimension)
 const label=(s:string)=>dimension==='class'?classLabels[s]:dimension==='liquidity'?liquidityLabels[s as keyof typeof liquidityLabels]:s
 return rows.length?<ul className={styles.allocation}>{rows.map(g=><li key={g.label}><span><strong>{label(g.label)}</strong><span>{sharePercent(g.amount,view.value)}</span></span><progress aria-label={`${label(g.label)}: ${sharePercent(g.amount,view.value)}`} max={10000} value={BigInt(view.value)>BigInt(0)?Number(BigInt(g.amount)*BigInt(10000)/BigInt(view.value)):0}/><span>{formatMoney(g.amount)}<small>{g.count} posições</small></span></li>)}</ul>:<p>Sem posições nesta composição.</p>
}
export default async function PortfolioPage({params,searchParams}:{params:Promise<{portfolioId:string}>;searchParams:Promise<{page?:string;holding?:string}>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Carteira</h1><p>Seu acesso ao Wealth não está disponível.</p><Link href="/apps">App Hub</Link></>
 let id:string;try{id=uuid((await params).portfolioId)}catch{notFound()}
 const {db,user}=access.identity,search=await searchParams,page=/^[1-9]\d{0,5}$/.test(search.page??'')?Number(search.page):1
 const [result,health,goals,assets,write]=await Promise.all([
  db.rpc('wealth_portfolio_view',{p_id:id,p_page:page}),db.rpc('wealth_health_inputs'),
  db.from('wealth_goals').select('id,title',{count:'exact'}).eq('user_id',user.id).is('archived_at',null).order('id').limit(100),
  db.from('wealth_entries').select('id,title,version,wealth_holdings(id)').eq('user_id',user.id).eq('kind','asset').is('archived_at',null).order('id').range((page-1)*25,page*25-1),
  getPersonalProductAccess('wealth','wealth.write'),
 ])
 if(result.error?.code==='42501')notFound()
 let view,input
 try{if(result.error||health.error||goals.error||assets.error)throw Error('unavailable');view=readPortfolio(result.data);input=readHealthInputs(health.data)}catch{return <><h1>Carteira</h1><p>Não foi possível confirmar os dados completos. Tente novamente.</p><Link href="/apps/wealth/carteiras">Suas carteiras</Link></>}
 const p=view.portfolio,lab=p.kind==='lab',today=input.positions.localDate,selected=view.holdings.find(h=>h.id===search.holding)
 const existing=(assets.data??[]).filter(e=>!e.wealth_holdings||(Array.isArray(e.wealth_holdings)&&!e.wealth_holdings.length))
 const maxPages=(BigInt(view.holdingCount)>BigInt(view.transactionCount)?BigInt(view.holdingCount):BigInt(view.transactionCount))+BigInt(24)
 const gap=BigInt(input.summary.goalTarget)-BigInt(input.summary.goalSaved)
 const labValue=p.lab_positions.reduce((s,r)=>s+BigInt(r.amount),BigInt(0)).toString()
 return <div className={styles.page}>
  <Link href="/apps/wealth/carteiras">← Suas carteiras</Link>
  <header className={styles.hero}><div><span className={styles.kicker}>{lab?'Portfolio Lab · cenário isolado':'Orçaly Wealth · Portfolio'}</span><h1>{p.name}</h1><p>{lab?'Um lugar para experimentar composições. Tudo aqui é hipotético e fica fora do patrimônio real.':'Sua composição, seus movimentos e a origem de cada valor, em uma única visão.'}</p>{view.goalTitle&&<p>Conectada à meta: <strong>{view.goalTitle}</strong>. O vínculo não transfere nem reserva dinheiro.</p>}</div>
   <dl className={styles.balance}><dt>{lab?'Valor hipotético':'Valor conhecido da carteira'}</dt><dd>{formatMoney(lab?labValue:view.value)}<small>{lab?'Somente premissas salvas no Lab.':`${view.activeCount} posições ativas · ${view.unknownValuations} sem avaliação.`}</small><small>Moeda dos valores: BRL. Mercado não configurado.</small></dd></dl>
  </header>
  <nav className={styles.nav} aria-label="Nesta carteira">{!lab&&<><a href="#posicoes">Posições</a><a href="#raiox">Raio X</a><a href="#movimentos">Movimentos</a><Link href={`/apps/wealth/tarifas?portfolio=${id}`}>Analisar custos</Link></>}<a href="#simuladores">Simuladores</a><a href="#configurar">Alocação e ajustes</a><Link href="/apps/wealth/patrimonio">Patrimônio</Link></nav>
  {!lab&&<>
   {view.unknownValuations!=='0'&&<p className={styles.notice} role="status">Visão parcial: {view.unknownValuations} posições precisam de avaliação. Seus valores desconhecidos não entram nos totais. Atualize o valor total após movimentar quantidades.</p>}
   <dl className={styles.stats}><div><dt>Custo de aquisição conhecido</dt><dd>{formatMoney(view.knownBasis)}</dd></div><div><dt>Variação sobre custo comparável</dt><dd>{formatMoney(view.gain)}</dd></div><div><dt>Posições sem custo conhecido</dt><dd>{view.unknownBasis}</dd></div></dl>
   <p>Variação = {formatMoney(view.comparableValue)} avaliados − {formatMoney(view.comparableBasis)} de custo nessas mesmas posições. Exclui posições sem custo ou sem avaliação; não representa retorno total, anualizado ou apuração tributária.</p>
   <section className={styles.section} id="posicoes"><h2>Suas posições</h2><p>Ativos vinculados entram uma única vez no patrimônio. {view.holdingCount} registros, incluindo arquivados. Até 25 por página.</p>
    {view.holdings.length?<div className={styles.table} tabIndex={0} role="region" aria-label="Posições da carteira"><table><caption>Posições · página {page}</caption><thead><tr><th>Ativo</th><th>Quantidade / custo</th><th>Avaliação</th><th>Origem e data</th></tr></thead><tbody>{view.holdings.map(h=><tr key={h.id}><td><Link href={`?page=${page}&holding=${h.id}#posicao`}>{h.title}</Link><small>{h.instrument} · {classLabels[h.class]}{h.archived_at?' · Arquivada':''}</small></td><td>{h.quantity}<small>{h.cost_basis_cents===null?'Custo desconhecido':formatMoney(h.cost_basis_cents)}</small></td><td>{h.valuation_status==='NOT_AVAILABLE'?'Indisponível':formatMoney(h.amount_cents)}</td><td>{valuationLabels[h.valuation_status]}<small>{formatFinancialDate(h.financial_date)} · {h.valuation_source}</small></td></tr>)}</tbody></table></div>:<p>Nenhuma posição nesta página. Adicione um ativo ou vincule um que já está no patrimônio.</p>}
    {write.allowed&&<><details className={styles.details}><summary>Adicionar posição</summary><p>Se este ativo já está no patrimônio, use o vínculo abaixo. Quantidade e custo são declarações iniciais, não compras retroativas. Para valor indisponível, informe zero; quantidade zero também exige valor e custo zero.</p><PortfolioForm operation="holding" token={randomUUID()} ids={{portfolio_id:id}} label="Salvar posição"><HoldingFields today={today}/></PortfolioForm></details>
     <details className={styles.details}><summary>Vincular ativo existente</summary><p>Preserva o saldo, a data e a classificação atuais. Lista os ativos livres da página {page} do patrimônio, até 25; use a navegação para consultar outras páginas.</p>{existing.length?<PortfolioForm operation="link" token={randomUUID()} ids={{portfolio_id:id}} label="Vincular posição"><label>Ativo existente<select name="existing_entry">{existing.map(e=><option key={e.id} value={`${e.id}|${e.version}`}>{e.title}</option>)}</select></label><HoldingFields today={today} link/></PortfolioForm>:<p>Nenhum ativo livre nesta página.</p>}</details></>}
   </section>
   {selected&&<section className={styles.section} id="posicao" aria-label="Posição selecionada"><h2>{selected.title}</h2><p>{selected.instrument} · {selected.quantity} unidades. {selected.archived_at?'Arquivada: fora dos totais atuais.':'Avaliação e movimentos preservam um único saldo.'}</p>
    {write.allowed&&<>{!selected.archived_at&&<><details className={styles.details}><summary>Atualizar avaliação e classificação</summary><p>Informe o valor total da posição, não o preço unitário. Extrato informado não é uma integração verificada. A moeda de exposição não converte o valor em BRL.</p><PortfolioForm key={`value-${selected.id}`} operation="value" token={randomUUID()} ids={{holding_id:selected.id,version:selected.version}} label="Salvar avaliação"><HoldingFields holding={selected} today={today}/></PortfolioForm></details>
     <details className={styles.details}><summary>Registrar movimento</summary><p>Compra e aporte somam quantidade e custo declarado. Venda e retirada reduzem quantidade pelo custo médio. Dividendos, rendimentos, juros, tarifas e impostos usam quantidade zero e só entram neste histórico; não geram lançamentos de caixa. Transferências usam valor zero e destino compatível desta página. Ajuste usa quantidade com sinal (zero corrige apenas o custo) e custo total substituto; vazio significa desconhecido. Toda alteração de quantidade exige nova avaliação.</p><PortfolioForm key={`transaction-${selected.id}`} operation="transaction" token={randomUUID()} ids={{holding_id:selected.id,version:selected.version}} label="Registrar movimento"><TransactionFields holding={selected} destinations={view.holdings} today={today}/></PortfolioForm></details></>}
     <details className={styles.details}><summary>{selected.archived_at?'Restaurar posição':'Arquivar posição'}</summary><PortfolioForm key={`lifecycle-${selected.id}`} operation={selected.archived_at?'restore':'archive'} token={randomUUID()} ids={{holding_id:selected.id,version:selected.version}} label={selected.archived_at?'Confirmar restauração':'Confirmar arquivamento'}><p>O histórico será preservado. Arquivadas ficam fora dos totais atuais.</p></PortfolioForm></details></>}
   </section>}
   <section className={styles.section} id="raiox"><h2>Raio X da carteira</h2><p>Percentuais usam todas as posições ativas avaliadas, independentemente da página. Informações ausentes permanecem desconhecidas. Concentração por ativo usa seu identificador; emissor e setor são declarados.</p><div className={styles.split}><div className={styles.section}><h3>Alocação por classe</h3><Distribution view={view} dimension="class"/></div><div className={styles.section}><h3>Concentração por ativo</h3><Distribution view={view} dimension="asset"/></div></div>
    {[['issuer','Emissores'],['sector','Setores'],['currency','Exposição por moeda'],['liquidity','Liquidez'],['maturity','Vencimentos']].map(([key,label])=><details key={key} className={styles.details}><summary>{label}</summary>{key==='currency'&&<p>Exposição informada, ponderada pelos valores declarados em BRL. Não infere moeda pelo nome do ativo e não utiliza câmbio estimado.</p>}<Distribution view={view} dimension={key}/></details>)}
   </section>
   <section className={styles.section} id="movimentos"><h2>Movimentos e proventos</h2><p>Histórico imutável de {view.transactionCount} registros. Correções usam novos ajustes; não apagam eventos antigos. Valores de compra/venda não são somados como um segundo patrimônio.</p>
    <ul>{view.cashFlows.map(c=><li key={c.type}>{transactionLabels[c.type]}: {formatMoney(c.amount)} · {c.count} registros</li>)}</ul>
    <div className={styles.table} tabIndex={0} role="region" aria-label="Histórico de movimentos"><table><caption>Até 25 movimentos por página · mais recentes primeiro</caption><thead><tr><th>Data / evento</th><th>Quantidade / valor</th><th>Ganho realizado declarado</th><th>Referência</th></tr></thead><tbody>{view.transactions.map(t=><tr key={t.id}><td>{formatFinancialDate(t.financial_date)}<small>{transactionLabels[t.type]}</small></td><td>{t.quantity}<small>{formatMoney(t.amount_cents)}</small></td><td>{t.realized_gain_cents===null?'Não calculado':formatMoney(t.realized_gain_cents)}</td><td>{t.reference}</td></tr>)}</tbody></table></div>
   </section>
   <nav className={styles.nav} aria-label="Páginas da carteira">{page>1&&<Link href={`?page=${page-1}`}>Página anterior</Link>}<span>Página {page}</span>{BigInt(page)<maxPages/BigInt(25)&&<Link href={`?page=${page+1}`}>Próxima página</Link>}<Link href={`?page=${page+1}#posicoes`}>Consultar próxima página de ativos livres</Link></nav>
  </>}
  {lab&&<section className={styles.section}><h2>Composição hipotética</h2>{p.lab_positions.length?<ul>{p.lab_positions.map((r,i)=><li key={i}>{classLabels[r.class]}: {formatMoney(r.amount)}</li>)}</ul>:<p>Defina valores por classe em Alocação e ajustes para começar a experimentar.</p>}</section>}
  {!lab&&input.positions.unknownValuations&&input.positions.unknownValuations!=='0'&&<p className={styles.notice}>O cenário de futuro parte de patrimônio parcial: {input.positions.unknownValuations} posições sem avaliação no seu espaço pessoal.</p>}
  <PortfolioSimulators key={`${p.version}-${view.value}-${view.unknownValuations}`} view={{portfolio:p,unknownValuations:view.unknownValuations,groups:view.groups.filter(g=>g.dimension==='class')}} initial={lab?labValue:input.positions.netWorth} goalGap={gap.toString()} goalContribution={input.summary.goalContributions} debtMinimum={input.debts.minimum}/>
  <section className={styles.section} id="configurar"><h2>Alocação e ajustes</h2><p>Alvos por classe são escolhas suas e devem somar 100%, ou ficar todos vazios. Não são uma recomendação. {lab?'Valores hipotéticos ficam apenas no Lab.':''}</p>
   {write.allowed?<details className={styles.details}><summary>Editar carteira, metas e alvos</summary><p>Seleção de metas: primeiras 100 por identificador. {goals.count??0} metas ativas no total.</p><PortfolioForm operation="configure" token={randomUUID()} ids={{portfolio_id:id,version:p.version}} label="Salvar configuração"><PortfolioSettings portfolio={p} goals={(goals.data??[]).some(g=>g.id===p.goal_id)||!p.goal_id||!view.goalTitle?goals.data??[]:[...(goals.data??[]),{id:p.goal_id,title:view.goalTitle}]}/><AllocationFields portfolio={p}/></PortfolioForm></details>:<p>Sua permissão atual permite apenas consulta.</p>}
  </section>
 </div>
}
