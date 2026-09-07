/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_BACKOFFICE_V2
import { NextRequest, NextResponse } from 'next/server'
import { requireOfficialPlatformOwner } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toTime(value: unknown) {
  const parsed = value ? new Date(String(value)) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0
}

function subscriptionState(company: any) {
  const status = String(company.assinatura_status || company.mercado_pago_subscription_status || '').trim().toLowerCase()
  const now = Date.now()
  const trialEnd = toTime(company.trial_ends_at)
  const accessUntil = toTime(company.access_until || company.assinatura_expira_em)
  if (status.includes('trial') || (trialEnd > now && !['active', 'paid'].includes(status))) return 'trial'
  if (company.cancel_at_period_end === true || ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(status)) return 'canceling'
  if (['past_due', 'overdue', 'late', 'unpaid', 'atrasado', 'inadimplente'].includes(status)) return 'overdue'
  if (['active', 'paid', 'authorized', 'ativo'].includes(status) || accessUntil > now) return 'active'
  if (company.ativo === false) return 'inactive'
  if (['pending', 'pending_payment'].includes(status)) return 'pending'
  return status || 'unknown'
}

function latestMap(rows: any[], keys: string[]) {
  const map = new Map<string, any>()
  for (const row of rows) {
    const id = String(row.company_id || '')
    if (!id) continue
    const current = map.get(id)
    const score = Math.max(...keys.map((key) => toTime(row[key])))
    const currentScore = current ? Math.max(...keys.map((key) => toTime(current[key]))) : -1
    if (!current || score >= currentScore) map.set(id, row)
  }
  return map
}

