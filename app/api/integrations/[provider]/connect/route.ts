import { NextResponse } from 'next/server'
import { canUseFeature, requireFeatureDecision } from '@/lib/access-control'
import { upsertCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { normalizeIntegrationHttpStatus } from '@/lib/integrations/core/http'
import { createStoredOAuthState } from '@/lib/integrations/core/oauth-state'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import { buildGoogleAuthorizationUrl, getGoogleOAuthConfig, googleScopesForProvider, isGoogleOAuthProvider } from '@/lib/integrations/google/oauth'
import { recordIntegrationAudit } from '@/lib/integrations/core/audit'
import { resolveIntegrationServerContext } from '@/lib/integrations/server-context'

function hubRedirect(request: Request, code: string) {
  const url = new URL('/painel/integracoes', request.url)
  url.searchParams.set('integration_error', code)
  return NextResponse.redirect(url)
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params
  const provider = getIntegrationProvider(providerKey)
  if (!provider) return hubRedirect(request, 'unknown_provider')

  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.redirect(new URL('/login?expired=1&next=%2Fpainel%2Fintegracoes', request.url))
  const decision = requireFeatureDecision(await canUseFeature({
    db: context.admin,
    access: context.access,
    actorCompanyId: context.companyId,
    company: context.company,
    permission: 'integrations.manage',
    featureFlag: provider.featureFlag,
  }))
  if (!decision.allowed) {
    const status = normalizeIntegrationHttpStatus('status' in decision ? decision.status : undefined)
    if (status === 402) return hubRedirect(request, 'rollout_closed')
    return hubRedirect(request, 'permission_denied')
  }

  if (!isGoogleOAuthProvider(provider.key)) return hubRedirect(request, provider.unavailableStatus === 'ACCESS_REQUIRED' ? 'access_required' : 'not_configured')
  const config = getGoogleOAuthConfig()
  if (!config) return hubRedirect(request, 'google_oauth_not_configured')

  const scopes = googleScopesForProvider(provider.key)
  const oauth = await createStoredOAuthState(context.admin, {
    companyId: context.companyId,
    userId: context.userId,
    provider: provider.key,
    requestedScopes: scopes,
    next: `/painel/integracoes?provider=${provider.key}`,
  })
  const connection = await upsertCompanyIntegrationConnection(context.admin, {
    companyId: context.companyId,
    provider: provider.key,
    status: 'CONNECTING',
    capabilities: provider.capabilities,
    connectedBy: context.userId,
  })
  await recordIntegrationAudit(context.admin, {
    companyId: context.companyId,
    userId: context.userId,
    provider: provider.key,
    connectionId: connection.id,
    action: 'integration.oauth.started',
    details: { scopes },
  })

  return NextResponse.redirect(buildGoogleAuthorizationUrl({
    config,
    state: oauth.signedState,
    scopes,
    pkceChallenge: oauth.pkceChallenge,
  }))
}
