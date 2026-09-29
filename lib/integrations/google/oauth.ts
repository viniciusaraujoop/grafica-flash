import { IntegrationError } from '@/lib/integrations/core/errors'
import type { IntegrationProviderKey, IntegrationRuntimeContext } from '@/lib/integrations/core/types'
import {
  GOOGLE_OAUTH_PROVIDER_KEYS,
  buildGoogleAuthorizationUrl,
  googleScopesForProviderKey,
  isGoogleOAuthProviderKey,
} from '@/lib/integrations/google/oauth-contract'

export { buildGoogleAuthorizationUrl }
export const GOOGLE_OAUTH_PROVIDERS = new Set<IntegrationProviderKey>(GOOGLE_OAUTH_PROVIDER_KEYS)

export function isGoogleOAuthProvider(provider: IntegrationProviderKey) {
  return isGoogleOAuthProviderKey(provider)
}

export function googleScopesForProvider(provider: IntegrationProviderKey) {
  const scopes = googleScopesForProviderKey(provider)
  if (!scopes) throw new IntegrationError('UNSUPPORTED', 'Provider não pertence ao OAuth compartilhado do Google.')
  return scopes
}

export type GoogleOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = String(process.env.GOOGLE_INTEGRATIONS_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET || '').trim()
  const redirectUri = String(process.env.GOOGLE_INTEGRATIONS_REDIRECT_URI || '').trim()
  if (!clientId || !clientSecret || !redirectUri) return null
  try {
    const parsed = new URL(redirectUri)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null
  } catch {
    return null
  }
  return { clientId, clientSecret, redirectUri }
}

type GoogleTokenPayload = {
  accessToken: string
  refreshToken?: string
  expiresAt: string
  scope?: string
  idToken?: string
}

function readGoogleTokenPayload(value: unknown): GoogleTokenPayload {
  if (!value || typeof value !== 'object') throw new IntegrationError('INVALID_DATA', 'Resposta OAuth do Google inválida.')
  const row = value as Record<string, unknown>
  const accessToken = typeof row.access_token === 'string' ? row.access_token : ''
  const expiresIn = typeof row.expires_in === 'number' && Number.isFinite(row.expires_in) && row.expires_in > 0 ? row.expires_in : 3600
  if (!accessToken) throw new IntegrationError('INVALID_DATA', 'Google não retornou access token.')
  return {
    accessToken,
    refreshToken: typeof row.refresh_token === 'string' && row.refresh_token ? row.refresh_token : undefined,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: typeof row.scope === 'string' ? row.scope : undefined,
    idToken: typeof row.id_token === 'string' ? row.id_token : undefined,
  }
}

async function googleTokenRequest(params: URLSearchParams) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const row = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const providerCode = typeof row.error === 'string' ? row.error : ''
    if (providerCode === 'invalid_grant') throw new IntegrationError('ACCESS_REVOKED', 'A autorização do Google foi revogada.', { status: response.status })
    throw new IntegrationError(response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'PROVIDER_DOWN' : 'INVALID_CREDENTIAL', 'Google recusou a troca de credencial.', { status: response.status })
  }
  return readGoogleTokenPayload(payload)
}

export async function exchangeGoogleAuthorizationCode(input: { code: string; verifier: string; config: GoogleOAuthConfig }) {
  return googleTokenRequest(new URLSearchParams({
    code: input.code,
    code_verifier: input.verifier,
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
    redirect_uri: input.config.redirectUri,
    grant_type: 'authorization_code',
  }))
}

async function refreshGoogleToken(refreshToken: string, config: GoogleOAuthConfig) {
  return googleTokenRequest(new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  }))
}

function tokenStillValid(credentials: Record<string, unknown>, skewMs = 60_000) {
  const accessToken = typeof credentials.access_token === 'string' ? credentials.access_token : ''
  const expiresAt = typeof credentials.expires_at === 'string' ? new Date(credentials.expires_at).getTime() : 0
  return accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + skewMs ? accessToken : null
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }

export async function ensureGoogleAccessToken(context: IntegrationRuntimeContext, forceRefresh = false) {
  const initial = await context.loadCredentials()
  if (!initial) throw new IntegrationError('AUTH_REQUIRED', 'Credencial Google ausente.')
  if (!forceRefresh) {
    const valid = tokenStillValid(initial)
    if (valid) return valid
  }

  const refreshToken = typeof initial.refresh_token === 'string' ? initial.refresh_token : ''
  if (!refreshToken) {
    await context.setConnectionStatus?.('REAUTH_REQUIRED', 'missing_refresh_token')
    throw new IntegrationError('AUTH_REQUIRED', 'Reconexão Google necessária.')
  }
  const config = getGoogleOAuthConfig()
  if (!config) throw new IntegrationError('NOT_CONFIGURED', 'OAuth Google não configurado no servidor.')
  if (!context.acquireCredentialRefreshLock || !context.releaseCredentialRefreshLock) throw new IntegrationError('INTERNAL', 'Refresh lock indisponível.')

  const lockId = await context.acquireCredentialRefreshLock()
  if (!lockId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(250 * (attempt + 1))
      const latest = await context.loadCredentials()
      if (latest) {
        const valid = tokenStillValid(latest, 15_000)
        if (valid) return valid
      }
    }
    throw new IntegrationError('CONFLICT', 'Outra renovação de credencial está em andamento.')
  }

  try {
    const refreshed = await refreshGoogleToken(refreshToken, config)
    const next = {
      ...initial,
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      scope: refreshed.scope || initial.scope,
      refresh_token: refreshed.refreshToken || refreshToken,
    }
    await context.saveCredentials(next)
    await context.setConnectionStatus?.('CONNECTED')
    return refreshed.accessToken
  } catch (error) {
    if (error instanceof IntegrationError && error.code === 'ACCESS_REVOKED') {
      await context.setConnectionStatus?.('REAUTH_REQUIRED', 'access_revoked')
    }
    throw error
  } finally {
    await context.releaseCredentialRefreshLock(lockId)
  }
}

export async function googleApiFetch(context: IntegrationRuntimeContext, url: string, init: RequestInit = {}) {
  let token = await ensureGoogleAccessToken(context)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${token}`)
    const response = await fetch(url, { ...init, headers, signal: init.signal || AbortSignal.timeout(20_000) })
    if (response.status !== 401 || attempt === 1) return response
    token = await ensureGoogleAccessToken(context, true)
  }
  throw new IntegrationError('INTERNAL', 'Falha inesperada na requisição Google.')
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return { sub: null, email: null }
  const payload: unknown = await response.json().catch(() => null)
  const row = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    sub: typeof row.sub === 'string' ? row.sub : null,
    email: typeof row.email === 'string' ? row.email : null,
  }
}

export async function revokeGoogleCredential(credentials: Record<string, unknown>) {
  const token = typeof credentials.refresh_token === 'string' && credentials.refresh_token
    ? credentials.refresh_token
    : typeof credentials.access_token === 'string' ? credentials.access_token : ''
  if (!token) return
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // Local disconnect must remain possible even if the provider is unavailable.
  }
}
