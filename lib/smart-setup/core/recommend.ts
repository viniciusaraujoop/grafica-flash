// Outcome resolution (§10–§13) and the public recommendation entry point. Pure; hashing injected.
// Never applies, persists or fetches anything. No clock, no randomness.

import { stableStringify, type HashFn } from '../../wave1/shared/canonical'
import type { IndustryPackDefinition } from '../../industry-packs/core/types'
import { inferCapabilities } from './capabilities'
import { normalizeAnswers } from './normalize'
import { businessTypeAuthority } from './questionnaire'
import { buildRationale, flattenCodes } from './rationale'
import { THRESHOLDS_BPS } from './ruleset'
import { atLeast, scorePacks } from './score'
import { validateAnswers } from './validate-answers'
import {
  QUESTIONNAIRE_VERSION,
  RULESET_VERSION,
  SMART_SETUP_PACKS,
  type AlternativeSignal,
  type BlockedOrUnavailable,
  type Completeness,
  type HardContradiction,
  type Outcome,
  type PackScore,
  type SmartSetupPackKey,
  type SmartSetupRecommendation,
} from './types'

export type RecommendOptions = {
  /** T1 industryPackCatalog (or any catalog). Order is irrelevant: the result never depends on it. */
  catalog: readonly IndustryPackDefinition[]
  hash: HashFn
  /** Caller-known availability (e.g. plan/entitlement context). Never fetched here. */
  context?: { unavailablePacks?: readonly string[]; blockedCapabilities?: readonly string[] }
}

export type OutcomeDecision = {
  outcome: Outcome
  primaryPack: SmartSetupPackKey | null
  candidates: SmartSetupPackKey[]
  alternatives: AlternativeSignal[]
}

/** Display ranking only: rawScore desc, then canonical pack order. Never used to break a tie for primary. */
export function rankScores(scores: readonly PackScore[]): PackScore[] {
  const order = new Map<string, number>(SMART_SETUP_PACKS.map((pack, index) => [pack, index]))
  return [...scores].sort((a, b) => b.rawScore - a.rawScore || (order.get(a.pack) ?? 99) - (order.get(b.pack) ?? 99))
}

/** margin(a, b) >= MARGIN, exactly (shared denominator). */
function exceedsBy(a: PackScore, b: PackScore | undefined, marginBps: number): boolean {
  if (!b) return a.maxAvailableSupport > 0 && a.rawScore * 10000 >= marginBps * a.maxAvailableSupport
  return a.maxAvailableSupport > 0 && (a.rawScore - b.rawScore) * 10000 >= marginBps * a.maxAvailableSupport
}

/** §12: alternatives are labeled signals, never primary. */
export function crossSegmentAlternatives(declaredPack: SmartSetupPackKey, scores: readonly PackScore[]): AlternativeSignal[] {
  const declared = scores.find((score) => score.pack === declaredPack)
  if (!declared) return []
  const severe = declared.rawPenalty > 0
  const out: AlternativeSignal[] = []
  for (const score of scores) {
    if (score.pack === declaredPack) continue
    const exceeds = exceedsBy(score, declared, THRESHOLDS_BPS.MARGIN)
    let reason: AlternativeSignal['reason'] | null = null
    if (atLeast(score.confidence, THRESHOLDS_BPS.T_CLEAR) && exceeds) reason = 'CONFIDENCE_EXCEEDS_DECLARED'
    // Severe deterministic counter-signal: the declared pack received an explicit −8 counter-signal and the
    // alternative has meaningful support (>= T_MIN) and exceeds the declared pack by MARGIN.
    else if (severe && atLeast(score.confidence, THRESHOLDS_BPS.T_MIN) && exceeds) reason = 'SEVERE_COUNTER_SIGNAL'
    if (reason) {
      out.push({
        label: 'ALTERNATIVE_SIGNAL',
        pack: score.pack,
        reason,
        confidence: score.confidence,
        declaredPack,
        conflictsWithDeclaredBusinessType: true,
        requiresExplicitUserChoice: true,
      })
    }
  }
  return out
}

export function resolveOutcome(input: {
  declaredPack: SmartSetupPackKey | null
  declaredPackAvailable: boolean
  scores: readonly PackScore[]
  completeness: Completeness
  hardContradictions: readonly HardContradiction[]
}): OutcomeDecision {
  const { declaredPack, scores, completeness } = input
  const hard = input.hardContradictions.length > 0

  // §10.1 / §10.2 / §11: a declared supported BusinessType is sovereign for the primary pack.
  if (declaredPack) {
    const alternatives = crossSegmentAlternatives(declaredPack, scores)
    const declared = scores.find((score) => score.pack === declaredPack)
    const clear =
      input.declaredPackAvailable &&
      declared !== undefined &&
      completeness.meetsMinimum &&
      atLeast(declared.confidence, THRESHOLDS_BPS.T_CLEAR) &&
      !hard &&
      alternatives.length === 0
    return { outcome: clear ? 'CLEAR_MATCH' : 'BUSINESS_TYPE_ONLY', primaryPack: declaredPack, candidates: [], alternatives }
  }

  // §10.4 — no authority: never force a pack.
  if (hard) return { outcome: 'NO_CLEAR_MATCH', primaryPack: null, candidates: [], alternatives: [] }
  if (!completeness.meetsMinimum) return { outcome: 'NO_CLEAR_MATCH', primaryPack: null, candidates: [], alternatives: [] }
  const ranked = rankScores(scores)
  const [top, second] = ranked
  if (!top || !atLeast(top.confidence, THRESHOLDS_BPS.T_MIN)) return { outcome: 'NO_CLEAR_MATCH', primaryPack: null, candidates: [], alternatives: [] }

  // §10.1 (no declared type): clear only with T_CLEAR and MARGIN over the second candidate.
  if (atLeast(top.confidence, THRESHOLDS_BPS.T_CLEAR) && exceedsBy(top, second, THRESHOLDS_BPS.MARGIN)) {
    return { outcome: 'CLEAR_MATCH', primaryPack: top.pack, candidates: [], alternatives: [] }
  }

  // §10.3: two or more candidates with meaningful support (>= T_MIN) and no decisive separation.
  const meaningful = ranked.filter((score) => atLeast(score.confidence, THRESHOLDS_BPS.T_MIN))
  if (meaningful.length >= 2) return { outcome: 'AMBIGUOUS', primaryPack: null, candidates: meaningful.map((score) => score.pack), alternatives: [] }

  // §10.4: a single moderate candidate (>= T_MIN, < T_CLEAR, or without margin) is not enough.
  return { outcome: 'NO_CLEAR_MATCH', primaryPack: null, candidates: [], alternatives: [] }
}