export async function GET(request: NextRequest) {
  const session = await requireOfficialPlatformOwner(request)
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })

  try {
    const db = session.supabaseAdmin
    const [companiesR, planPaymentsR, eventsR, settingsR, profilesR, referralsR, commissionsR, payoutsR, payoutAccountsR, teamR, auditR] = await Promise.all([
      db.from('companies').select('id,nome,email,telefone,whatsapp,slug,segmento,plano,assinatura_plano,assinatura_status,ativo,created_at,updated_at,trial_started_at,trial_ends_at,access_until,cancel_at_period_end,assinatura_inicio,assinatura_expira_em,assinatura_ultimo_pagamento,assinatura_proxima_cobranca,next_billing_at,subscription_provider,provider_subscription_id,provider_customer_id,mercado_pago_subscription_id,mercado_pago_subscription_status,onboarding_completed').order('created_at', { ascending: false }).limit(1000),
      db.from('plan_payments').select('id,company_id,plano,valor,status,payment_method,provider,billing_type,provider_payment_id,provider_subscription_id,created_at,paid_at,next_payment_date,cancelled_at,updated_at').order('created_at', { ascending: false }).limit(2500),
      db.from('subscription_events').select('id,company_id,event_type,old_status,new_status,provider,provider_reference,processing_status,error_message,created_at,processed_at').order('created_at', { ascending: false }).limit(2500),
      db.from('marketplace_payment_settings').select('company_id,provider,onboarding_status,is_active,last_error,updated_at'),
      db.from('affiliate_profiles').select('id,name,email,whatsapp,code,status,payout_status,commission_rate,debt_balance,last_login_at,created_at,updated_at').order('created_at', { ascending: false }).limit(1000),
      db.from('affiliate_referrals').select('id,affiliate_id,company_id,referral_code,status,plan,qualified_at,commission_expected,review_status,created_at,updated_at').order('created_at', { ascending: false }).limit(2500),
      db.from('affiliate_commissions').select('id,affiliate_id,company_id,status,commission_amount,hold_until,available_at,payout_id,created_at,updated_at').order('created_at', { ascending: false }).limit(3000),
      db.from('affiliate_payouts').select('id,affiliate_id,amount,status,provider,provider_transfer_id,external_reference,pix_key_type,pix_key_masked,holder_name,requested_at,approved_at,processing_at,paid_at,failed_at,cancelled_at,failure_reason,proof_url,admin_note,created_at,updated_at').order('created_at', { ascending: false }).limit(1000),
      db.rpc('list_affiliate_payout_accounts_admin'),
      db.from('platform_admins').select('id,email,nome,role,is_active,permissions,area,observacoes,last_login_at,must_change_password,created_at,updated_at').order('created_at', { ascending: true }),
      db.from('admin_audit_logs').select('id,admin_email,action,target_type,target_id,target_label,created_at').order('created_at', { ascending: false }).limit(100),
    ])

    const regularResults = [companiesR, planPaymentsR, eventsR, settingsR, profilesR, referralsR, commissionsR, payoutsR, teamR, auditR]
    const firstError = regularResults.find((result: any) => result.error)?.error
    if (firstError) throw firstError
    if (payoutAccountsR.error) throw payoutAccountsR.error

    const companies = companiesR.data || []
    const planPayments = planPaymentsR.data || []
    const events = eventsR.data || []
    const settings = settingsR.data || []
    const profiles = profilesR.data || []
    const referrals = referralsR.data || []
    const commissions = commissionsR.data || []
    const payouts = payoutsR.data || []
    const payoutAccounts = Array.isArray(payoutAccountsR.data) ? payoutAccountsR.data : []
    const team = teamR.data || []
    const audit = auditR.data || []

    const latestPayment = latestMap(planPayments, ['paid_at', 'updated_at', 'created_at'])
    const latestEvent = latestMap(events, ['processed_at', 'created_at'])
    const latestReferral = latestMap(referrals.filter((row: any) => row.company_id), ['qualified_at', 'updated_at', 'created_at'])
    const settingMap = new Map<string, any>(settings.map((row: any) => [String(row.company_id), row]))
    const profileMap = new Map<string, any>(profiles.map((row: any) => [String(row.id), row]))
    const payoutAccountMap = new Map<string, any>(payoutAccounts.map((row: any) => [String(row.affiliate_id), row]))

    const paymentHistory = new Map<string, any[]>()
    for (const payment of planPayments) {
      const id = String(payment.company_id || '')
      if (!id) continue
      const list = paymentHistory.get(id) || []
      if (list.length < 8) list.push(payment)
      paymentHistory.set(id, list)
    }

    const subscribers = companies.map((company: any) => {
      const id = String(company.id)
      const payment = latestPayment.get(id) || null
      const event = latestEvent.get(id) || null
      const referral = latestReferral.get(id) || null
      const partner = referral?.affiliate_id ? profileMap.get(String(referral.affiliate_id)) || null : null
      const setting = settingMap.get(id) || null
      return {
        ...company,
        state: subscriptionState(company),
        plan: company.assinatura_plano || company.plano || payment?.plano || null,
        nextBillingAt: company.next_billing_at || company.assinatura_proxima_cobranca || payment?.next_payment_date || null,
        lastPaidAt: company.assinatura_ultimo_pagamento || payment?.paid_at || null,
        latestPayment: payment,
        latestEvent: event,
        paymentHistory: paymentHistory.get(id) || [],
        marketplace: setting ? { provider: setting.provider, status: setting.onboarding_status, active: Boolean(setting.is_active), lastError: setting.last_error } : null,
        referral: referral ? {
          id: referral.id,
          code: referral.referral_code,
          status: referral.status,
          reviewStatus: referral.review_status,
          commissionExpected: referral.commission_expected,
          partner: partner ? { id: partner.id, name: partner.name, email: partner.email, code: partner.code } : null,
        } : null,
      }
    })

    const referralCount = new Map<string, number>()
    const qualifiedCount = new Map<string, number>()
    for (const row of referrals) {
      const id = String(row.affiliate_id || '')
      if (!id) continue
      referralCount.set(id, Number(referralCount.get(id) || 0) + 1)
      if (['qualified', 'customer_active'].includes(String(row.status))) qualifiedCount.set(id, Number(qualifiedCount.get(id) || 0) + 1)
    }

    const commissionTotals = new Map<string, Record<string, number>>()
    for (const row of commissions) {
      const id = String(row.affiliate_id || '')
      if (!id) continue
      const current = commissionTotals.get(id) || {}
      const key = String(row.status || 'unknown')
      current[key] = Number(current[key] || 0) + Number(row.commission_amount || 0)
      commissionTotals.set(id, current)
    }

    const pendingPayout = new Map<string, any>()
    for (const row of payouts) {
      if (!['requested', 'approved', 'processing'].includes(String(row.status))) continue
      const id = String(row.affiliate_id || '')
      if (id && !pendingPayout.has(id)) pendingPayout.set(id, row)
    }

    const partners = profiles.map((profile: any) => {
      const id = String(profile.id)
      const totals = commissionTotals.get(id) || {}
      return {
        ...profile,
        referrals: referralCount.get(id) || 0,
        qualified: qualifiedCount.get(id) || 0,
        availableCommission: totals.available || 0,
        holdCommission: totals.hold || 0,
        paidCommission: totals.paid || 0,
        payoutAccount: payoutAccountMap.get(id) || null,
        pendingPayout: pendingPayout.get(id) || null,
      }
    })

    const enrichedPayouts = payouts.map((row: any) => ({
      ...row,
      partner: profileMap.get(String(row.affiliate_id || '')) || null,
      payoutAccount: payoutAccountMap.get(String(row.affiliate_id || '')) || null,
    }))

    const now = Date.now()
    const paidPlanPayments = planPayments.filter((row: any) => ['paid', 'approved', 'authorized'].includes(String(row.status || '').toLowerCase()))
    const latestPaid = new Map<string, any>()
    for (const row of paidPlanPayments) {
      const id = String(row.company_id || '')
      if (id && !latestPaid.has(id)) latestPaid.set(id, row)
    }
    const activeSubscribers = subscribers.filter((row: any) => row.state === 'active')
    const estimatedMrr = activeSubscribers.reduce((total: number, row: any) => total + Number(latestPaid.get(String(row.id))?.valor || 0), 0)
    const revenue30d = paidPlanPayments.filter((row: any) => toTime(row.paid_at || row.created_at) >= now - 30 * 86400000).reduce((total: number, row: any) => total + Number(row.valor || 0), 0)
    const commissionsAvailable = commissions.filter((row: any) => row.status === 'available').reduce((total: number, row: any) => total + Number(row.commission_amount || 0), 0)
    const pendingPayoutRows = enrichedPayouts.filter((row: any) => ['requested', 'approved', 'processing'].includes(String(row.status)))

    return NextResponse.json({
      admin: { email: session.admin.email, nome: session.admin.nome, role: session.admin.role },
      metrics: {
        subscribersTotal: subscribers.length,
        subscribersActive: activeSubscribers.length,
        subscribersTrial: subscribers.filter((row: any) => row.state === 'trial').length,
        subscribersOverdue: subscribers.filter((row: any) => row.state === 'overdue').length,
        subscribersCanceling: subscribers.filter((row: any) => row.state === 'canceling').length,
        renewalsNext7Days: subscribers.filter((row: any) => { const t = toTime(row.nextBillingAt); return t >= now && t <= now + 7 * 86400000 }).length,
        estimatedMrr,
        revenue30d,
        partnersActive: profiles.filter((row: any) => row.status === 'active').length,
        partnersTotal: profiles.length,
        referralsTotal: referrals.length,
        referralsPendingReview: referrals.filter((row: any) => ['pending', 'flagged'].includes(String(row.review_status))).length,
        commissionsAvailable,
        payoutsPendingAmount: pendingPayoutRows.reduce((total: number, row: any) => total + Number(row.amount || 0), 0),
        payoutsPendingCount: pendingPayoutRows.length,
        supportActive: team.filter((row: any) => String(row.role).toLowerCase() === 'support' && row.is_active).length,
      },
      subscribers,
      partners,
      payouts: enrichedPayouts,
      team,
      audit,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o centro de controle.' }, { status: 500 })
  }
}
