import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate,uuid} from '@/lib/wealth/core'
import {readNetWorth,sharePercent,classLabels,liquidityLabels,type NetWorth} from '@/lib/wealth/net-worth'
import {CaptureNetWorth,PositionClassification} from '@/components/wealth/WealthNetWorthForms'
import styles from '@/components/ecosystem/ecosystem.module.css'

function Composition({data}:{data:NetWorth}){
 return <>
  {data.unknownValuations&&data.unknownValuations!=='0'&&<p className={styles.notice}>Patrimônio parcial: {data.unknownValuations} posições sem avaliação. Valores desconhecidos não entram nos totais; consulte Portfolio.</p>}
  <dl className={styles.metricGrid}><div className={styles.metric}><dt>Ativos declarados</dt><dd>{formatMoney(data.assets)}</dd></div><div className={styles.metric}><dt>Passivos declarados</dt><dd>{formatMoney(data.liabilities)}</dd></div><div className={styles.metric}><dt>Patrimônio líquido</dt><dd>{formatMoney(data.netWorth)}</dd></div></dl>
  <p>{data.positionCount} posições ativas. Patrimônio líquido = ativos − passivos. Os mesmos passivos são usados na Central de Dívidas.</p>
  <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela financeira com rolagem horizontal"><table className={styles.table}><caption>Composição integral por classe</caption><thead><tr><th>Tipo</th><th>Classe</th><th>Valor</th><th>Participação no tipo</th></tr></thead><tbody>{data.classes.map(row=><tr key={`${row.kind}-${row.class}`}><td>{row.kind==='asset'?'Ativo':'Passivo'}</td><td>{classLabels[row.class]} ({row.count})</td><td>{formatMoney(row.amount)}</td><td>{sharePercent(row.amount,row.kind==='asset'?data.assets:data.liabilities)}</td></tr>)}</tbody></table></div>
  {!data.classes.length&&<p>Nenhum ativo ou passivo declarado ainda.</p>}
  <h3>Liquidez dos ativos</h3><p>Classificação pessoal, sem promessa de prazo de resgate. Valores sem classificação permanecem visíveis como não informados. Liquidez de passivos é uma anotação e não reduz os ativos líquidos.</p>
  <ul>{data.liquidity.map(row=><li key={row.liquidity}>{liquidityLabels[row.liquidity]}: {formatMoney(row.amount)} · {sharePercent(row.amount,data.assets)}</li>)}</ul>
  <h3>Maiores posições e concentração</h3><p>Até dez posições por tipo, ordenadas por valor. Percentuais usam todos os ativos ou todos os passivos, inclusive os que não aparecem nesta lista. Concentração mede registros, não emissores ou exposição consolidada.</p>
  <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela financeira com rolagem horizontal"><table className={styles.table}><caption>Maiores ativos e passivos declarados</caption><thead><tr><th>Posição</th><th>Tipo / classe</th><th>Valor</th><th>Participação no tipo</th></tr></thead><tbody>{data.largest.map(row=><tr key={row.id}><td>{row.title}</td><td>{row.kind==='asset'?'Ativo':'Passivo'} / {classLabels[row.class]}</td><td>{formatMoney(row.amount)}</td><td>{sharePercent(row.amount,row.kind==='asset'?data.assets:data.liabilities)}</td></tr>)}</tbody></table></div>
 </>
}

