import Link from 'next/link'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { formatFinancialDate, formatMoney, type WealthEntry } from '@/lib/wealth/core'
import { entryKindLabels, exportRowLimit, parseWealthFilters, recordsPageSize, recordsQuery, type WealthFilters } from '@/lib/wealth/records'
import { ownedEntriesQuery } from '@/lib/wealth/records-server'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function WealthRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getPersonalProductAccess('wealth', 'wealth.read')
  if (!access.allowed || !access.identity) return <><h1>Seus lançamentos</h1><p className={styles.notice}>O acesso ao histórico do Wealth não está liberado para esta conta.</p><Link href="/apps">Voltar ao App Hub</Link></>
  let filters: WealthFilters
  try { filters = parseWealthFilters(await searchParams) }
  catch (error) { return <><h1>Confira os filtros</h1><p className={styles.notice}>{error instanceof Error ? error.message : 'Filtro inválido.'}</p><Link href="/apps/wealth/lancamentos">Limpar filtros</Link></> }
  const from = (filters.page - 1) * recordsPageSize
  const [result, exportAccess, writeAccess] = await Promise.all([
    ownedEntriesQuery(access.identity.db, access.identity.user.id, filters).range(from, from + recordsPageSize - 1),
    getPersonalProductAccess('wealth', 'wealth.export'),
    getPersonalProductAccess('wealth', 'wealth.write'),
  ])
  if (result.error || result.count === null) return <><h1>Seus lançamentos</h1><p className={styles.notice}>Não foi possível consultar seu histórico agora. Tente novamente.</p><Link href="/apps/wealth">Voltar ao Wealth</Link></>
  const entries = result.data as WealthEntry[]
  const pages = Math.max(1, Math.ceil(result.count / recordsPageSize))
  const exportQuery = recordsQuery(filters, 1)
  return <>
    <Link className={styles.textButton} href="/apps/wealth">← Visão geral do Wealth</Link>
    <p className={styles.eyebrow}>Orçaly Wealth · Histórico pessoal</p>
    <h1>Seus lançamentos</h1>
    <p className={styles.lead}>Consulte receitas, despesas, ativos e passivos que você registrou. Os filtros usam a data financeira do lançamento.</p>
    <section className={styles.panel} aria-labelledby="records-filters">
      <h2 id="records-filters">Encontrar registros</h2>
      <form action="/apps/wealth/lancamentos" method="get" className={styles.formGrid}>
        <label>Mês financeiro<input name="month" type="month" min="1900-01" max="2200-12" defaultValue={filters.month ?? ''} /></label>
        <label>Tipo de lançamento<select name="kind" defaultValue={filters.kind ?? ''}><option value="">Todos os tipos</option>{Object.entries(entryKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Arquivamento<select name="archive" defaultValue={filters.archive ?? 'active'}><option value="active">Ativos</option><option value="archived">Arquivados</option><option value="all">Todos</option></select></label>
        <button className={styles.primaryButton} type="submit">Aplicar filtros</button>
        <Link className={styles.textButton} href="/apps/wealth/lancamentos">Limpar filtros</Link>
      </form>
      <p>{result.count.toLocaleString('pt-BR')} lançamento(s) encontrado(s). Até {recordsPageSize} por página.</p>
    </section>
    <section className={styles.panel} aria-labelledby="records-results">
      <h2 id="records-results">Histórico</h2>
      {entries.length ? <div className={styles.tableWrap}><table className={styles.table}><caption>Lançamentos pessoais · página {filters.page} de {pages}</caption><thead><tr><th scope="col">Registro</th><th scope="col">Tipo</th><th scope="col">Data</th><th scope="col">Valor</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{writeAccess.allowed ? <Link href={`/apps/wealth/lancamentos/${entry.id}`}>{entry.title}</Link> : entry.title}</td><td>{entryKindLabels[entry.kind]}</td><td>{formatFinancialDate(entry.financial_date)}</td><td>{entry.valuation_status==='NOT_AVAILABLE'?'Avaliação indisponível':formatMoney(entry.amount_cents)}</td></tr>)}</tbody></table></div> : <p>Nenhum lançamento nesta página. Ajuste os filtros ou volte à primeira página.</p>}
      <nav className={styles.actions} aria-label="Paginação do histórico">
        {filters.page > 1 && <Link className={styles.textButton} href={`/apps/wealth/lancamentos?${recordsQuery(filters, filters.page - 1)}`}>Página anterior</Link>}
        {filters.page < pages && <Link className={styles.textButton} href={`/apps/wealth/lancamentos?${recordsQuery(filters, filters.page + 1)}`}>Próxima página</Link>}
        {filters.page > pages && <Link className={styles.textButton} href={`/apps/wealth/lancamentos?${recordsQuery(filters, 1)}`}>Primeira página</Link>}
      </nav>
    </section>
    <section className={styles.panel} aria-labelledby="records-export">
      <h2 id="records-export">Levar seus registros</h2>
      <p>O CSV reúne os resultados dos filtros, em BRL, com valores também em centavos. Cada exportação aceita até 1.000 lançamentos.</p>
      {!exportAccess.allowed ? <p>A permissão de exportação ainda não está liberada para esta conta.</p> : result.count > exportRowLimit ? <p>Escolha um mês ou tipo para reduzir o resultado antes de exportar.</p> : <a className={styles.textButton} href={`/apps/wealth/exportar${exportQuery ? `?${exportQuery}` : ''}`} download>Baixar CSV dos resultados</a>}
      <p>Nomes que parecem fórmulas recebem um apóstrofo de proteção. Preserve-o se editar ou importar o arquivo em outra ferramenta.</p>
    </section>
  </>
}
