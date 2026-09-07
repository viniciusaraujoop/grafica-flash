'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MercadoPagoSubscriptionCheckout from '@/components/subscription/MercadoPagoSubscriptionCheckout'
import FounderSubscriptionPanel, {
  type FounderBillingCompany,
} from '@/components/subscription/FounderSubscriptionPanel'
import styles from './SubscriptionExperienceV2.module.css'

type CurrentPayload = {
  company?: FounderBillingCompany & {
    is_founder?: boolean | null
  }
  error?: string
}

type SubscriptionCompany = {
  plano?: string | null
  assinatura_status?: string | null
  assinatura_proxima_cobranca?: string | null
  mercado_pago_subscription_status?: string | null
  cancel_at_period_end?: boolean | null
  access_until?: string | null
  is_founder?: boolean | null
  founder_number?: number | null
  founder_trial_ends_at?: string | null
}

type HistoryPayment = {
  id?: string | null
  plano?: string | null
  valor?: number | string | null
  status?: string | null
  tipo?: string | null
  payment_method?: string | null
  paid_at?: string | null
  created_at?: string | null
}

type HistoryEvent = {
  id?: string | null
  event_type?: string | null
  old_status?: string | null
  new_status?: string | null
  provider?: string | null
  created_at?: string | null
}

type SubscriptionSnapshot = {
  company?: SubscriptionCompany | null
  role?: string | null
  can_manage?: boolean
  history?: {
    events?: HistoryEvent[]
    payments?: HistoryPayment[]
  }
}

function planLabel(value?: string | null) {
  const plan = String(value || '').toLowerCase()
  if (plan === 'premium') return 'Premium'
  if (['profissional', 'intermediario', 'intermediário'].includes(plan)) return 'Profissional'
  if (['basico', 'básico', 'essencial'].includes(plan)) return 'Básico'
  return value || 'Plano não definido'
}

function statusLabel(value?: string | null) {
  const status = String(value || 'pendente').toLowerCase()
  if (['ativa', 'authorized'].includes(status)) return 'Ativa'
  if (['trialing', 'trial'].includes(status)) return 'Período inicial'
  if (['past_due', 'paused'].includes(status)) return 'Pagamento pendente'
  if (['cancelada', 'canceled', 'cancelled'].includes(status)) return 'Cancelada'
  if (status === 'cancel_at_period_end') return 'Cancelamento agendado'
  return 'Pendente'
}

