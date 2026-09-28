// Smart Setup T2 — pure core types. No I/O, no clock, no randomness, no PII.
// Normative source: ORCALY_SMART_SETUP_RULESET_PRODUCT_APPROVAL.md (Agent 7, PRODUCT_APPROVED).

import type { BusinessType } from '@/lib/business-types'
import type { CapabilityKey } from '../../industry-packs/core/constants'

export type { CapabilityKey }

export const QUESTIONNAIRE_VERSION = 'smart-setup.questionnaire.v1' as const
export const RULESET_VERSION = 'smart-setup.ruleset.v1.0.0' as const

/** Question ids of Questionnaire V1 (§3). `q.deposit` and `q.main_goal` are NOT V1 questions. */
export const QUESTION_IDS = [
  'q.business_type',
  'q.subsegment',
  'q.offer_kind',
  'q.sales_channels',
  'q.quote_flow',
  'q.production',
  'q.art_approval',
  'q.fulfillment',
  'q.scheduling',
  'q.stock_control',
  'q.team_mode',
  'q.lead_followup',
] as const
export type QuestionId = (typeof QUESTION_IDS)[number]

/** Ids from the initial technical proposal that V1 removed or replaced (§2). Answers to them are ignored. */
export const REMOVED_QUESTION_IDS = ['q.deposit', 'q.main_goal', 'q.team_size', 'q.delivery'] as const

export type QuestionRole = 'PRIMARY_AUTHORITY' | 'PACK_EVIDENCE' | 'CAPABILITY_ONLY'

export const NOT_SURE = 'NOT_SURE' as const

export type DeclaredBusinessTypeAnswer = 'GRAPHICS' | 'FOOD' | 'SERVICES' | 'STORE'
export type BusinessTypeAnswer = DeclaredBusinessTypeAnswer | typeof NOT_SURE

/** Wave 1 primary packs (one per supported BusinessType). */
export const SMART_SETUP_PACKS = ['graphic.print_shop', 'food.restaurant', 'services.general', 'store.local_store'] as const
export type SmartSetupPackKey = (typeof SMART_SETUP_PACKS)[number]

export type BusinessTypeAuthority = {
  answer: DeclaredBusinessTypeAnswer
  businessType: Extract<BusinessType, 'graphic' | 'food' | 'services' | 'store'>
  pack: SmartSetupPackKey
}

export type QuestionDefinition = {
  id: QuestionId
  role: QuestionRole
  selection: 'single' | 'multi'
  /** Counts toward completeness and MAX_AVAILABLE_SUPPORT when answered (PACK_EVIDENCE only). */
  scored: boolean
  /** Options; for q.subsegment they depend on the declared business type. */
  options: readonly string[] | Readonly<Record<DeclaredBusinessTypeAnswer, readonly string[]>>
  /** Deterministic branching rule, described in the questionnaire contract. */
  condition: string | null
}

/** Normalized answers: single → option string, multi → canonical ordered option list. */
export type NormalizedAnswers = Partial<Record<QuestionId, string | readonly string[]>>

export type QuestionStatus = 'ANSWERED' | 'NOT_SURE' | 'UNANSWERED' | 'HIDDEN'

export type QuestionState = {
  id: QuestionId
  role: QuestionRole
  scored: boolean
  presented: boolean
  status: QuestionStatus
  /** Canonical selected options (empty when NOT_SURE / UNANSWERED / HIDDEN). */
  selected: readonly string[]
}

export type InputIssueCode =
  | 'INPUT_NOT_OBJECT'
  | 'ANSWERS_NOT_OBJECT'
  | 'UNKNOWN_QUESTION'
  | 'REMOVED_QUESTION'
  | 'INVALID_OPTION'
  | 'INVALID_VALUE_TYPE'
  | 'DUPLICATE_OPTION'
  | 'NOT_SURE_MIXED_WITH_OPTIONS'
  | 'EMPTY_SELECTION'
  | 'HIDDEN_QUESTION_ANSWER_IGNORED'
  | 'TOO_MANY_FIELDS'

/** Issues never echo raw values: free text or PII typed into a field is never copied into output. */
export type InputIssue = { code: InputIssueCode; questionId: string | null }

export type PackEvidenceStrength = 'SUBSEGMENT' | 'STRONG' | 'WEAK'

