'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import { attentionPriorityLabels, type AttentionPriority } from '@/lib/operations-experience'
import styles from './TodayOperationsCenter.module.css'

type Attention = {
  id: string
  type: string
  title: string
  description: string
  priority: AttentionPriority
  href: string
  dueAt?: string | null
  value?: number | null
}

type TodayPayload = {
  generatedAt: string
  company: { id: string; name: string; businessType: string }
  attention: Attention[]
  totals: { attention: number; critical: number; high: number }
  summary: {
    salesToday: number
    ordersToday: number
    receiptsToday: number
    openProposals: number
    tasksToday: number
    deliveries: number
    customersWaiting: number
    opportunityValue: number
  }
  dataHealth?: Record<string, string | null>
}

type SummaryKey = keyof TodayPayload['summary']
type SummaryCard = {
  key: SummaryKey
  label: string
  href: string
  money?: boolean
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function priorityClass(priority: AttentionPriority) {
  if (priority === 'critical') return styles.priorityCritical
  if (priority === 'high') return styles.priorityHigh
  if (priority === 'info') return styles.priorityInfo
  return styles.priorityNormal
}

function iconFor(type: string) {
  const icons: Record<string, string> = {
    order_deadline: '↗',
    payment: '$',
    new_order: '+',
    proposal: 'P',
    task: '✓',
    followup: '↻',
    art: 'A',
    stock: '!',
    lead: 'C',
  }
  return icons[type] || '•'
}

function summarySentence(payload: TodayPayload) {
  const parts: string[] = []
  const { summary, totals } = payload

  if (totals.critical > 0) parts.push(`${totals.critical} ${totals.critical === 1 ? 'pendência crítica pede' : 'pendências críticas pedem'} ação imediata`)
  if (summary.customersWaiting > 0) parts.push(`${summary.customersWaiting} ${summary.customersWaiting === 1 ? 'cliente precisa' : 'clientes precisam'} de retorno`)
  if (summary.openProposals > 0) parts.push(`${summary.openProposals} ${summary.openProposals === 1 ? 'proposta está aberta' : 'propostas estão abertas'}`)
  if (summary.opportunityValue > 0) parts.push(`${money(summary.opportunityValue)} estão em oportunidades ativas`)

  if (!parts.length) return 'A operação não tem pendências relevantes detectadas agora. Continue acompanhando pedidos, clientes e recebimentos conforme o dia avança.'
  return `${parts.slice(0, 3).join('; ')}. ${parts[3] ? `${parts[3]}.` : ''}`
}

const summaryCards: SummaryCard[] = [
  { key: 'salesToday', label: 'Vendas hoje', href: '/painel/pedidos', money: true },
  { key: 'ordersToday', label: 'Pedidos hoje', href: '/painel/pedidos' },
  { key: 'receiptsToday', label: 'Recebimentos', href: '/painel/financeiro', money: true },
  { key: 'openProposals', label: 'Propostas abertas', href: '/painel/propostas' },
  { key: 'tasksToday', label: 'Próximas ações', href: '/painel/tarefas' },
  { key: 'customersWaiting', label: 'Clientes aguardando', href: '/painel/follow-up' },
  { key: 'deliveries', label: 'Entregas em aberto', href: '/painel/entregas' },
  { key: 'opportunityValue', label: 'Em oportunidades', href: '/painel/crm', money: true },
]

export default function TodayOperationsCenter() {
  const [payload, setPayload] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const token = await getAccessTokenClient()
      const offset = new Date().getTimezoneOffset()
      const response = await fetch(`/api/panel/today?offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Não foi possível montar sua Central do Dia.')
      setPayload(data as TodayPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível montar sua Central do Dia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const healthWarnings = useMemo(
    () => payload?.dataHealth ? Object.values(payload.dataHealth).filter(Boolean).length : 0,
    [payload],
  )

  if (loading) {
    return (
      <div className={styles.skeletonWrap} aria-label="Carregando Central do Dia">
        <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
        </div>
      </div>
    )
  }

  if (error || !payload) {
    return (
      <section className={styles.errorCard} role="alert">
        <div>
          <strong>Não conseguimos montar o resumo de hoje.</strong>
          <p>{error || 'Tente atualizar a Central do Dia.'}</p>
        </div>
        <button type="button" onClick={() => void load()}>Tentar novamente</button>
      </section>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="today-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroHeader}>
          <div>
            <span className={styles.eyebrow}>Hoje no Orçaly</span>
            <h2 id="today-title">
              {payload.totals.attention > 0
                ? `Você tem ${payload.totals.attention} ${payload.totals.attention === 1 ? 'item' : 'itens'} que precisam da sua atenção.`
                : 'Sua operação está em dia neste momento.'}
            </h2>
            <p>O Orçaly reuniu pedidos, clientes, propostas, tarefas, pagamentos e operação em uma fila única de atenção.</p>
          </div>

          <div className={styles.heroStats} aria-label="Resumo de prioridades">
            <div><strong>{payload.totals.critical}</strong><span>críticas</span></div>
            <div><strong>{payload.totals.high}</strong><span>altas</span></div>
            <button type="button" onClick={() => void load()} aria-label="Atualizar Central do Dia">Atualizar</button>
          </div>
        </div>

        <div className={styles.intelligence}>
          <span className={styles.intelligenceIcon} aria-hidden="true">✦</span>
          <div>
            <strong>Leitura operacional</strong>
            <p>{summarySentence(payload)}</p>
            {healthWarnings > 0 ? <small>{healthWarnings} fonte(s) de dados não responderam; o resumo usa somente informações confirmadas.</small> : null}
          </div>
        </div>
      </section>

      <section className={styles.attentionSection} aria-labelledby="attention-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Próximas ações</span>
            <h3 id="attention-title">Resolva o que importa primeiro</h3>
          </div>
          <Link href="/painel/central-operacional">Abrir central operacional <span aria-hidden="true">→</span></Link>
        </div>

        {payload.attention.length ? (
          <div className={styles.attentionList}>
            {payload.attention.slice(0, 9).map((item, index) => (
              <Link key={item.id} href={item.href} className={styles.attentionItem} style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}>
                <span className={`${styles.itemIcon} ${priorityClass(item.priority)}`} aria-hidden="true">{iconFor(item.type)}</span>
                <span className={styles.itemCopy}>
                  <span className={styles.itemTopline}>
                    <strong>{item.title}</strong>
                    <span className={`${styles.priority} ${priorityClass(item.priority)}`}>{attentionPriorityLabels[item.priority]}</span>
                  </span>
                  <span className={styles.itemDescription}>{item.description}</span>
                  <span className={styles.itemMeta}>
                    {item.dueAt ? <span>{dateTime(item.dueAt)}</span> : null}
                    {Number(item.value || 0) > 0 ? <span>{money(Number(item.value))}</span> : null}
                  </span>
                </span>
                <span className={styles.itemArrow} aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✓</span>
            <div><strong>Nenhuma pendência relevante agora.</strong><p>Novos pedidos, prazos, follow-ups e pagamentos aparecerão aqui automaticamente.</p></div>
          </div>
        )}
      </section>

      <section className={styles.summarySection} aria-labelledby="summary-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Resumo de hoje</span>
            <h3 id="summary-title">A empresa em uma olhada</h3>
          </div>
          <small>Atualizado {dateTime(payload.generatedAt)}</small>
        </div>

        <div className={styles.summaryGrid}>
          {summaryCards.map((card, index) => {
            const value = Number(payload.summary[card.key] || 0)
            return (
              <Link key={card.key} href={card.href} className={styles.summaryCard} style={{ animationDelay: `${80 + index * 25}ms` }}>
                <span>{card.label}</span>
                <strong>{card.money ? money(value) : value.toLocaleString('pt-BR')}</strong>
                <small>Ver detalhes <span aria-hidden="true">→</span></small>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
