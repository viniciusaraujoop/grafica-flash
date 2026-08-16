import { createHash, randomBytes } from 'node:crypto'

export const CUSTOMER_PORTAL_TOKEN_BYTES = 32
export const CUSTOMER_PORTAL_TOKEN_LENGTH = 43

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const HASH_DOMAIN = 'orcaly-customer-portal:v1:'

export function generateCustomerPortalToken() {
  return randomBytes(CUSTOMER_PORTAL_TOKEN_BYTES).toString('base64url')
}

export function isCustomerPortalToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === CUSTOMER_PORTAL_TOKEN_LENGTH &&
    TOKEN_PATTERN.test(value)
  )
}

export function hashCustomerPortalToken(token: string) {
  if (!isCustomerPortalToken(token)) {
    throw new Error('Token de Portal inválido.')
  }

  return createHash('sha256')
    .update(`${HASH_DOMAIN}${token}`, 'utf8')
    .digest('hex')
}

export function getCustomerPortalAccessFailure(
  access: {
    entity_type?: unknown
    status?: unknown
    revoked_at?: unknown
    expires_at?: unknown
  } | null,
  now = new Date(),
) {
  if (!access) return 'not_found' as const
  if (access.entity_type !== 'order') return 'unsupported_entity' as const
  if (access.status !== 'active' || access.revoked_at) return 'revoked' as const

  if (access.expires_at) {
    const expiresAt = new Date(String(access.expires_at))
    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= now.getTime()
    ) {
      return 'expired' as const
    }
  }

  return null
}