export default async function NetWorthPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Patrimônio</h1><p>O acesso ao Wealth não está disponível para esta conta.</p><Link href="/apps">App Hub</Link></>
 const query=await searchParams
 const pageNumber=(value:unknown)=>typeof value==='string'&&/^[1-9]\d{0,4}$/.test(value)?Number(value):1
 const page=pageNumber(query.page),historyPage=pageNumber(query.history)
 const {db,user}=access.identity
 const [current,positions,history,write]=await Promise.all([
  db.rpc('wealth_net_worth'),
  db.from('wealth_entries').select('id,title,kind,amount_cents,position_class,liquidity,version,financial_date,valuation_status,wealth_holdings(id)',{count:'exact'}).eq('user_id',user.id).in('kind',['asset','liability']).is('archived_at',null).order('id').range((page-1)*25,page*25-1),
  db.from('wealth_net_worth_snapshots').select('id,composition',{count:'exact'}).eq('user_id',user.id).order('captured_at',{ascending:false}).order('id').range((historyPage-1)*25,historyPage*25-1),
  getPersonalProductAccess('wealth','wealth.write'),
 ])
 let data:NetWorth,snapshots:{id:string;data:NetWorth}[],selected:NetWorth|undefined
 try{
  if(current.error||positions.error||history.error)throw Error('unavailable')
  data=readNetWorth(current.data);snapshots=(history.data??[]).map(row=>({id:row.id,data:readNetWorth(row.composition)}))
  if(query.snapshot){const id=uuid(query.snapshot);const result=await db.from('wealth_net_worth_snapshots').select('composition').eq('user_id',user.id).eq('id',id).single();if(result.error)throw Error('unavailable');selected=readNetWorth(result.data.composition)}
 }catch{return <><h1>Patrimônio</h1><p className={styles.notice}>Não foi possível confirmar os valores ou o snapshot solicitado. Nenhum saldo foi estimado.</p><Link href="/apps/wealth/patrimonio">Voltar ao patrimônio atual</Link></>}
 return <>
  <Link className={styles.textButton} href="/apps/wealth">← Visão geral</Link><p className={styles.eyebrow}>Orçaly Wealth · Patrimônio pessoal</p><h1>O que você tem.<br/>O que você deve.</h1>
  <p className={styles.lead}>Ativos menos passivos, com valores declarados por você. Não são cotações de mercado. Arquivados não entram nos totais atuais.</p>
  <section className={styles.panel} aria-label="Patrimônio atual"><h2>Posição atual</h2><Composition data={data}/><p>Consulta: {new Date(data.capturedAt).toLocaleString('pt-BR',{timeZone:data.timezone})} · {data.timezone}. Data do saldo de cada posição é informada por você.</p></section>
  <section className={styles.panel}><h2>Classificar posições</h2><p>Liquidez: imediata = disponível agora; curto prazo = até 12 meses; médio prazo = mais de 12 meses; ilíquido = sem resgate previsível. A classificação é declarada, não verificada por uma instituição.</p><Link href="/apps/wealth">Adicionar ativo ou passivo</Link> · <Link href="/apps/wealth/dividas">Central de Dívidas</Link>
   <p>Página {page}. {positions.count??0} posições no total; até 25 por página.</p>
   {(positions.data??[]).map(entry=><details key={`${entry.id}-${entry.version}`} className={styles.panel}><summary>{entry.title} · {entry.valuation_status==='NOT_AVAILABLE'?'Avaliação indisponível':formatMoney(entry.amount_cents)}</summary><p>Saldo declarado em {formatFinancialDate(entry.financial_date)}. {classLabels[entry.position_class??'unclassified']} · {liquidityLabels[entry.liquidity as keyof typeof liquidityLabels]}.</p><Link href={`/apps/wealth/lancamentos/${entry.id}`}>Consultar ou editar o saldo</Link>{write.allowed&&(!entry.wealth_holdings||(Array.isArray(entry.wealth_holdings)&&!entry.wealth_holdings.length))&&<PositionClassification entry={{...entry,kind:entry.kind as 'asset'|'liability'}}/>}</details>)}
   <nav aria-label="Páginas de posições">{page>1&&<Link href={`?page=${page-1}&history=${historyPage}`}>← Posições anteriores</Link>} {page*25<(positions.count??0)&&<Link href={`?page=${page+1}&history=${historyPage}`}>Próximas posições →</Link>}</nav>
  </section>
  <section className={styles.panel}><h2>Evolução por snapshots</h2><p>O histórico começa quando você registra um snapshot. Nenhum saldo antigo é reconstruído. Cada snapshot preserva os totais e a composição daquele instante, mesmo após editar, quitar ou arquivar posições. Uma diferença entre snapshots pode refletir alterações de cadastro; não representa rentabilidade.</p>
   {write.allowed&&<CaptureNetWorth token={randomUUID()}/>}
   <p>Página {historyPage}. {history.count??0} snapshots; até 25 por página. Valores em BRL.</p>
   {snapshots.length?<div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela financeira com rolagem horizontal"><table className={styles.table}><caption>Histórico registrado explicitamente</caption><thead><tr><th>Captura / fuso</th><th>Ativos</th><th>Passivos</th><th>Patrimônio líquido</th></tr></thead><tbody>{snapshots.map(row=><tr key={row.id}><td><Link href={`?page=${page}&history=${historyPage}&snapshot=${row.id}`}>{new Date(row.data.capturedAt).toLocaleString('pt-BR',{timeZone:row.data.timezone})}</Link><br/>{row.data.timezone}</td><td>{formatMoney(row.data.assets)}</td><td>{formatMoney(row.data.liabilities)}</td><td>{formatMoney(row.data.netWorth)}</td></tr>)}</tbody></table></div>:<p>Nenhum snapshot nesta página. Registre os valores atuais para iniciar seu histórico.</p>}
   <nav aria-label="Páginas de snapshots">{historyPage>1&&<Link href={`?page=${page}&history=${historyPage-1}`}>← Snapshots anteriores</Link>} {historyPage*25<(history.count??0)&&<Link href={`?page=${page}&history=${historyPage+1}`}>Próximos snapshots →</Link>}</nav>
  </section>
  {selected&&<section className={styles.panel} aria-label="Snapshot selecionado"><h2>Snapshot de {formatFinancialDate(selected.localDate)}</h2><p>Fonte: declaração pessoal · {selected.timezone}. Diferença do patrimônio atual em relação a este snapshot: {formatMoney(BigInt(data.netWorth)-BigInt(selected.netWorth))}. Não é retorno de investimento.</p><Composition data={selected}/></section>}
 </>
}
