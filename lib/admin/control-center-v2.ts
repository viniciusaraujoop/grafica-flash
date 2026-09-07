import type { SupabaseClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
type Db = SupabaseClient

const DAY = 86_400_000
const PAID = new Set(['paid', 'approved', 'authorized'])

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function num(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function time(value: unknown) {
  if (!value) return 0
  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function iso(value: Date) {
  return value.toISOString()
}

export function companySubscriptionState(company: JsonRecord, now = Date.now()) {
  const status = lower(company.assinatura_status || company.mercado_pago_subscription_status)
  const trialEnd = time(company.trial_ends_at)
  const accessUntil = time(company.access_until || company.assinatura_expira_em)
  if (company.ativo === false) return 'inactive'
  if (status.includes('trial') || (trialEnd > now && !['active', 'paid', 'ativa', 'ativo'].includes(status))) return 'trial'
  if (company.cancel_at_period_end === true || ['cancelled', 'canceled', 'cancelada', 'cancelado', 'cancel_at_period_end'].includes(status)) return 'canceling'
  if (['past_due', 'overdue', 'late', 'unpaid', 'atrasado', 'inadimplente'].includes(status)) return 'overdue'
  if (['active', 'paid', 'authorized', 'ativa', 'ativo'].includes(status) || accessUntil > now) return 'active'
  if (['pending', 'pending_payment', 'pendente'].includes(status)) return 'pending'
  return status || 'unknown'
}

export function calculateCompanyHealth(input: {
  company: JsonRecord
  lastLoginAt?: string | null
  orderCount?: number
  lastOrderAt?: string | null
  productCount?: number
  customerCount?: number
  integrations?: Array<{ active: boolean; error?: string | null }>
}) {
  let score = 100
  const reasons: string[] = []
  const now = Date.now()
  const state = companySubscriptionState(input.company, now)
  const lastLogin = time(input.lastLoginAt)

  if (state === 'overdue') { score -= 30; reasons.push('pagamento/assinatura em atraso') }
  else if (state === 'canceling') { score -= 20; reasons.push('cancelamento programado') }
  else if (state === 'trial' && time(input.company.trial_ends_at) < now + 3 * DAY) { score -= 10; reasons.push('trial próximo do fim') }
  else if (state === 'inactive') { score -= 35; reasons.push('empresa inativa') }

  if (lastLogin) {
    const days = Math.floor((now - lastLogin) / DAY)
    if (days > 30) { score -= 25; reasons.push(`sem login do owner há ${days} dias`) }
    else if (days > 14) { score -= 15; reasons.push(`sem login do owner há ${days} dias`) }
    else if (days > 7) { score -= 6; reasons.push(`sem login do owner há ${days} dias`) }
  } else {
    score -= 8
    reasons.push('último login do owner indisponível')
  }

  if (input.company.onboarding_completed !== true) { score -= 10; reasons.push('onboarding incompleto') }
  if (!input.company.site_publico_ativo && !input.company.marketplace_ativo) { score -= 7; reasons.push('presença pública não publicada') }
  if (!input.productCount) { score -= 8; reasons.push('nenhum produto cadastrado') }
  if (!input.orderCount) { score -= 8; reasons.push('nenhum pedido registrado') }
  else if (input.lastOrderAt && time(input.lastOrderAt) < now - 30 * DAY) { score -= 7; reasons.push('sem pedido recente') }
  if (!input.customerCount) { score -= 5; reasons.push('nenhum cliente cadastrado') }

  const integrations = input.integrations || []
  if (integrations.some((item) => item.error)) { score -= 7; reasons.push('integração com erro recente') }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 70 ? 'HEALTHY' : score >= 40 ? 'ATTENTION' : 'AT_RISK'
  return { score, label, reasons: reasons.slice(0, 5) }
}

function startOfMonthMaceio() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value || String(new Date().getUTCFullYear())
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  return new Date(`${year}-${month}-01T00:00:00-03:00`)
}

function previousMonthStart(current: Date) {
  const result = new Date(current)
  result.setMonth(result.getMonth() - 1)
  return result
}

function severityRank(value: string) {
  return ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, INFO: 1 } as Record<string, number>)[value] || 0
}

