// Smart Setup — pure legacy prefill. Suggests an initial q.business_type from data the company already
// has (canonical BusinessType or legacy NichoId). It is a SUGGESTION: the user must confirm it, and it is
// never treated as an answer by the engine unless the caller submits it as one. No I/O.

import { legacyNichoToPackKey } from '../industry-packs/legacy-map'
import type { DeclaredBusinessTypeAnswer } from './core/types'

const FROM_BUSINESS_TYPE: Readonly<Record<string, DeclaredBusinessTypeAnswer>> = {
  graphic: 'GRAPHICS',
  food: 'FOOD',
  services: 'SERVICES',
  store: 'STORE',
}

export type LegacyPrefill = {
  suggestedBusinessType: DeclaredBusinessTypeAnswer | null
  basis: 'BUSINESS_TYPE' | 'LEGACY_NICHO' | 'NONE'
  requiresUserConfirmation: true
}

/** BusinessTypes without a Wave 1 pack (beauty, barber, auto…) suggest nothing: no pack is ever invented. */
export function legacyPrefill(input: { businessType?: string | null; nichoId?: string | null }): LegacyPrefill {
  const direct = typeof input.businessType === 'string' && Object.prototype.hasOwnProperty.call(FROM_BUSINESS_TYPE, input.businessType) ? FROM_BUSINESS_TYPE[input.businessType] : null
  if (direct) return { suggestedBusinessType: direct, basis: 'BUSINESS_TYPE', requiresUserConfirmation: true }
  const mapping = legacyNichoToPackKey(input.nichoId)
  const viaNicho = mapping && mapping.packKey && Object.prototype.hasOwnProperty.call(FROM_BUSINESS_TYPE, mapping.businessType) ? FROM_BUSINESS_TYPE[mapping.businessType] : null
  if (viaNicho) return { suggestedBusinessType: viaNicho, basis: 'LEGACY_NICHO', requiresUserConfirmation: true }
  return { suggestedBusinessType: null, basis: 'NONE', requiresUserConfirmation: true }
}