export type RationaleCode =
  | 'DECLARED_BUSINESS_TYPE'
  | 'SUBSEGMENT_MATCH'
  | 'OFFER_PRODUCTS'
  | 'OFFER_SERVICES'
  | 'OFFER_PRODUCTS_AND_SERVICES'
  | 'QUOTE_LED_OPERATION'
  | 'CUSTOM_PRODUCTION'
  | 'ART_APPROVAL'
  | 'PRODUCTION_TRACKING'
  | 'FOOD_PREPARATION'
  | 'DELIVERY_OPERATION'
  | 'PICKUP_OPERATION'
  | 'ON_SITE_SERVICE'
  | 'REMOTE_SERVICE'
  | 'APPOINTMENT_LED_SERVICE'
  | 'CATALOG_SALES'
  | 'STOCK_OPERATION'
  | 'DEPOSIT_OR_MULTI_LOCATION'
  | 'CRM_FOLLOWUP'
  | 'MARKETPLACE_SALES'
  | 'INSUFFICIENT_COMPLETENESS'
  | 'WEAK_EVIDENCE'
  | 'CLOSE_CANDIDATES'
  | 'CROSS_SEGMENT_SIGNAL'
  | 'ANSWER_CONTRADICTION'
  | 'COUNTER_SIGNAL_EXPLICIT'
  | 'DECLARED_PACK_UNAVAILABLE'

/** One unit of pack evidence produced by an answer (after per-question and family caps). */
export type EvidenceSignal = {
  pack: SmartSetupPackKey
  questionId: QuestionId
  option: string
  strength: PackEvidenceStrength
  code: RationaleCode
  /** Points actually counted after caps (0 when fully absorbed by a cap). */
  points: number
  /** Points before caps, for auditability. */
  nominalPoints: number
}

/** Explicit counter-evidence from the ruleset mapping (−8). Never inferred from stereotypes. */
export type CounterSignal = {
  pack: SmartSetupPackKey
  questionId: QuestionId
  option: string
  kind: 'CROSS_SEGMENT_COUNTER_SIGNAL'
  code: RationaleCode
  points: number
}

/** Answers that cannot both describe the same setup. Gate, not a score. */
export type HardContradiction = {
  kind: 'HARD_ANSWER_CONTRADICTION'
  rule: string
  questionIds: readonly QuestionId[]
  options: readonly string[]
}

export type Ratio = { numerator: number; denominator: number; bps: number }

export type PackScore = {
  pack: SmartSetupPackKey
  rawSupport: number
  rawPenalty: number
  rawScore: number
  maxAvailableSupport: number
  /** Not a probability: share of the answered evidence that supports this pack. */
  confidence: Ratio
}

export type Outcome = 'CLEAR_MATCH' | 'AMBIGUOUS' | 'NO_CLEAR_MATCH' | 'BUSINESS_TYPE_ONLY'

export type AlternativeSignal = {
  label: 'ALTERNATIVE_SIGNAL'
  pack: SmartSetupPackKey
  reason: 'CONFIDENCE_EXCEEDS_DECLARED' | 'SEVERE_COUNTER_SIGNAL'
  confidence: Ratio
  declaredPack: SmartSetupPackKey
  conflictsWithDeclaredBusinessType: true
  requiresExplicitUserChoice: true
}

export type CapabilitySource = { questionId: QuestionId | 'PRIMARY_PACK'; option: string | null }

export type RecommendedCapability = {
  capability: CapabilityKey
  strength: 'STRONG' | 'WEAK'
  sources: readonly CapabilitySource[]
}

export type BlockedOrUnavailable = { kind: 'pack' | 'capability'; key: string; reason: string }

export type NextChoice =
  | 'CONFIRM_OR_CHANGE_PRIMARY'
  | 'REVIEW_REFERENCE_PACK'
  | 'CHOOSE_BETWEEN_CANDIDATES'
  | 'CHOOSE_SEGMENT_OR_CONTINUE_WITHOUT_PACK'

export type Rationale = {
  primaryReason: RationaleCode
  supportingSignals: readonly RationaleCode[]
  counterSignals: readonly RationaleCode[]
  uncertainty: readonly RationaleCode[]
  nextChoice: NextChoice
}

export type Completeness = {
  answeredScored: number
  presentedScored: number
  ratio: Ratio
  meetsMinimum: boolean
}

export type SmartSetupRecommendation = {
  schemaVersion: 1
  questionnaireVersion: typeof QUESTIONNAIRE_VERSION
  rulesetVersion: typeof RULESET_VERSION
  outcome: Outcome
  primaryPack: SmartSetupPackKey | null
  declaredBusinessType: BusinessTypeAuthority | null
  /** Only for AMBIGUOUS: the packs the user must choose between (display order, never a winner). */
  candidates: readonly SmartSetupPackKey[]
  packScores: readonly PackScore[]
  completeness: Completeness
  supportingSignals: readonly EvidenceSignal[]
  counterSignals: readonly CounterSignal[]
  hardContradictions: readonly HardContradiction[]
  alternativeSignals: readonly AlternativeSignal[]
  recommendedCapabilities: readonly RecommendedCapability[]
  blockedOrUnavailable: readonly BlockedOrUnavailable[]
  rationaleCodes: readonly RationaleCode[]
  rationale: Rationale
  inputIssues: readonly InputIssue[]
  questions: readonly QuestionState[]
  catalogFingerprint: string
  inputFingerprint: string
  /** Invariants of T2: nothing is applied, persisted or sent anywhere. */
  applied: false
  applyStatus: 'NOT_AUTHORIZED'
}
