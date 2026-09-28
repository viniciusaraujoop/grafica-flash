// Smart Setup T2 — public surface of the pure core. Recommendation only: no apply, no I/O.

export * from './types'
export { QUESTIONNAIRE_V1, businessTypeAuthority, isApplicable, optionsFor, questionDefinition } from './questionnaire'
export { validateAnswers, MAX_INPUT_FIELDS, type ValidatedAnswers } from './validate-answers'
export { normalizeAnswers, type NormalizedInput } from './normalize'
export { CAPABILITY_RULES, inferCapabilities, type CapabilityRule } from './capabilities'
export {
  COUNTER_RULES,
  EVIDENCE_FAMILIES,
  EVIDENCE_RULES,
  HARD_CONTRADICTION_RULES,
  MAX_PACK_POINTS_PER_QUESTION,
  NON_SCORING_SUBSEGMENTS,
  OUTCOMES,
  RULESET_SUMMARY,
  THRESHOLDS_BPS,
  WEIGHTS,
} from './ruleset'
export { atLeast, ratio, scorePacks, type ScoreResult } from './score'
export { RATIONALE_CODE_ORDER, buildRationale } from './rationale'
export { catalogFingerprint, crossSegmentAlternatives, rankScores, recommendSmartSetup, resolveOutcome, type OutcomeDecision, type RecommendOptions } from './recommend'
export { buildSetupProposal, type ProposalOptions, type SetupProposal, type SetupProposalStatus } from './proposal'
