import 'server-only'

import { cache } from 'react'
import { getPersonalProductAccess, requireEcosystemIdentity } from '@/lib/ecosystem/server'
import type { HubProductSnapshot } from '@/lib/orcaly-next/hub-model'

/**
 * Runtime adapter for the authenticated Hub.
 *
 * It only translates access signals that already exist in the current runtime.
 * It never grants access and it deliberately falls back to neutral/coming-soon
 * states whenever the existing architecture cannot prove an entitlement.
 */
export const getCurrentHubSnapshots = cache(async (): Promise<readonly HubProductSnapshot[]> => {
  const { db } = await requireEcosystemIdentity()

  const [companies, partner, wealth] = await Promise.all([
    db.from('companies').select('id').limit(1),
    db.from('affiliate_profiles').select('id,status').limit(1).maybeSingle(),
    getPersonalProductAccess('wealth', 'wealth.read'),
  ])

  const hasCompany = !companies.error && Boolean(companies.data?.length)
  const hasPartner = !partner.error && Boolean(partner.data?.id) && partner.data?.status === 'active'

  return [
    { productId: 'business', status: hasCompany ? 'ACTIVE' : 'AVAILABLE' },
    { productId: 'wealth', status: wealth.allowed ? 'ACTIVE' : 'COMING_SOON' },
    { productId: 'growth', status: 'COMING_SOON' },
    { productId: 'flow', status: 'COMING_SOON' },
    { productId: 'academy', status: 'COMING_SOON' },
    { productId: 'market', status: 'COMING_SOON' },
    { productId: 'partners', status: hasPartner ? 'ACTIVE' : 'AVAILABLE' },
  ]
})
