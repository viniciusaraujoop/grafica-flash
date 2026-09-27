import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {taxFilters,readTaxCenter} from '@/lib/wealth/tax'
import {formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import s from '@/components/wealth/calendar.module.css'

const eventLabels={tax:'Imposto declarado',income:'Rendimento',dividend:'Dividendo',interest:'Juros',sell:'Venda'}

export default async function TaxCenterPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Tax Center</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const {db,user}=access.identity
 const profile=await db.from('wealth_profiles').select('timezone').eq('user_id',user.id).maybeSingle()
 if(profile.error)throw Error('Não foi possível confirmar o período local.')
 const zone=profile.data?.timezone??'America/Sao_Paulo'
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 let filters
 try{filters=taxFilters(await searchParams,today)}catch{return <><h1>Revise os filtros</h1><p>Use datas válidas em um intervalo de até 366 dias.</p><Link href="/apps/wealth/impostos">Limpar filtros</Link></>}
 const {from,to,page,portfolio}=filters
 const [rpc,documents]=await Promise.all([
  db.rpc('wealth_tax_center',{p_from:from,p_to:to,p_page:page,p_portfolio:portfolio}),
  db.from('wealth_documents').select('id,title,document_date',{count:'exact'}).eq('user_id',user.id).eq('category','tax').eq('status','active').order('document_date',{ascending:false}).order('id').limit(25)
 ])
 if(rpc.error?.code==='42501')return <><h1>Tax Center indisponível</h1><p>A carteira não está disponível para esta conta.</p><Link href="/apps/wealth/impostos">Consultar suas carteiras</Link></>
 if(rpc.error||documents.error)throw Error('Não foi possível consultar o Tax Center.')
 const v=readTaxCenter(rpc.data)
 const total=BigInt(v.record_count)>BigInt(v.portfolio_count)?BigInt(v.record_count):BigInt(v.portfolio_count),pages=(total+BigInt(24))/BigInt(25)
 const href=(n=1,id=portfolio)=>`?${new URLSearchParams({from,to,page:String(n),...(id?{portfolio:id}:{})})}`
 return <div className={s.page}>
  <nav className={s.nav} aria-label="Tax Center Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/impostos" aria-current="page">Tax Center</Link><Link href="/apps/wealth/tarifas">Fee Analyzer</Link><Link href="/apps/wealth/documentos">Documentos</Link></nav>
  <header className={s.hero}><div><span className={s.kicker}>Organize fatos antes de apurar</span><h1>Tax Center</h1><p>Reúna eventos declarados do Portfolio e documentos fiscais do Vault sem transformar dados incompletos em imposto devido.</p></div><aside>Fonte: ledger imutável das carteiras reais, em BRL. Regras tributárias, jurisdição, provedor fiscal e envio oficial: NOT_CONFIGURED.</aside></header>
  <p className={s.notice}>Esta fundação não calcula DARF, alíquota, compensação, isenção, custo fiscal oficial ou obrigação perante a Receita. Resultado realizado e base removida são valores declarados pelo ledger de Portfolio; podem estar ausentes e não substituem documentação fiscal.</p>
  <form className={s.filters} aria-label="Período fiscal"><label>Data inicial<input name="from" type="date" min="1900-01-01" max="2200-12-31" required defaultValue={from}/></label><label>Data final<input name="to" type="date" min="1900-01-01" max="2200-12-31" required defaultValue={to}/></label>{portfolio&&<input type="hidden" name="portfolio" value={portfolio}/>}<button className={s.button}>Revisar período</button></form>
  <p className={s.muted}>{formatFinancialDate(from)} a {formatFinancialDate(to)} · {v.days} dia(s) · fuso usado apenas para o período inicial: {zone}. Escopo: {v.selected?.name??'Todas as carteiras reais'}. {portfolio&&<Link href={href(1,null)}>Remover filtro</Link>}</p>
  {v.selected?.kind==='lab'&&<p className={s.notice}>A carteira selecionada é um cenário do Portfolio Lab. Cenários hipotéticos não entram no histórico fiscal declarado.</p>}
  <dl className={s.stats}>
   <div><dt>Impostos declarados</dt><dd>{formatMoney(v.taxes)}<small>{v.tax_count} evento(s). Não é imposto devido.</small></dd></div>
   <div><dt>Rendimentos registrados</dt><dd>{formatMoney(v.income)}<small>{v.income_count} evento(s) de rendimento, dividendo ou juros.</small></dd></div>
   <div><dt>Vendas registradas</dt><dd>{formatMoney(v.sell_proceeds)}<small>{v.sell_count} venda(s). Valor é o montante registrado no evento.</small></dd></div>
   <div><dt>Resultado realizado declarado</dt><dd>{formatMoney(v.realized_gain)}<small>Base removida declarada: {formatMoney(v.basis_removed)}.</small></dd></div>
  </dl>
  <section className={s.section}><h2>Cobertura e limitações</h2><p>{v.covered_portfolios} de {v.portfolio_count} carteira(s) real(is) possuem evento(s) fiscalmente relevante(s) neste período. {v.holding_count} posição(ões), {v.record_count} evento(s). {v.lab_count} cenário(s) Lab permanecem separados.</p><p>{v.complete_sell_count} venda(s) têm base removida e resultado realizado declarados; {v.incomplete_sell_count} venda(s) estão incompletas para essa leitura. Ausência de registro não significa ausência de obrigação.</p></section>
  <section className={s.section}><h2>Documentos fiscais no Vault</h2><p>{documents.count??0} documento(s) ativo(s) classificados como fiscal. A lista mostra até 25 e não interpreta o conteúdo automaticamente nesta fundação.</p>{documents.data?.length?<ul className={s.agenda}>{documents.data.map(doc=><li className={s.bill} key={doc.id}><h3>{doc.title}</h3><p>{doc.document_date?formatFinancialDate(doc.document_date):'Data não informada'}</p><Link href={`/apps/wealth/documentos/${doc.id}`}>Abrir documento</Link></li>)}</ul>:<p className={s.empty}>Nenhum documento fiscal ativo no Vault. Isso não indica inexistência de informes ou obrigações.</p>}<Link href="/apps/wealth/documentos">Abrir Vault</Link></section>
  <section className={s.section}><h2>Evolução mensal dos fatos registrados</h2>{v.months.length?<ul className={s.agenda}>{v.months.map(m=><li className={s.bill} key={m.month}><h3>{m.month.slice(5)}/{m.month.slice(0,4)}</h3><p>Impostos: {formatMoney(m.taxes)} · rendimentos: {formatMoney(m.income)} · vendas: {formatMoney(m.sell_proceeds)} · resultado realizado declarado: {formatMoney(m.realized_gain)}.</p><p>{m.records} evento(s) · {m.incomplete_sells} venda(s) com cobertura incompleta.</p></li>)}</ul>:<p className={s.empty}>Nenhum evento relevante registrado no período.</p>}</section>
  <section className={s.section}><h2>Carteiras no escopo</h2><p>Até 25 por página; totais acima consideram todo o escopo.</p>{v.portfolios.length?<ul className={s.agenda}>{v.portfolios.map(p=><li className={s.bill} key={p.id}><h3>{p.name}</h3><p>{p.records} evento(s) · impostos {formatMoney(p.taxes)} · rendimentos {formatMoney(p.income)} · vendas {formatMoney(p.sell_proceeds)} · resultado declarado {formatMoney(p.realized_gain)}.</p><p>{p.incomplete_sells} venda(s) incompleta(s).</p><nav className={s.nav} aria-label={`Ações fiscais de ${p.name}`}><Link href={href(1,p.id)}>Filtrar esta carteira</Link><Link href={`/apps/wealth/carteiras/${p.id}#movimentos`}>Revisar ledger de origem</Link></nav></li>)}</ul>:<p className={s.empty}>Nenhuma carteira real neste filtro.</p>}</section>
  <section className={s.section}><h2>Eventos de origem</h2><p>Página {page} · até 25 eventos, ordenados por data financeira. O Tax Center não cria lançamentos de caixa nem altera o ledger.</p>{v.records.length?<ol className={s.agenda}>{v.records.map(r=><li className={s.bill} key={r.id} data-tax-record={r.id}><div className={s.billHeader}><h3>{eventLabels[r.type]} · {r.title}</h3><strong>{formatMoney(r.amount_cents)}</strong></div><p><time dateTime={r.financial_date}>{formatFinancialDate(r.financial_date)}</time> · {r.portfolio_name}{r.archived?' · posição arquivada':''}</p>{r.type==='sell'&&<p>Base removida declarada: {r.basis_removed_cents===null?'não informada':formatMoney(r.basis_removed_cents)} · resultado realizado declarado: {r.realized_gain_cents===null?'não informado':formatMoney(r.realized_gain_cents)}.</p>}<p>Referência: {r.reference}</p><Link href={`/apps/wealth/carteiras/${r.portfolio_id}#movimentos`}>Conferir no ledger</Link></li>)}</ol>:<p className={s.empty}>Nenhum evento nesta página.</p>}</section>
  <nav className={s.nav} aria-label="Paginação Tax Center">{page>1&&<Link href={href(page-1)}>Página anterior</Link>}{BigInt(page)<pages&&<Link href={href(page+1)}>Próxima página</Link>}</nav>
  <section className={s.section}><h2>Próxima revisão</h2><p>Confronte os eventos do ledger com informes, notas e documentos do Vault. Quando a camada tributária regulatória existir, ela deverá declarar jurisdição, regras, fontes e versão antes de calcular qualquer obrigação. Até lá, o Tax Center organiza evidências, não substitui contador nem declaração oficial.</p></section>
 </div>
}