function dateBR(value?: string | null) {
  if (!value) return 'Não definida'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não definida'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function dateTimeBR(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function daysLabel(value?: string | null) {
  if (!value) return 'Sem data'
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return 'Sem data'
  const days = Math.ceil((target.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'Expirado'
  if (days === 0) return 'Termina hoje'
  if (days === 1) return '1 dia restante'
  return `${days} dias restantes`
}

function money(value?: number | string | null) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return 'R$ 0,00'
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function eventLabel(value?: string | null) {
  const event = String(value || '').toLowerCase()
  const labels: Record<string, string> = {
    payment_approved: 'Pagamento aprovado',
    cancellation_requested: 'Cancelamento solicitado',
    subscription_created: 'Assinatura criada',
    subscription_authorized: 'Assinatura autorizada',
    subscription_synced: 'Assinatura sincronizada',
    renewal_approved: 'Renovação aprovada',
  }
  return labels[event] || value?.replace(/_/g, ' ') || 'Evento da assinatura'
}

function RefreshIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  )
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function SubscriptionExperience() {
  const [company, setCompany] = useState<CurrentPayload['company'] | null>(null)
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [version, setVersion] = useState(0)

  const loadExperience = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const token = await getToken()
      if (!token) {
        window.location.assign('/login')
        return
      }

      const [currentResponse, subscriptionResponse] = await Promise.all([
        fetch('/api/company/current', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/company/subscription', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const currentPayload = (await currentResponse.json().catch(() => ({}))) as CurrentPayload
      if (!currentResponse.ok || !currentPayload.company) {
        throw new Error(currentPayload.error || 'Não foi possível carregar a assinatura.')
      }

      const subscriptionPayload = (await subscriptionResponse.json().catch(() => ({}))) as SubscriptionSnapshot & { error?: string }

      setCompany(currentPayload.company)
      setSnapshot(subscriptionResponse.ok ? subscriptionPayload : null)
      setLastUpdated(new Date())
      setVersion((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a assinatura.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadExperience(false)
  }, [loadExperience])

  const subscriptionCompany = snapshot?.company
  const isFounder = company?.is_founder === true
  const currentPlan = planLabel(
    subscriptionCompany?.plano || company?.assinatura_plano || company?.plano,
  )
  const status = statusLabel(
    subscriptionCompany?.assinatura_status ||
      subscriptionCompany?.mercado_pago_subscription_status ||
      company?.assinatura_status,
  )
  const accessDate =
    subscriptionCompany?.access_until ||
    (isFounder ? company?.founder_trial_ends_at : null)
  const nextBilling =
    subscriptionCompany?.assinatura_proxima_cobranca ||
    company?.next_billing_at ||
    company?.assinatura_proxima_cobranca
  const historyPayments = snapshot?.history?.payments || []
  const historyEvents = snapshot?.history?.events || []
  const historyCount = historyPayments.length + historyEvents.length
  const recurringLabel = useMemo(() => {
    const provider = String(subscriptionCompany?.mercado_pago_subscription_status || '').toLowerCase()
    if (subscriptionCompany?.cancel_at_period_end) return 'Cancelamento agendado'
    if (provider === 'authorized') return 'Automática ativa'
    if (provider) return statusLabel(provider)
    return 'Pagamento manual'
  }, [subscriptionCompany])

  if (loading && !company) {
    return (
      <div className={styles.loadingShell} aria-label="Carregando assinatura">
        <div className={styles.loadingHero} />
        <div className={styles.loadingBody} />
      </div>
    )
  }

  if (error && !company) {
    return (
      <div className={styles.errorCard} role="alert">
        <strong>Não foi possível abrir sua assinatura.</strong>
        <p>{error}</p>
        <button type="button" className={styles.errorRetry} onClick={() => void loadExperience(false)}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!company) return null

  const founderNumber = typeof company.founder_number === 'number'
    ? `Founder #${String(company.founder_number).padStart(2, '0')}`
    : 'Founder'

  return (
    <div className={styles.scope}>
      <section className={styles.hero} aria-labelledby="subscription-v2-title">
        <div className={styles.heroTop}>
          <div>
            <span className={styles.heroEyebrow}>{isFounder ? 'Programa Founder' : 'Central da assinatura'}</span>
            <h1 id="subscription-v2-title" className={styles.heroTitle}>
              {isFounder ? `${founderNumber}, seu benefício em um só lugar.` : 'Sua assinatura, sem surpresas.'}
            </h1>
            <p className={styles.heroDescription}>
              {isFounder
                ? 'Acompanhe o período gratuito, o preço especial, a cobrança futura e a autorização do Mercado Pago sem perder o contexto.'
                : 'Veja plano, acesso, próxima cobrança, forma de renovação e histórico. Troque de plano ou pague sem sair desta página.'}
            </p>
          </div>

          <span className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} aria-hidden="true" />
            {status}
          </span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Plano atual</p>
            <p className={styles.statValue}>{currentPlan}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Acesso</p>
            <p className={styles.statValue}>{daysLabel(accessDate)}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Próxima cobrança</p>
            <p className={styles.statValue}>{dateBR(nextBilling)}</p>
          </div>
          <div className={styles.stat}>
            <p className={styles.statLabel}>Renovação</p>
            <p className={styles.statValue}>{isFounder ? 'Regra Founder' : recurringLabel}</p>
          </div>
        </div>
      </section>

      <div className={styles.controlBar}>
        <div className={styles.controlCopy}>
          <p className={styles.controlTitle}>Dados da cobrança</p>
          <p className={styles.controlMeta}>
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Sincronizado com sua conta e o provedor de pagamento.'}
            {snapshot?.role ? ` · acesso ${snapshot.can_manage ? 'de gestão' : 'somente leitura'}` : ''}
          </p>
        </div>

        <div className={styles.controlActions}>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
          >
            <HistoryIcon />
            {historyOpen ? 'Ocultar histórico' : 'Ver histórico'}
          </button>
          <button
            type="button"
            className={styles.controlButtonPrimary}
            onClick={() => void loadExperience(true)}
            disabled={refreshing}
          >
            <RefreshIcon />
            {refreshing ? 'Atualizando...' : 'Atualizar status'}
          </button>
        </div>
      </div>

      {error ? (
        <div className={styles.errorCard} role="alert">
          <strong>Não foi possível atualizar os dados.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {historyOpen ? (
        <section className={styles.history} aria-labelledby="subscription-history-title">
          <div className={styles.historyHeader}>
            <div>
              <h2 id="subscription-history-title">Histórico da assinatura</h2>
              <p>Últimos pagamentos e eventos registrados pelo Orçaly.</p>
            </div>
            <span className={styles.historyCount}>{historyCount} registros</span>
          </div>

          <div className={styles.historyGrid}>
            <div className={styles.historyColumn}>
              <p className={styles.historyColumnTitle}>Pagamentos</p>
              {historyPayments.length ? (
                <div className={styles.historyList}>
                  {historyPayments.slice(0, 6).map((payment, index) => (
                    <div className={styles.historyItem} key={payment.id || `payment-${index}`}>
                      <span className="min-w-0">
                        <strong>{planLabel(payment.plano)} · {statusLabel(payment.status)}</strong>
                        <small>{dateTimeBR(payment.paid_at || payment.created_at)} · {payment.payment_method || payment.tipo || 'pagamento'}</small>
                      </span>
                      <span className={styles.historyAmount}>{money(payment.valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyHistory}>Nenhum pagamento registrado ainda.</div>
              )}
            </div>

            <div className={styles.historyColumn}>
              <p className={styles.historyColumnTitle}>Eventos</p>
              {historyEvents.length ? (
                <div className={styles.historyList}>
                  {historyEvents.slice(0, 6).map((event, index) => (
                    <div className={styles.historyItem} key={event.id || `event-${index}`}>
                      <span className="min-w-0">
                        <strong>{eventLabel(event.event_type)}</strong>
                        <small>{dateTimeBR(event.created_at)}{event.new_status ? ` · ${statusLabel(event.new_status)}` : ''}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyHistory}>Nenhum evento registrado ainda.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {isFounder ? (
        <FounderSubscriptionPanel key={`founder-${version}`} initialCompany={company} />
      ) : (
        <MercadoPagoSubscriptionCheckout key={`standard-${version}`} />
      )}
    </div>
  )
}
