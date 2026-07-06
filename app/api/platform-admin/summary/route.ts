/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { getMarketplaceCommissionForCompany } from '@/lib/marketplace-commission'

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabaseAdmin = auth.supabaseAdmin

    const [companiesResult, settingsResult, paymentsResult, commissionsResult, rulesResult] = await Promise.all([
      supabaseAdmin
        .from('companies')
        .select('id,nome,email,slug,assinatura_plano,plano,assinatura_status,ativo,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select('company_id,provider,provider_user_id,provider_account_id,onboarding_status,is_active,last_error,updated_at'),
      supabaseAdmin
        .from('marketplace_payments')
        .select('id,company_id,order_id,provider,status,provider_status,amount,commission_amount,created_at,paid_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('marketplace_commissions')
        .select('id,company_id,order_id,marketplace_payment_id,status,gross_amount,commission_percentage,commission_fixed,commission_amount,confirmed_at,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('marketplace_commission_rules')
        .select('id,company_id,plan_key,commission_percentage,commission_fixed,is_active,created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (companiesResult.error) throw companiesResult.error
    if (settingsResult.error) throw settingsResult.error
    if (paymentsResult.error) throw paymentsResult.error
    if (commissionsResult.error) throw commissionsResult.error
    if (rulesResult.error) throw rulesResult.error

    const companies = companiesResult.data || []
    const settings = settingsResult.data || []
    const payments = paymentsResult.data || []
    const commissions = commissionsResult.data || []
    const rules = rulesResult.data || []
    const connectedCompanyIds = new Set(settings.filter((item: any) => item.is_active && item.onboarding_status === 'connected').map((item: any) => item.company_id))

    const companyRows = await Promise.all(companies.map(async (company: any) => {
      const rule = await getMarketplaceCommissionForCompany(supabaseAdmin, company)
      const setting = settings.find((item: any) => item.company_id === company.id)
      return {
        ...company,
        payment_connected: connectedCompanyIds.has(company.id),
        payment_status: setting?.onboarding_status || 'pending',
        provider_user_id: setting?.provider_user_id || null,
        commission_rule: rule,
      }
    }))

    const paidPayments = payments.filter((item: any) => item.status === 'paid')
    const pendingPayments = payments.filter((item: any) => item.status === 'pending')
    const failedPayments = payments.filter((item: any) => ['failed', 'canceled', 'refunded', 'charged_back'].includes(String(item.status)))
    const confirmedCommissions = commissions.filter((item: any) => item.status === 'confirmed')
    const pendingCommissions = commissions.filter((item: any) => item.status === 'pending')

    return NextResponse.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      metrics: {
        total_companies: companies.length,
        connected_companies: connectedCompanyIds.size,
        disconnected_companies: Math.max(0, companies.length - connectedCompanyIds.size),
        sold_volume: paidPayments.reduce((acc: number, item: any) => acc + Number(item.amount || 0), 0),
        commission_total: confirmedCommissions.reduce((acc: number, item: any) => acc + Number(item.commission_amount || 0), 0),
        commissions_pending: pendingCommissions.reduce((acc: number, item: any) => acc + Number(item.commission_amount || 0), 0),
        commissions_confirmed: confirmedCommissions.length,
        payments_error: failedPayments.length,
        payments_pending: pendingPayments.length,
      },
      companies: companyRows,
      settings,
      payments,
      commissions,
      rules,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro no admin interno.' }, { status: 500 })
  }
}
