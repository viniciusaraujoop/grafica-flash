import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

export type IntegrationOAuthState = {
  userId: string
  companyId: string
  provider: IntegrationProviderKey
  nonce: string
  exp: number
  next: string
}

function stateSecret() {
  const value = String(process.env.INTEGRATION_OAUTH_STATE_SECRET || '').trim()
  if (!value) throw new Error('INTEGRATION_OAUTH_STATE_SECRET não configurado no servidor.')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url')
}

export function safeIntegrationRedirect(value: unknown, fallback = '/painel/integracoes') {
  const path = String(value || '').trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  return path
}

export function createIntegrationOAuthState(input: Omit<IntegrationOAuthState, 'nonce' | 'exp' | 'next'> & { ttlSeconds?: number; next?: string }) {
  const state: IntegrationOAuthState = {
    userId: input.userId,
    companyId: input.companyId,
    provider: input.provider,
    nonce: randomBytes(18).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + Math.max(60, Math.min(input.ttlSeconds || 600, 900)),
    next: safeIntegrationRedirect(input.next),
  }
  const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')
  return { value: `${payload}.${sign(payload)}`, state }
}

export function verifyIntegrationOAuthState(value: string): IntegrationOAuthState | null {
  const [payload, signature, extra] = String(value || '').split('.')
  if (!payload || !signature || extra) return null

  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IntegrationOAuthState
    if (!parsed.userId || !parsed.companyId || !parsed.provider || !parsed.nonce) return null
    if (!Number.isFinite(parsed.exp) || parsed.exp < Math.floor(Date.now() / 1000)) return null
    parsed.next = safeIntegrationRedirect(parsed.next)
    return parsed
  } catch {
    return null
  }
}

export function hashIntegrationOAuthNonce(nonce: string) {
  return createHash('sha256').update(nonce).digest('hex')
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge, method: 'S256' as const }
}