/** Catalog fingerprint: order-independent summary of the published Wave 1 packs the engine can use. */
export function catalogFingerprint(catalog: readonly IndustryPackDefinition[], hash: HashFn): string {
  const summary = catalog
    .map((pack) => ({ ref: `${pack.key}@${pack.version}`, status: pack.status, businessType: pack.businessType, capabilities: [...pack.capabilities].sort() }))
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
  return hash(stableStringify(summary) ?? '[]')
}

export function recommendSmartSetup(rawAnswers: unknown, options: RecommendOptions): SmartSetupRecommendation {
  const validated = validateAnswers(rawAnswers)
  const normalized = normalizeAnswers(validated.answers)
  const unavailable = new Set(options.context?.unavailablePacks ?? [])
  const blockedCapabilities = new Set(options.context?.blockedCapabilities ?? [])

  const published = new Set(options.catalog.filter((pack) => pack.status === 'published').map((pack) => pack.key))
  const eligible = SMART_SETUP_PACKS.filter((pack) => published.has(pack) && !unavailable.has(pack))

  const authority = businessTypeAuthority(normalized.answers['q.business_type'])
  const declaredPackAvailable = authority !== null && eligible.includes(authority.pack)
  // The declared pack is always scored (even if unavailable) so its evidence stays explainable.
  const scoredPacks = authority && !declaredPackAvailable ? SMART_SETUP_PACKS.filter((pack) => eligible.includes(pack) || pack === authority.pack) : eligible

  const score = scorePacks(normalized.questions, normalized.answers, scoredPacks)
  const decision = resolveOutcome({
    declaredPack: authority?.pack ?? null,
    declaredPackAvailable,
    scores: score.packScores,
    completeness: score.completeness,
    hardContradictions: score.hardContradictions,
  })

  const blockedOrUnavailable: BlockedOrUnavailable[] = []
  for (const pack of SMART_SETUP_PACKS) {
    if (!published.has(pack)) blockedOrUnavailable.push({ kind: 'pack', key: pack, reason: 'PACK_NOT_IN_CATALOG' })
    else if (unavailable.has(pack)) blockedOrUnavailable.push({ kind: 'pack', key: pack, reason: 'UNAVAILABLE_IN_CALLER_CONTEXT' })
  }
  for (const capability of [...blockedCapabilities].sort()) blockedOrUnavailable.push({ kind: 'capability', key: capability, reason: 'BLOCKED_IN_CALLER_CONTEXT' })

  const rationale = buildRationale({
    outcome: decision.outcome,
    primaryPack: decision.primaryPack,
    declared: authority !== null,
    candidates: decision.candidates,
    packScores: score.packScores,
    signals: score.signals,
    counterSignals: score.counterSignals,
    hardContradictions: score.hardContradictions,
    alternatives: decision.alternatives,
    completeness: score.completeness,
    declaredPackUnavailable: authority !== null && !declaredPackAvailable,
  })

  const inputFingerprint = options.hash(
    stableStringify({ questionnaireVersion: QUESTIONNAIRE_VERSION, rulesetVersion: RULESET_VERSION, answers: normalized.answers }) ?? '{}',
  )

  return {
    schemaVersion: 1,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    rulesetVersion: RULESET_VERSION,
    outcome: decision.outcome,
    primaryPack: decision.primaryPack,
    declaredBusinessType: authority,
    candidates: decision.candidates,
    packScores: score.packScores,
    completeness: score.completeness,
    supportingSignals: score.signals,
    counterSignals: score.counterSignals,
    hardContradictions: score.hardContradictions,
    alternativeSignals: decision.alternatives,
    recommendedCapabilities: inferCapabilities(normalized.questions, decision.primaryPack, options.catalog, blockedCapabilities),
    blockedOrUnavailable,
    rationaleCodes: flattenCodes(rationale, authority !== null),
    rationale,
    inputIssues: [...validated.issues, ...normalized.issues],
    questions: normalized.questions,
    catalogFingerprint: catalogFingerprint(options.catalog, options.hash),
    inputFingerprint,
    applied: false,
    applyStatus: 'NOT_AUTHORIZED',
  }
}
