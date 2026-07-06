/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { getMarketplaceCommissionForCompany } from '@/lib/marketplace-commission'

function safeSetting(setting: any) {
  if (!setting) return null
  return {
    id: setting.id,
    provider: setting.provider,
    account_connected: Boolean(setting.provider_user_id || setting.provider_account_id),
    onboarding_status: setting.onboarding_status,
    is_active: setting.is_active,
    token_expires_at: setting.token_expires_at,
    last_error: setting.last_error,
    updated_at: setting.updated_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const companyId = access.company.id

    const [settingResult, paymentsResult, commissionRule] = await Promise.all([
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select('id,provider,provider_user_id,provider_account_id,onboarding_status,is_active,token_expires_at,last_error,updated_at')
        .eq('company_id', companyId)
        .eq('provider', 'mercado_pago')
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_payments')
        .select('id,status,amount,commission_amount,created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      getMarketplaceCommissionForCompany(supabaseAdmin, access.company),
    ])

    const payments = paymentsResult.error ? [] : paymentsResult.data || []
    const paid = payments.filter((p: any) => p.status === 'paid')
    const pending = payments.filter((p: any) => p.status === 'pending')
    const failed = payments.filter((p: any) => ['failed', 'canceled', 'cancelled'].includes(String(p.status)))

    return NextResponse.json({
      company: {
        id: companyId,
        nome: access.company.nome,
        plano: access.company.assinatura_plano || access.company.plano || null,
      },
      setting: safeSetting(settingResult.error ? null : settingResult.data),
      commission_rule: commissionRule,
      stats: {
        online_total: payments.length,
        paid_count: paid.length,
        pending_count: pending.length,
        failed_count: failed.length,
        paid_amount: paid.reduce((acc: number, item: any) => acc + Number(item.amount || 0), 0),
        commission_amount: paid.reduce((acc: number, item: any) => acc + Number(item.commission_amount || 0), 0),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar pagamentos.' }, { status: 500 })
  }
}
