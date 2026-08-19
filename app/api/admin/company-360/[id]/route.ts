import { NextRequest, NextResponse } from 'next/server'
import { calculateCompanyHealth, companySubscriptionState } from '@/lib/admin/control-center-v2'
import { canPlatform, requirePlatformAdmin } from '@/lib/platform-admin'

type RouteContext = { params: Promise<{ id: string }> }
type JsonRecord = Record<string, unknown>

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requirePlatformAdmin(request, 'companies.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const { id } = await context.params
  const db = session.supabaseAdmin

  const [companyR, membersR, paymentsR, eventsR, ordersR, productsR, customersR, integrationR, referralR, securityR, auditR] = await Promise.all([
    db.from('companies').select('id,nome,email,telefone,whatsapp,slug,logo_url,segmento,business_type,plano,assinatura_plano,assinatura_status,ativo,owner_id,created_at,updated_at,trial_started_at,trial_ends_at,access_until,assinatura_expira_em,assinatura_inicio,assinatura_ultimo_pagamento,assinatura_proxima_cobranca,next_billing_at,cancel_at_period_end,subscription_provider,provider_subscription_id,onboarding_current_step,onboarding_completed,onboarding_completed_at,site_publico_ativo,site_status,marketplace_ativo,whatsapp_enabled,is_founder,founder_number,founder_price_cents,founder_trial_ends_at').eq('id', id).maybeSingle(),
    canPlatform(session.admin, 'users.read') ? db.from('company_members').select('id,user_id,nome,email,cargo,status,permissions,created_at,updated_at').eq('company_id', id).order('created_at', { ascending: true }).limit(100) : Promise.resolve({ data: [], error: null }),
    canPlatform(session.admin, 'billing.read') ? db.from('plan_payments').select('id,plano,valor,status,payment_method,provider,billing_type,provider_payment_id,provider_subscription_id,created_at,paid_at,next_payment_date,cancelled_at,updated_at').eq('company_id', id).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    canPlatform(session.admin, 'billing.read') ? db.from('subscription_events').select('id,event_type,old_status,new_status,provider,provider_reference,processing_status,error_message,created_at,processed_at').eq('company_id', id).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    db.from('orders').select('id,status,total_amount,total,valor_total,created_at,updated_at').eq('company_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('products').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('marketplace_payment_settings').select('provider,onboarding_status,is_active,last_error,updated_at').eq('company_id', id).maybeSingle(),
    canPlatform(session.admin, 'partners.read') ? db.from('affiliate_referrals').select('id,affiliate_id,referral_code,status,plan,source,qualified_at,created_at,affiliate_profiles(name,code)').eq('company_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
    canPlatform(session.admin, 'security.read') ? db.from('security_events').select('id,event_type,severity,source,path,description,resolved,created_at').eq('company_id', id).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
    canPlatform(session.admin, 'audit.read') ? db.from('admin_audit_logs').select('id,admin_email,action,target_type,target_id,target_label,payload,created_at').eq('target_id', id).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
  ])

  if (companyR.error) return NextResponse.json({ error: companyR.error.message }, { status: 500 })
  if (!companyR.data) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  const company = companyR.data as JsonRecord
  const orders = (ordersR.data || []) as JsonRecord[]
  let lastLoginAt: string | null = null
  if (company.owner_id) {
    const owner = await db.auth.admin.getUserById(String(company.owner_id))
    lastLoginAt = owner.data.user?.last_sign_in_at || null
  }
  const integration = integrationR.data as JsonRecord | null
  const health = calculateCompanyHealth({
    company,
    lastLoginAt,
    orderCount: orders.length,
    lastOrderAt: orders[0]?.created_at ? String(orders[0].created_at) : null,
    productCount: productsR.count || 0,
    customerCount: customersR.count || 0,
    integrations: integration ? [{ active: Boolean(integration.is_active), error: integration.last_error ? String(integration.last_error) : null }] : [],
  })

  return NextResponse.json({
    company: { ...company, state: companySubscriptionState(company), lastLoginAt },
    health,
    usage: { orders: ordersR.count ?? orders.length, products: productsR.count || 0, customers: customersR.count || 0, lastOrderAt: orders[0]?.created_at || null, recentOrders: orders.slice(0, 12) },
    members: membersR.data || [],
    billing: { payments: paymentsR.data || [], events: eventsR.data || [] },
    integration: integrationR.data || null,
    referral: referralR.data || null,
    security: securityR.data || [],
    audit: auditR.data || [],
    capabilities: {
      canWriteCompany: canPlatform(session.admin, 'companies.write'),
      canBlockCompany: canPlatform(session.admin, 'companies.block'),
      canManageBilling: canPlatform(session.admin, 'billing.manage'),
      supportReadonly: canPlatform(session.admin, 'support.impersonate_readonly'),
      supportWrite: canPlatform(session.admin, 'support.impersonate_write'),
    },
  })
}
