import { NextResponse } from 'next/server'
import { recordIntegrationAudit } from '@/lib/integrations/core/audit'
import { consumeStoredOAuthState } from '@/lib/integrations/core/oauth-state'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import { loadIntegrationCredentials, storeIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { upsertCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { verifyIntegrationOAuthState } from '@/lib/integrations/core/auth'
import { exchangeGoogleAuthorizationCode, fetchGoogleUserInfo, getGoogleOAuthConfig, isGoogleOAuthProvider } from '@/lib/integrations/google/oauth'
import { resolveIntegrationServerContext } from '@/lib/integrations/server-context'

function redirectToHub(request: Request, params: Record<string, string>) {
  const url = new URL('/painel/integracoes', request.url)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawState = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code') || ''
  const providerError = url.searchParams.get('error') || ''
  if (providerError) return redirectToHub(request, { integration_error: 'oauth_denied' })

  const signed = verifyIntegrationOAuthState(rawState)
  if (!signed || !isGoogleOAuthProvider(signed.provider)) return redirectToHub(request, { integration_error: 'invalid_oauth_state' })
  const provider = getIntegrationProvider(signed.provider)
  if (!provider) return redirectToHub(request, { integration_error: 'unknown_provider' })

  const context = await resolveIntegrationServerContext()
  if (!context || context.userId !== signed.userId || context.companyId !== signed.companyId) {
    return redirectToHub(request, { integration_error: 'oauth_tenant_mismatch' })
  }
  if (!code) return redirectToHub(request, { integration_error: 'missing_oauth_code' })

  const config = getGoogleOAuthConfig()
  if (!config) return redirectToHub(request, { integration_error: 'google_oauth_not_configured' })

  const consumed = await consumeStoredOAuthState(context.admin, rawState)
  if (!consumed || consumed.state.provider !== provider.key) return redirectToHub(request, { integration_error: 'oauth_state_used_or_expired' })

  try {
    const token = await exchangeGoogleAuthorizationCode({ code, verifier: consumed.pkceVerifier, config })
    const account = await fetchGoogleUserInfo(token.accessToken)
    const connection = await upsertCompanyIntegrationConnection(context.admin, {
      companyId: context.companyId,
      provider: provider.key,
      status: 'CONNECTED',
      displayName: provider.name,
      externalAccountId: account.sub,
      externalAccountName: account.email,
      capabilities: provider.capabilities,
      connectedBy: context.userId,
      connectedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
    })
    const previous = await loadIntegrationCredentials(context.admin, context.companyId, connection.id)
    await storeIntegrationCredentials(context.admin, context.companyId, connection.id, {
      ...(previous || {}),
      access_token: token.accessToken,
      refresh_token: token.refreshToken || previous?.refresh_token,
      expires_at: token.expiresAt,
      scope: token.scope || consumed.requestedScopes.join(' '),
    })
    await recordIntegrationAudit(context.admin, {
      companyId: context.companyId,
      userId: context.userId,
      provider: provider.key,
      connectionId: connection.id,
      action: 'integration.connected',
      details: { account: account.email, capabilities: provider.capabilities },
    })
    return redirectToHub(request, { integration_connected: provider.key })
  } catch (error) {
    await upsertCompanyIntegrationConnection(context.admin, {
      companyId: context.companyId,
      provider: provider.key,
      status: 'ERROR',
      capabilities: provider.capabilities,
      connectedBy: context.userId,
      lastErrorCode: error instanceof Error ? error.name : 'oauth_callback_failed',
      lastErrorAt: new Date().toISOString(),
    })
    return redirectToHub(request, { integration_error: 'oauth_callback_failed' })
  }
}
