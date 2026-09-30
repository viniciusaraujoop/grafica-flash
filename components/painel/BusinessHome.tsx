'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { FoundationRoot, foundationStyles as f } from '@/components/orcaly-next/foundation/primitives'
import { getAccessTokenClient } from '@/lib/current-company-client'
import styles from './BusinessHome.module.css'

type Attention = { id: string; title: string; description: string; href: string }
type TodayPayload = {
  generatedAt: string
  attention: Attention[]
  totals: { attention: number; critical: number; high: number }
  summary: { salesToday: number; ordersToday: number; receiptsToday: number; openProposals: number; tasksToday: number; deliveries: number; customersWaiting: number; opportunityValue: number }
  dataHealth?: Record<string, string | null>
}

function money(value: number) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function dateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}
const quickLinks = [
  { label: 'Pedidos', href: '/painel/pedidos' }, { label: 'Clientes', href: '/painel/clientes' },
  { label: 'Financeiro', href: '/painel/financeiro' }, { label: 'Entregas', href: '/painel/entregas' },
  { label: 'Configurações', href: '/painel/configuracoes' },
] as const

async function requestToday(): Promise<TodayPayload> {
  const token = await getAccessTokenClient()
  const offset = new Date().getTimezoneOffset()
  const response = await fetch(`/api/panel/today?offset=${offset}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o estado atual da empresa.')
  return data as TodayPayload
}

export default function BusinessHome() {
  const [payload, setPayload] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setPayload(await requestToday()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o estado atual da empresa.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    void requestToday()
      .then((data) => { if (active) setPayload(data) })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o estado atual da empresa.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const healthWarnings = useMemo(() => payload?.dataHealth ? Object.values(payload.dataHealth).filter(Boolean).length : 0, [payload])

  if (loading) return (
    <FoundationRoot skin="business" className={styles.root}>
      <div className={styles.loading} role="status" aria-label="Carregando estado atual do Business">
        <div className={`${styles.skeleton} ${styles.skeletonHero}`} /><div className={`${styles.skeleton} ${styles.skeletonAction}`} />
        <div className={styles.skeletonMetrics}>{Array.from({ length: 4 }, (_, index) => <div key={index} className={`${styles.skeleton} ${styles.skeletonMetric}`} />)}</div>
      </div>
    </FoundationRoot>
  )

  if (error || !payload) return (
    <FoundationRoot skin="business" className={styles.root}>
      <section className={styles.error} role="alert"><div><p className={styles.eyebrow}>Business indisponível</p><h2>Não conseguimos montar sua Home agora.</h2><p>{error || 'Tente carregar novamente.'}</p></div>
        <button type="button" className={`${f.button} ${f.buttonPrimary}`} onClick={() => void load()}>Tentar novamente</button></section>
    </FoundationRoot>
  )

  const priority = payload.attention[0] ?? null
  const recent = payload.attention.slice(1, 3)
  const summary = payload.summary
  const hasMovement = payload.totals.attention > 0 || Object.values(summary).some((value) => Number(value || 0) !== 0)
  const currentState = payload.totals.attention > 0 ? `${payload.totals.attention} ${payload.totals.attention === 1 ? 'item pede' : 'itens pedem'} atenção.` : 'A operação está em dia neste momento.'
  const updatedAt = dateTime(payload.generatedAt)

  return (
    <FoundationRoot skin="business" className={styles.root}>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="business-state"><p className={styles.eyebrow}>Estado atual</p><div className={styles.heroLine}><div>
          <h2 id="business-state">{currentState}</h2><p>{healthWarnings > 0 ? `${healthWarnings} fonte(s) de dados não responderam. Esta Home mostra apenas o que foi confirmado.` : `${updatedAt ? `Atualizado ${updatedAt}` : 'Atualizado agora'} com os dados operacionais já existentes.`}</p>
        </div><button type="button" className={f.button} onClick={() => void load()}>Atualizar</button></div></section>

        <section className={styles.priority} aria-labelledby="business-priority"><div><p className={styles.eyebrow}>Próxima ação</p><h2 id="business-priority">{priority ? priority.title : 'Nenhuma urgência detectada agora.'}</h2><p>{priority ? priority.description : 'Continue acompanhando pedidos, clientes e recebimentos conforme a operação avança.'}</p></div>
          <Link className={`${f.button} ${f.buttonPrimary}`} href={priority?.href || '/painel/pedidos'}>{priority ? 'Resolver agora' : 'Ver pedidos'}</Link></section>

        {!hasMovement ? (
          <section className={styles.empty} aria-labelledby="business-empty"><div><p className={styles.eyebrow}>Sem movimento confirmado</p><h2 id="business-empty">Ainda não há atividade relevante para resumir hoje.</h2><p>Quando pedidos, recebimentos, propostas ou retornos aparecerem, a Home passa a destacar somente o que precisa de atenção.</p></div><Link className={f.button} href="/painel/central-operacional">Abrir central operacional</Link></section>
        ) : (
          <section className={styles.metrics} aria-labelledby="business-metrics"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Contexto</p><h2 id="business-metrics">Poucos números, os que ajudam a decidir.</h2></div></div><dl>
            <div><dt>Vendas hoje</dt><dd>{money(summary.salesToday)}</dd></div><div><dt>Pedidos hoje</dt><dd>{summary.ordersToday.toLocaleString('pt-BR')}</dd></div><div><dt>Recebimentos</dt><dd>{money(summary.receiptsToday)}</dd></div><div><dt>Clientes aguardando</dt><dd>{summary.customersWaiting.toLocaleString('pt-BR')}</dd></div>
          </dl></section>
        )}

        {recent.length ? <section className={styles.recent} aria-labelledby="business-recent"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Contexto recente</p><h2 id="business-recent">Depois da prioridade</h2></div><Link href="/painel/central-operacional">Ver toda a fila</Link></div><ul>
          {recent.map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{item.description}</small></span><Link href={item.href}>Abrir</Link></li>)}
        </ul></section> : null}

        <nav className={styles.quick} aria-label="Acessos rápidos do Business"><span>Ir para</span>{quickLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      </div>
    </FoundationRoot>
  )
}
