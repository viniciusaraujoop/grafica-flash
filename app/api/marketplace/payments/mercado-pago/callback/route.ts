import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { exchangeMercadoPagoCode, hashOauthState } from '@/lib/mercado-pago'

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(request.url)
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  const errorParam = url.searchParams.get('error') || ''

  if (errorParam) {
    return NextResponse.redirect(new URL(`/painel/pagamentos/configuracao?mp=error&message=${encodeURIComponent(errorParam)}`, request.url))
  }

  try {
    if (!code || !state) throw new Error('Callback Mercado Pago sem code/state.')

    const stateHash = hashOauthState(state)
    const { data: oauthState, error: stateError } = await supabaseAdmin
      .from('marketplace_oauth_states')
      .select('*')
      .eq('state_hash', stateHash)
      .eq('provider', 'mercado_pago')
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (stateError) throw stateError
    if (!oauthState?.company_id) throw new Error('State OAuth inválido ou expirado.')

    const tokenPayload = await exchangeMercadoPagoCode(code)
    const expiresIn = Number(tokenPayload.expires_in || 0)
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

    const { error: upsertError } = await supabaseAdmin
      .from('marketplace_payment_settings')
      .upsert({
        company_id: oauthState.company_id,
        provider: 'mercado_pago',
        provider_user_id: tokenPayload.user_id ? String(tokenPayload.user_id) : null,
        provider_account_id: tokenPayload.collector_id ? String(tokenPayload.collector_id) : tokenPayload.user_id ? String(tokenPayload.user_id) : null,
        access_token: tokenPayload.access_token || null,
        refresh_token: tokenPayload.refresh_token || null,
        public_key: tokenPayload.public_key || null,
        token_expires_at: tokenExpiresAt,
        onboarding_status: 'connected',
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,provider' })

    if (upsertError) throw upsertError

    await supabaseAdmin
      .from('marketplace_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', oauthState.id)

    return NextResponse.redirect(new URL('/painel/pagamentos/configuracao?mp=connected', request.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no callback Mercado Pago.'
    if (state) {
      const stateHash = hashOauthState(state)
      const { data: oauthState } = await supabaseAdmin
        .from('marketplace_oauth_states')
        .select('company_id')
        .eq('state_hash', stateHash)
        .maybeSingle()
      if (oauthState?.company_id) {
        await supabaseAdmin
          .from('marketplace_payment_settings')
          .upsert({
            company_id: oauthState.company_id,
            provider: 'mercado_pago',
            onboarding_status: 'error',
            is_active: false,
            last_error: message,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'company_id,provider' })
      }
    }
    return NextResponse.redirect(new URL(`/painel/pagamentos/configuracao?mp=error&message=${encodeURIComponent(message)}`, request.url))
  }
}
