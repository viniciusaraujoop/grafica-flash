import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/jobs/core'

export const PUBLIC_API_SCOPES = [
  'customers.read',
  'customers.write',
  'orders.read',
  'orders.write',
  'tasks.write',
  'webhooks.manage',
] as const

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number]

export type PublicApiKey = {
  id: string
  companyId: string
  name: string
  keyPrefix: string
  scopes: PublicApiScope[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

type StoredApiKey = PublicApiKey & { keyHash: string }

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function parseScopes(value: unknown): PublicApiScope[] | null {
  if (!Array.isArray(value) || !value.length || value.length > PUBLIC_API_SCOPES.length) return null
  const scopes = value.filter((scope): scope is string => typeof scope === 'string')
  if (scopes.length !== value.length || new Set(scopes).size !== scopes.length) return null
  if (!scopes.every((scope) => (PUBLIC_API_SCOPES as readonly string[]).includes(scope))) return null
  return scopes as PublicApiScope[]
}

function parseStoredApiKey(value: unknown): StoredApiKey | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const scopes = parseScopes(row.scopes)
  if (!isUuid(row.id) || !isUuid(row.company_id) || typeof row.name !== 'string' || typeof row.key_prefix !== 'string' || typeof row.key_hash !== 'string' || !scopes || typeof row.created_at !== 'string') return null
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    scopes,
    lastUsedAt: typeof row.last_used_at === 'string' ? row.last_used_at : null,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    createdAt: row.created_at,
  }
}

function publicApiKey(key: StoredApiKey): PublicApiKey {
  const { keyHash: _keyHash, ...publicKey } = key
  return publicKey
}

function parseExpiry(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp) || timestamp <= Date.now()) return undefined
  return new Date(timestamp).toISOString()
}

function normalizeName(value: unknown) {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 2 && name.length <= 80 ? name : null
}

function createRawKey() {
  const identifier = randomBytes(9).toString('base64url')
  const secret = randomBytes(32).toString('base64url')
  const keyPrefix = `orcaly_live_${identifier}`
  return { keyPrefix, rawKey: `${keyPrefix}_${secret}` }
}

export async function listCompanyPublicApiKeys(db: SupabaseClient, companyId: string): Promise<PublicApiKey[]> {
  const { data, error } = await db.from('integration_api_keys')
    .select('id,company_id,name,key_prefix,key_hash,scopes,last_used_at,expires_at,revoked_at,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).flatMap((row) => {
    const parsed = parseStoredApiKey(row)
    return parsed ? [publicApiKey(parsed)] : []
  })
}

export async function createCompanyPublicApiKey(db: SupabaseClient, input: { companyId: string; userId: string; name: unknown; scopes: unknown; expiresAt?: unknown }) {
  const name = normalizeName(input.name)
  const scopes = parseScopes(input.scopes)
  const expiresAt = parseExpiry(input.expiresAt)
  if (!name || !scopes || expiresAt === undefined) throw new Error('Dados da API key inválidos.')
  const created = createRawKey()
  const { data, error } = await db.from('integration_api_keys').insert({
    company_id: input.companyId,
    name,
    key_prefix: created.keyPrefix,
    key_hash: hashKey(created.rawKey),
    scopes,
    created_by: input.userId,
    expires_at: expiresAt,
  }).select('id,company_id,name,key_prefix,key_hash,scopes,last_used_at,expires_at,revoked_at,created_at').single()
  if (error) throw error
  const parsed = parseStoredApiKey(data)
  if (!parsed) throw new Error('A API key criada retornou um formato inválido.')
  return { key: publicApiKey(parsed), rawKey: created.rawKey }
}

export async function revokeCompanyPublicApiKey(db: SupabaseClient, input: { companyId: string; keyId: string; userId: string }) {
  if (!isUuid(input.keyId)) return false
  const now = new Date().toISOString()
  const { data, error } = await db.from('integration_api_keys')
    .update({ revoked_at: now, revoked_by: input.userId, updated_at: now })
    .eq('id', input.keyId)
    .eq('company_id', input.companyId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

function parseRawKey(value: string) {
  const match = /^(orcaly_(?:live|test)_[A-Za-z0-9_-]{10,32})_([A-Za-z0-9_-]{32,})$/.exec(value)
  return match ? { keyPrefix: match[1] } : null
}

export async function authenticatePublicApiKey(db: SupabaseClient, authorization: string | null) {
  const match = /^Bearer\s+(.+)$/.exec(authorization || '')
  const rawKey = match?.[1]?.trim() || ''
  const parsedRaw = parseRawKey(rawKey)
  if (!parsedRaw) return null
  const { data, error } = await db.from('integration_api_keys')
    .select('id,company_id,name,key_prefix,key_hash,scopes,last_used_at,expires_at,revoked_at,created_at')
    .eq('key_prefix', parsedRaw.keyPrefix)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) throw error
  const stored = parseStoredApiKey(data)
  if (!stored || stored.revokedAt || (stored.expiresAt && Date.parse(stored.expiresAt) <= Date.now())) return null
  const actual = Buffer.from(hashKey(rawKey), 'utf8')
  const expected = Buffer.from(stored.keyHash, 'utf8')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  const now = new Date().toISOString()
  const { error: updateError } = await db.from('integration_api_keys').update({ last_used_at: now, updated_at: now }).eq('id', stored.id).eq('company_id', stored.companyId)
  if (updateError) throw updateError
  return publicApiKey({ ...stored, lastUsedAt: now })
}

export function hasPublicApiScope(key: PublicApiKey, scope: PublicApiScope) {
  return key.scopes.includes(scope)
}
