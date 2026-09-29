import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createIntegrationOAuthState,
  createPkcePair,
  hashIntegrationOAuthNonce,
  hashIntegrationOAuthScopes,
  verifyIntegrationOAuthState,
} from '@/lib/integrations/core/auth'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

export async function createStoredOAuthState(db: SupabaseClient, input: {
  companyId: string
  userId: string
  provider: IntegrationProviderKey
  requestedScopes: readonly string[]
  next?: string
}) {
  const signed = createIntegrationOAuthState({
    companyId: input.companyId,
    userId: input.userId,
    provider: input.provider,
    requestedScopes: input.requestedScopes,
    next: input.next,
  })
  const pkce = createPkcePair()

  const { data: row, error } = await db.from('integration_oauth_states').insert({
    company_id: input.companyId,
    user_id: input.userId,
    provider: input.provider,
    nonce_hash: hashIntegrationOAuthNonce(signed.state.nonce),
    requested_scopes: signed.requestedScopes,
    expires_at: new Date(signed.state.exp * 1000).toISOString(),
  }).select('id').single()
  if (error) throw error

  const { error: pkceError } = await db.rpc('integration_oauth_pkce_store', {
    p_company_id: input.companyId,
    p_state_id: row.id,
    p_verifier: pkce.verifier,
  })
  if (pkceError) {
    await db.from('integration_oauth_states').delete().eq('id', row.id).eq('company_id', input.companyId)
    throw pkceError
  }

  return { signedState: signed.value, state: signed.state, pkceChallenge: pkce.challenge }
}

export async function consumeStoredOAuthState(db: SupabaseClient, rawState: string) {
  const state = verifyIntegrationOAuthState(rawState)
  if (!state) return null

  const { data, error } = await db.rpc('integration_oauth_state_consume', {
    p_company_id: state.companyId,
    p_user_id: state.userId,
    p_provider: state.provider,
    p_nonce_hash: hashIntegrationOAuthNonce(state.nonce),
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const scopes = Array.isArray(record.requested_scopes)
    ? record.requested_scopes.filter((scope): scope is string => typeof scope === 'string')
    : []
  if (hashIntegrationOAuthScopes(scopes) !== state.scopeHash) return null
  const verifier = typeof record.pkce_verifier === 'string' ? record.pkce_verifier : ''
  if (verifier.length < 43) return null

  return { state, requestedScopes: scopes, pkceVerifier: verifier }
}
