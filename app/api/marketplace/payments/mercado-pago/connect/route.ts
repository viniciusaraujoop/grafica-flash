import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { buildMercadoPagoAuthUrl, generateOauthState, hashOauthState } from '@/lib/mercado-pago'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canConfig && !access.canFinance) return NextResponse.json({ error: 'Sem permissão para configurar pagamentos.' }, { status: 403 })

    const state = generateOauthState()
    const stateHash = hashOauthState(state)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabaseAdmin
      .from('marketplace_oauth_states')
      .insert({
        company_id: access.company.id,
        user_id: requester.id,
        provider: 'mercado_pago',
        state_hash: stateHash,
        expires_at: expiresAt,
      })

    if (error) throw error

    return NextResponse.json({ url: buildMercadoPagoAuthUrl(state) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao iniciar conexão Mercado Pago.' }, { status: 500 })
  }
}
