/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_BACKOFFICE_V2
import { NextRequest, NextResponse } from 'next/server'
import { canPlatform, isOfficialPlatformOwner, platformCapabilities, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toTime(value: unknown) {
  const parsed = value ? new Date(String(value)) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0
}

function state(company: any) {
  const status = String(company.assinatura_status || '').toLowerCase()
  const now = Date.now()
  if (status.includes('trial') || toTime(company.trial_ends_at) > now) return 'trial'
  if (company.cancel_at_period_end || ['cancelled', 'canceled', 'cancelado'].includes(status)) return 'canceling'
  if (['past_due', 'overdue', 'late', 'unpaid', 'atrasado'].includes(status)) return 'overdue'
  if (['active', 'paid', 'ativo'].includes(status) || toTime(company.access_until) > now) return 'active'
  if (company.ativo === false) return 'inactive'
  return status || 'unknown'
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'dashboard.view')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  if (session.admin.role !== 'support' && !isOfficialPlatformOwner(session.admin)) {
    return NextResponse.json({ error: 'Acesso de suporte não encontrado.' }, { status: 403 })
  }

  const db = session.supabaseAdmin
  const canCompanies = canPlatform(session.admin, 'companies.view')
  const canMarketplace = canPlatform(session.admin, 'marketplace.view')
  const canAffiliates = canPlatform(session.admin, 'affiliates.view')
  const canReferrals = canPlatform(session.admin, 'referrals.view')
  const canContacts = canPlatform(session.admin, 'contact.view')

  try {
    const [companiesR, settingsR, profilesR, referralsR] = await Promise.all([
      canCompanies ? db.from('companies').select('id,nome,email,telefone,whatsapp,slug,segmento,plano,assinatura_plano,assinatura_status,ativo,created_at,updated_at,trial_ends_at,access_until,cancel_at_period_end,next_billing_at,onboarding_completed').order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null } as any),
      canMarketplace ? db.from('marketplace_payment_settings').select('company_id,provider,onboarding_status,is_active,last_error,updated_at') : Promise.resolve({ data: [], error: null } as any),
      canAffiliates ? db.from('affiliate_profiles').select('id,name,email,whatsapp,code,status,payout_status,last_login_at,created_at,updated_at').order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null } as any),
      canReferrals ? db.from('affiliate_referrals').select('id,affiliate_id,company_id,referral_code,status,plan,review_status,created_at,updated_at').order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [], error: null } as any),
    ])
    const firstError = [companiesR, settingsR, profilesR, referralsR].find((result: any) => result.error)?.error
    if (firstError) throw firstError

    const settings = settingsR.data || []
    const settingMap = new Map<string, any>(settings.map((row: any) => [String(row.company_id), row]))
    const subscribers = (companiesR.data || []).map((company: any) => ({
      id: company.id,
      nome: company.nome,
      email: canContacts ? company.email : null,
      telefone: canContacts ? company.telefone || company.whatsapp : null,
      slug: company.slug,
      segmento: company.segmento,
      plan: company.assinatura_plano || company.plano || null,
      subscriptionStatus: company.assinatura_status,
      state: state(company),
      ativo: company.ativo,
      trialEndsAt: company.trial_ends_at,
      accessUntil: company.access_until,
      nextBillingAt: company.next_billing_at,
      onboardingCompleted: company.onboarding_completed,
      marketplace: settingMap.has(String(company.id)) ? {
        provider: settingMap.get(String(company.id))?.provider,
        status: settingMap.get(String(company.id))?.onboarding_status,
        active: Boolean(settingMap.get(String(company.id))?.is_active),
        lastError: settingMap.get(String(company.id))?.last_error,
      } : null,
    }))
    const partners = (profilesR.data || []).map((profile: any) => ({
      id: profile.id,
      name: profile.name,
      email: canContacts ? profile.email : 'Contato protegido',
      whatsapp: canContacts ? profile.whatsapp : null,
      code: profile.code,
      status: profile.status,
      payoutStatus: profile.payout_status,
      lastLoginAt: profile.last_login_at,
    }))
    const referrals = (referralsR.data || []).map((row: any) => ({
      id: row.id,
      affiliateId: row.affiliate_id,
      companyId: row.company_id,
      code: row.referral_code,
      status: row.status,
      plan: row.plan,
      reviewStatus: row.review_status,
      createdAt: row.created_at,
    }))

    return NextResponse.json({
      admin: { email: session.admin.email, nome: session.admin.nome, role: session.admin.role, area: session.admin.area },
      capabilities: platformCapabilities(session.admin),
      metrics: {
        subscribersTotal: subscribers.length,
        active: subscribers.filter((row: any) => row.state === 'active').length,
        trial: subscribers.filter((row: any) => row.state === 'trial').length,
        overdue: subscribers.filter((row: any) => row.state === 'overdue').length,
        partners: partners.length,
        referrals: referrals.length,
        referralsPending: referrals.filter((row: any) => ['pending', 'flagged'].includes(String(row.reviewStatus))).length,
      },
      subscribers,
      partners,
      referrals,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar a área de suporte.' }, { status: 500 })
  }
}
