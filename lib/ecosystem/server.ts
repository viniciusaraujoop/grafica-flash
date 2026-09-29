import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getMfaSecurityState } from '@/lib/security/mfa'
import { evaluateProductAccess, type ProductGrant } from './access'
import { getProduct, type ProductId } from './products'

export const getEcosystemIdentity = cache(async () => {
  const db = await createSupabaseServerClient({ readOnly: true })
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return null
  const mfa = await getMfaSecurityState(db)
  return { db, user: data.user, requestTime: Date.now(), mfaRequired: mfa.hasVerifiedFactor && mfa.currentLevel !== 'aal2' }
})

export async function requireEcosystemIdentity() {
  const identity = await getEcosystemIdentity()
  if (!identity) redirect('/login?next=%2Fapps')
  if (identity.mfaRequired) redirect('/mfa?next=%2Fapps')
  return identity
}

/** Runtime release switch is independent of billing and ownership. */
export function productRolloutEnabled(id: ProductId) {
  const flags: Partial<Record<ProductId, string | undefined>> = { wealth: process.env.ORCALY_WEALTH_ENABLED }
  return flags[id] === 'true'
}

export async function getPersonalProductAccess(id: ProductId, permission: string) {
  const identity = await getEcosystemIdentity()
  if (!identity || identity.mfaRequired) return { identity: null, allowed: false, reason: 'authentication' as const }
  const product = getProduct(id)!
  if (!productRolloutEnabled(id)) return { identity, allowed: false, reason: 'unavailable' as const }
  const { data, error } = await identity.db.from('ecosystem_product_entitlements')
    .select('product_id,user_id,company_id,status,starts_at,expires_at,permissions')
    .eq('user_id', identity.user.id).eq('product_id', id)
  if (error) return { identity, allowed: false, reason: 'unavailable' as const }
  return { identity, ...evaluateProductAccess({ product, actorId: identity.user.id, context: { kind: 'personal', id: identity.user.id }, member: true, permission, permissionAllowed: true, rolloutEnabled: true, grants: (data ?? []) as ProductGrant[], now: Date.now() }) }
}
