import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateMfaStepUp,
  type MfaAssuranceLevel,
  type SensitiveAction,
} from '@/lib/security/mfa-core'

export type MfaSecurityState = {
  currentLevel: MfaAssuranceLevel
  nextLevel: MfaAssuranceLevel
  hasVerifiedFactor: boolean
  verifiedFactors: Array<{
    id: string
    friendlyName: string | null
    factorType: string
  }>
}

type HeaderCarrier = {
  headers: {
    get(name: string): string | null
  }
}

function normalizeLevel(value: unknown): MfaAssuranceLevel {
  return value === 'aal2' ? 'aal2' : value === 'aal1' ? 'aal1' : null
}

export function getRequestAccessToken(request: HeaderCarrier) {
  const authorization = String(request.headers.get('authorization') || '').trim()
  const fallbackSession = String(request.headers.get('x-orcaly-session') || '').trim()
  return (authorization || fallbackSession).replace(/^Bearer\s+/i, '').trim()
}

export function createMfaUserClient(request: HeaderCarrier) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const token = getRequestAccessToken(request)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configuração pública do Supabase ausente para validação MFA.')
  }
  if (!token) {
    throw new Error('Sessão autenticada ausente para validação MFA.')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

export async function getMfaSecurityState(supabase: SupabaseClient): Promise<MfaSecurityState> {
  const [{ data: levels, error: levelError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])

  if (levelError) throw levelError
  if (factorsError) throw factorsError

  const verified = [
    ...(factors?.totp || []),
    ...(factors?.phone || []),
  ].filter((factor) => factor.status === 'verified')

  return {
    currentLevel: normalizeLevel(levels?.currentLevel),
    nextLevel: normalizeLevel(levels?.nextLevel),
    hasVerifiedFactor: verified.length > 0,
    verifiedFactors: verified.map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name || null,
      factorType: factor.factor_type,
    })),
  }
}

export async function requireMfaStepUp(
  supabase: SupabaseClient,
  action: SensitiveAction,
) {
  const state = await getMfaSecurityState(supabase)
  const decision = evaluateMfaStepUp({
    action,
    hasVerifiedFactor: state.hasVerifiedFactor,
    currentLevel: state.currentLevel,
    nextLevel: state.nextLevel,
  })

  return {
    ...decision,
    state,
    status: decision.allowed ? 200 : 403,
    error: decision.allowed
      ? null
      : decision.reason === 'mfa_enrollment_required'
        ? 'Ative a verificação em duas etapas antes de executar esta ação sensível.'
        : 'Confirme seu código de autenticação para continuar.',
  }
}

export async function requireMfaStepUpForRequest(
  request: HeaderCarrier,
  action: SensitiveAction,
) {
  const client = createMfaUserClient(request)
  return requireMfaStepUp(client, action)
}
