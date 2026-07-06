import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canConfig && !access.canFinance) return NextResponse.json({ error: 'Sem permissão para desconectar pagamentos.' }, { status: 403 })

    const { error } = await supabaseAdmin
      .from('marketplace_payment_settings')
      .update({
        is_active: false,
        onboarding_status: 'disconnected',
        access_token: null,
        refresh_token: null,
        public_key: null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', access.company.id)
      .eq('provider', 'mercado_pago')

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao desconectar Mercado Pago.' }, { status: 500 })
  }
}