export async function loadControlCenterV2(db: Db) {
  const now = new Date()
  const nowTime = now.getTime()
  const monthStart = startOfMonthMaceio()
  const previousStart = previousMonthStart(monthStart)
  const nextMonth = new Date(monthStart)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const [companiesR, paymentsR, webhookR, payoutsR, commissionsR, securityR, bugsR, profilesR, referralsR, auditR] = await Promise.all([
    db.from('companies').select('id,nome,email,slug,segmento,plano,assinatura_plano,assinatura_status,ativo,created_at,updated_at,trial_ends_at,access_until,assinatura_expira_em,cancel_at_period_end,next_billing_at,assinatura_proxima_cobranca,onboarding_completed,site_publico_ativo,marketplace_ativo,is_founder,founder_price_cents').order('created_at', { ascending: false }).limit(2000),
    db.from('plan_payments').select('id,company_id,plano,valor,status,provider,payment_method,paid_at,created_at,updated_at,next_payment_date').gte('created_at', iso(previousStart)).lt('created_at', iso(nextMonth)).order('created_at', { ascending: false }).limit(4000),
    db.from('payment_webhook_events').select('id,provider,event_type,provider_object_id,company_id,processing_status,attempts,received_at,processed_at,error_message').order('received_at', { ascending: false }).limit(80),
    db.from('affiliate_payouts').select('id,affiliate_id,amount,status,requested_at,approved_at,processing_at,paid_at,failed_at,failure_reason').order('created_at', { ascending: false }).limit(100),
    db.from('affiliate_commissions').select('id,commission_amount,status,created_at').order('created_at', { ascending: false }).limit(2500),
    db.from('security_events').select('id,company_id,event_type,severity,source,path,description,resolved,created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(80),
    db.from('admin_bug_reports').select('id,severity,area,title,status,entity_type,entity_id,entity_label,last_seen_at,suggested_action,fix_route').in('status', ['aberto', 'em_analise']).order('last_seen_at', { ascending: false }).limit(80),
    db.from('affiliate_profiles').select('id,name,code,status').limit(1500),
    db.from('affiliate_referrals').select('id,affiliate_id,company_id,status,review_status,created_at').order('created_at', { ascending: false }).limit(2500),
    db.from('admin_audit_logs').select('id,admin_email,action,target_type,target_id,target_label,created_at').order('created_at', { ascending: false }).limit(25),
  ])

  const errors = [companiesR, paymentsR, webhookR, payoutsR, commissionsR, securityR, bugsR, profilesR, referralsR, auditR].map((item) => item.error).filter(Boolean)
  if (errors.length) throw errors[0]

  const companies = (companiesR.data || []) as JsonRecord[]
  const payments = (paymentsR.data || []) as JsonRecord[]
  const webhooks = (webhookR.data || []) as JsonRecord[]
  const payouts = (payoutsR.data || []) as JsonRecord[]
  const commissions = (commissionsR.data || []) as JsonRecord[]
  const security = (securityR.data || []) as JsonRecord[]
  const bugs = (bugsR.data || []) as JsonRecord[]
  const profiles = (profilesR.data || []) as JsonRecord[]
  const referrals = (referralsR.data || []) as JsonRecord[]

  const states = companies.map((company) => ({ company, state: companySubscriptionState(company, nowTime) }))
  const active = states.filter((row) => row.state === 'active')
  const trial = states.filter((row) => row.state === 'trial')
  const overdue = states.filter((row) => row.state === 'overdue')
  const canceling = states.filter((row) => row.state === 'canceling')

  const paidPayments = payments.filter((row) => PAID.has(lower(row.status)))
  const currentPaid = paidPayments.filter((row) => time(row.paid_at || row.created_at) >= monthStart.getTime())
  const previousPaid = paidPayments.filter((row) => {
    const occurred = time(row.paid_at || row.created_at)
    return occurred >= previousStart.getTime() && occurred < monthStart.getTime()
  })
  const revenueMonth = currentPaid.reduce((sum, row) => sum + num(row.valor), 0)
  const revenuePrevious = previousPaid.reduce((sum, row) => sum + num(row.valor), 0)

  const latestPaidByCompany = new Map<string, JsonRecord>()
  for (const payment of paidPayments) {
    const id = String(payment.company_id || '')
    if (id && !latestPaidByCompany.has(id)) latestPaidByCompany.set(id, payment)
  }
  let mrr = 0
  let mrrCoverage = 0
  for (const row of active) {
    const payment = latestPaidByCompany.get(String(row.company.id || ''))
    if (!payment) continue
    mrr += num(payment.valor)
    mrrCoverage += 1
  }

  const alerts: Array<{ id: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'; title: string; context: string; entity: string; date: string | null; href: string }> = []
  for (const row of webhooks.filter((item) => ['failed', 'error'].includes(lower(item.processing_status))).slice(0, 8)) {
    alerts.push({ id: `webhook:${row.id}`, severity: 'HIGH', title: 'Webhook com falha', context: `${String(row.provider || 'provider')} · ${String(row.event_type || 'evento')} · ${String(row.error_message || 'processamento falhou')}`, entity: String(row.provider_object_id || row.id), date: row.received_at ? String(row.received_at) : null, href: '/admin/webhooks' })
  }
  for (const row of security.slice(0, 8)) {
    const raw = lower(row.severity)
    const sev = raw.includes('critic') ? 'CRITICAL' : raw.includes('alt') || raw === 'high' ? 'HIGH' : 'MEDIUM'
    alerts.push({ id: `security:${row.id}`, severity: sev, title: 'Evento de segurança aberto', context: String(row.description || row.event_type || 'evento de segurança'), entity: String(row.path || row.company_id || row.id), date: row.created_at ? String(row.created_at) : null, href: '/admin/seguranca' })
  }
  for (const row of bugs.slice(0, 8)) {
    const raw = lower(row.severity)
    const sev = raw.includes('critic') ? 'CRITICAL' : raw.includes('alt') ? 'HIGH' : 'MEDIUM'
    alerts.push({ id: `bug:${row.id}`, severity: sev, title: String(row.title || 'Diagnóstico em aberto'), context: String(row.suggested_action || row.area || 'scanner administrativo'), entity: String(row.entity_label || row.entity_id || row.area || row.id), date: row.last_seen_at ? String(row.last_seen_at) : null, href: String(row.fix_route || '/admin/scanner') })
  }
  for (const row of overdue.slice(0, 8)) {
    alerts.push({ id: `overdue:${row.company.id}`, severity: 'HIGH', title: 'Assinatura em atraso', context: `${String(row.company.assinatura_plano || row.company.plano || 'Plano')} · revisar cobrança`, entity: String(row.company.nome || row.company.email || row.company.id), date: row.company.updated_at ? String(row.company.updated_at) : null, href: `/admin/empresas/${row.company.id}` })
  }
  for (const row of trial.filter((item) => time(item.company.trial_ends_at) > nowTime && time(item.company.trial_ends_at) <= nowTime + 3 * DAY).slice(0, 8)) {
    alerts.push({ id: `trial:${row.company.id}`, severity: 'MEDIUM', title: 'Trial termina em breve', context: 'Revisar ativação e oportunidade de conversão', entity: String(row.company.nome || row.company.id), date: row.company.trial_ends_at ? String(row.company.trial_ends_at) : null, href: `/admin/empresas/${row.company.id}` })
  }
  for (const row of payouts.filter((item) => ['requested', 'approved', 'processing'].includes(lower(item.status))).slice(0, 8)) {
    alerts.push({ id: `payout:${row.id}`, severity: 'MEDIUM', title: 'Payout aguardando ação', context: `${String(row.status)} · R$ ${num(row.amount).toFixed(2)}`, entity: String(row.affiliate_id || row.id), date: row.requested_at ? String(row.requested_at) : null, href: '/admin/indicacoes' })
  }
  alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || time(b.date) - time(a.date))

  const failedPayments = payments.filter((row) => ['failed', 'rejected'].includes(lower(row.status))).length
  const pendingPayments = payments.filter((row) => ['pending', 'in_process', 'processing'].includes(lower(row.status))).length
  const newCompanies = companies.filter((row) => time(row.created_at) >= monthStart.getTime()).length
  const activePartners = profiles.filter((row) => lower(row.status) === 'active').length
  const pendingCommissions = commissions.filter((row) => ['hold', 'available', 'processing'].includes(lower(row.status))).reduce((sum, row) => sum + num(row.commission_amount), 0)

  return {
    generatedAt: new Date().toISOString(),
    quality: {
      companiesCapped: companies.length >= 2000,
      paymentsCapped: payments.length >= 4000,
      mrrCoverage: active.length ? Math.round((mrrCoverage / active.length) * 1000) / 10 : 100,
      churn: { value: null, reason: 'Cohort de ativos no início do período ainda não está materializado de forma confiável.' },
      tickets: { value: null, reason: 'Schema de tickets é aditivo e ainda não foi aplicado ao ambiente conectado.' },
    },
    metrics: {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      payingCompanies: active.length,
      trials: trial.length,
      newCompanies,
      revenueMonth: Math.round(revenueMonth * 100) / 100,
      revenuePrevious: Math.round(revenuePrevious * 100) / 100,
      paymentPending: pendingPayments,
      paymentFailed: failedPayments,
      partnersActive: activePartners,
      commissionsPending: Math.round(pendingCommissions * 100) / 100,
      companiesTotal: companies.length,
      overdue: overdue.length,
      canceling: canceling.length,
      criticalAlerts: alerts.filter((item) => item.severity === 'CRITICAL').length,
      highAlerts: alerts.filter((item) => item.severity === 'HIGH').length,
      referrals: referrals.length,
    },
    alerts: alerts.slice(0, 20),
    recentAudit: auditR.data || [],
  }
}
