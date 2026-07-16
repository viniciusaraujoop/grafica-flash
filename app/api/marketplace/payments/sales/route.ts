import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('marketplace_payments')
      .select('id,order_id,provider,provider_preference_id,provider_payment_id,status,provider_status,checkout_url,sandbox_checkout_url,amount,subtotal,delivery_fee,discount_amount,commission_amount,commission_percentage,provider_fee_amount,net_amount,payer_name,payer_phone,paid_at,created_at')
      .eq('company_id', access.company.id)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) throw error
    return NextResponse.json({ payments: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar vendas.' }, { status: 500 })
  }
}
