// Deterministic rationale (§15, §19): codes and evidence labels only. No free text, no AI.

import type {
  AlternativeSignal,
  Completeness,
  CounterSignal,
  EvidenceSignal,
  HardContradiction,
  NextChoice,
  Outcome,
  PackScore,
  Rationale,
  RationaleCode,
  SmartSetupPackKey,
} from './types'
import { atLeast } from './score'
import { THRESHOLDS_BPS } from './ruleset'

/** Canonical code order — the only ordering used for rationale lists. */
export const RATIONALE_CODE_ORDER: readonly RationaleCode[] = [
  'DECLARED_BUSINESS_TYPE',
  'SUBSEGMENT_MATCH',
  'OFFER_PRODUCTS',
  'OFFER_SERVICES',
  'OFFER_PRODUCTS_AND_SERVICES',
  'QUOTE_LED_OPERATION',
  'CUSTOM_PRODUCTION',
  'ART_APPROVAL',
  'PRODUCTION_TRACKING',
  'FOOD_PREPARATION',
  'DELIVERY_OPERATION',
  'PICKUP_OPERATION',
  'ON_SITE_SERVICE',
  'REMOTE_SERVICE',
  'APPOINTMENT_LED_SERVICE',
  'CATALOG_SALES',
  'STOCK_OPERATION',
  'DEPOSIT_OR_MULTI_LOCATION',
  'CRM_FOLLOWUP',
  'MARKETPLACE_SALES',
  'INSUFFICIENT_COMPLETENESS',
  'WEAK_EVIDENCE',
  'CLOSE_CANDIDATES',
  'CROSS_SEGMENT_SIGNAL',
  'ANSWER_CONTRADICTION',
  'COUNTER_SIGNAL_EXPLICIT',
  'DECLARED_PACK_UNAVAILABLE',
]

const RANK = new Map(RATIONALE_CODE_ORDER.map((code, index) => [code, index]))

export function sortCodes(codes: Iterable<RationaleCode>): RationaleCode[] {
  return [...new Set(codes)].sort((a, b) => (RANK.get(a) ?? 999) - (RANK.get(b) ?? 999))
}

/**
 * Codes of all evidence that matched the given packs. Caps limit the SCORE, not the explanation:
 * evidence absorbed by a per-question or family cap is still listed (its counted points stay visible
 * in `supportingSignals[].points`).
 */
export function supportingCodes(signals: readonly EvidenceSignal[], packs: readonly SmartSetupPackKey[]): RationaleCode[] {
  return sortCodes(signals.filter((signal) => signal.nominalPoints > 0 && packs.includes(signal.pack)).map((signal) => signal.code))
}

export type RationaleInput = {
  outcome: Outcome
  primaryPack: SmartSetupPackKey | null
  declared: boolean
  candidates: readonly SmartSetupPackKey[]
  packScores: readonly PackScore[]
  signals: readonly EvidenceSignal[]
  counterSignals: readonly CounterSignal[]
  hardContradictions: readonly HardContradiction[]
  alternatives: readonly AlternativeSignal[]
  completeness: Completeness
  declaredPackUnavailable: boolean
}

export function buildRationale(input: RationaleInput): Rationale {
  const focus = input.primaryPack ? [input.primaryPack] : [...input.candidates]
  const supporting = supportingCodes(input.signals, focus)
  const counter = sortCodes([
    ...input.counterSignals.filter((signal) => focus.includes(signal.pack)).map((signal) => signal.code),
    ...(input.alternatives.length ? (['CROSS_SEGMENT_SIGNAL'] as const) : []),
  ])
  const uncertainty: RationaleCode[] = []
  if (!input.completeness.meetsMinimum) uncertainty.push('INSUFFICIENT_COMPLETENESS')
  if (input.hardContradictions.length) uncertainty.push('ANSWER_CONTRADICTION')
  if (input.declaredPackUnavailable) uncertainty.push('DECLARED_PACK_UNAVAILABLE')
  const primaryScore = input.primaryPack ? input.packScores.find((score) => score.pack === input.primaryPack) : undefined
  const bestBps = Math.max(0, ...input.packScores.map((score) => score.confidence.bps))
  if (input.outcome === 'BUSINESS_TYPE_ONLY' && primaryScore && !atLeast(primaryScore.confidence, THRESHOLDS_BPS.T_CLEAR)) uncertainty.push('WEAK_EVIDENCE')
  if (input.outcome === 'NO_CLEAR_MATCH' && input.completeness.meetsMinimum && !input.hardContradictions.length && bestBps < THRESHOLDS_BPS.T_CLEAR) uncertainty.push('WEAK_EVIDENCE')
  if (input.outcome === 'AMBIGUOUS') uncertainty.push('CLOSE_CANDIDATES')

  let primaryReason: RationaleCode
  let nextChoice: NextChoice
  switch (input.outcome) {
    case 'CLEAR_MATCH':
      primaryReason = input.declared ? 'DECLARED_BUSINESS_TYPE' : strongestCode(input.signals, input.primaryPack as SmartSetupPackKey)
      nextChoice = 'CONFIRM_OR_CHANGE_PRIMARY'
      break
    case 'BUSINESS_TYPE_ONLY':
      primaryReason = 'DECLARED_BUSINESS_TYPE'
      nextChoice = 'REVIEW_REFERENCE_PACK'
      break
    case 'AMBIGUOUS':
      primaryReason = 'CLOSE_CANDIDATES'
      nextChoice = 'CHOOSE_BETWEEN_CANDIDATES'
      break
    case 'NO_CLEAR_MATCH':
      primaryReason = input.hardContradictions.length ? 'ANSWER_CONTRADICTION' : !input.completeness.meetsMinimum ? 'INSUFFICIENT_COMPLETENESS' : 'WEAK_EVIDENCE'
      nextChoice = 'CHOOSE_SEGMENT_OR_CONTINUE_WITHOUT_PACK'
      break
  }
  return { primaryReason, supportingSignals: supporting, counterSignals: counter, uncertainty: sortCodes(uncertainty), nextChoice }
}

/** Highest counted evidence for a pack; ties resolved by canonical code order (label only, never a winner). */
function strongestCode(signals: readonly EvidenceSignal[], pack: SmartSetupPackKey): RationaleCode {
  const counted = signals.filter((signal) => signal.pack === pack && signal.points > 0)
  counted.sort((a, b) => b.points - a.points || (RANK.get(a.code) ?? 999) - (RANK.get(b.code) ?? 999))
  return counted[0]?.code ?? 'WEAK_EVIDENCE'
}

export function flattenCodes(rationale: Rationale, declared: boolean): RationaleCode[] {
  return sortCodes([
    ...(declared ? (['DECLARED_BUSINESS_TYPE'] as const) : []),
    rationale.primaryReason,
    ...rationale.supportingSignals,
    ...rationale.counterSignals,
    ...rationale.uncertainty,
  ])
}
