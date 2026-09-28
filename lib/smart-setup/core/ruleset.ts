// Smart Setup Ruleset V1 — weights, thresholds and the deterministic evidence mapping.
// Every row cites the Product Approval section it implements. Two technical adaptations are
// marked ADAPTATION and are documented in ORCALY_SMART_SETUP_T2_IMPLEMENTATION_REPORT.md.

import type { NormalizedAnswers, QuestionId, RationaleCode, SmartSetupPackKey } from './types'

/** §6 / §21. BusinessType has NO numeric weight: it is an authority/eligibility gate. */
export const WEIGHTS = {
  SUBSEGMENT: 10,
  STRONG: 6,
  WEAK: 3,
  EXPLICIT_CONTRADICTION: 8,
  GOAL_ALIGNMENT: 0,
} as const

/** §7.1 */
export const MAX_PACK_POINTS_PER_QUESTION = 6

/** §9, in basis points (integers; comparisons are exact, no float drift). */
export const THRESHOLDS_BPS = {
  T_CLEAR: 7000,
  T_MIN: 4500,
  MARGIN: 1500,
  MIN_COMPLETENESS: 4000,
} as const

export const OUTCOMES = ['CLEAR_MATCH', 'AMBIGUOUS', 'NO_CLEAR_MATCH', 'BUSINESS_TYPE_ONLY'] as const

export type EvidenceRule = {
  questionId: QuestionId
  option: string
  pack: SmartSetupPackKey
  strength: 'STRONG' | 'WEAK'
  code: RationaleCode
  /** Optional deterministic precondition over other answers. */
  when?: (answers: NormalizedAnswers) => boolean
  source: string
}

const G = 'graphic.print_shop'
const F = 'food.restaurant'
const S = 'services.general'
const R = 'store.local_store'

const rule = (
  questionId: QuestionId,
  option: string,
  pack: SmartSetupPackKey,
  strength: 'STRONG' | 'WEAK',
  code: RationaleCode,
  source: string,
  when?: (answers: NormalizedAnswers) => boolean,
): EvidenceRule => (when ? { questionId, option, pack, strength, code, source, when } : { questionId, option, pack, strength, code, source })

const customWorkExists = (answers: NormalizedAnswers) => answers['q.production'] === 'CUSTOM_TO_ORDER' || answers['q.production'] === 'MULTI_STAGE'

/** Pack evidence (PACK_EVIDENCE questions). q.team_mode and q.business_type never appear here. */
export const EVIDENCE_RULES: readonly EvidenceRule[] = [
  // Q3 offer_kind (§3)
  rule('q.offer_kind', 'PRODUCTS', R, 'STRONG', 'OFFER_PRODUCTS', '§3 Q3 PRODUCTS: strong Store'),
  rule('q.offer_kind', 'PRODUCTS', G, 'WEAK', 'OFFER_PRODUCTS', '§3 Q3 PRODUCTS: supporting Graphics'),
  rule('q.offer_kind', 'PRODUCTS', F, 'WEAK', 'OFFER_PRODUCTS', '§3 Q3 PRODUCTS: supporting Food'),
  rule('q.offer_kind', 'SERVICES', S, 'STRONG', 'OFFER_SERVICES', '§3 Q3 SERVICES: strong Services'),
  rule('q.offer_kind', 'SERVICES', G, 'WEAK', 'OFFER_SERVICES', '§3 Q3 SERVICES: supporting Graphics where custom work exists', customWorkExists),
  rule('q.offer_kind', 'BOTH', G, 'WEAK', 'OFFER_PRODUCTS_AND_SERVICES', '§3 Q3 BOTH: supports mixed Graphics'),
  rule('q.offer_kind', 'BOTH', S, 'WEAK', 'OFFER_PRODUCTS_AND_SERVICES', '§3 Q3 BOTH: supports mixed Services'),
  rule('q.offer_kind', 'BOTH', R, 'WEAK', 'OFFER_PRODUCTS_AND_SERVICES', '§3 Q3 BOTH: supports mixed Store'),
  rule('q.offer_kind', 'BOTH', F, 'WEAK', 'OFFER_PRODUCTS_AND_SERVICES', '§3 Q3 BOTH: weakly supports Food'),
  // Q4 sales_channels (§3). WHATSAPP / IN_PERSON / INSTAGRAM_SOCIAL / PHONE_OTHER are neutral for identity.
  rule('q.sales_channels', 'MARKETPLACE', R, 'STRONG', 'MARKETPLACE_SALES', '§3 Q4 MARKETPLACE strongly supports Store'),
  rule('q.sales_channels', 'WEBSITE_ECOMMERCE', R, 'WEAK', 'CATALOG_SALES', '§3 Q4 WEBSITE_ECOMMERCE supports catalog_sales, especially Store'),
  // Q5 quote_flow (§3). NO is not a contradiction.
  rule('q.quote_flow', 'FREQUENT', G, 'STRONG', 'QUOTE_LED_OPERATION', '§3 Q5 FREQUENT: strong Graphics'),
  rule('q.quote_flow', 'FREQUENT', S, 'STRONG', 'QUOTE_LED_OPERATION', '§3 Q5 FREQUENT: strong Services'),
  rule('q.quote_flow', 'SOMETIMES', G, 'WEAK', 'QUOTE_LED_OPERATION', '§3 Q5 SOMETIMES: weak Graphics'),
  rule('q.quote_flow', 'SOMETIMES', S, 'WEAK', 'QUOTE_LED_OPERATION', '§3 Q5 SOMETIMES: weak Services'),
  // Q6 production (§3). NO is neutral.
  rule('q.production', 'CUSTOM_TO_ORDER', G, 'STRONG', 'CUSTOM_PRODUCTION', '§3 Q6 CUSTOM_TO_ORDER: strong Graphics'),
  rule('q.production', 'CUSTOM_TO_ORDER', S, 'WEAK', 'CUSTOM_PRODUCTION', '§3 Q6 CUSTOM_TO_ORDER: weak Services'),
  rule('q.production', 'MULTI_STAGE', G, 'STRONG', 'PRODUCTION_TRACKING', '§3 Q6 MULTI_STAGE: strong Graphics'),
  rule('q.production', 'MULTI_STAGE', F, 'WEAK', 'PRODUCTION_TRACKING', '§3 Q6 MULTI_STAGE: weak Food'),
  rule('q.production', 'MULTI_STAGE', S, 'WEAK', 'PRODUCTION_TRACKING', '§3 Q6 MULTI_STAGE: weak Services'),
  rule('q.production', 'SIMPLE_PREPARATION', F, 'STRONG', 'FOOD_PREPARATION', '§3 Q6 SIMPLE_PREPARATION: strong Food'),
  rule('q.production', 'SIMPLE_PREPARATION', G, 'WEAK', 'FOOD_PREPARATION', '§3 Q6 SIMPLE_PREPARATION: weak others'),
  rule('q.production', 'SIMPLE_PREPARATION', S, 'WEAK', 'FOOD_PREPARATION', '§3 Q6 SIMPLE_PREPARATION: weak others'),
  rule('q.production', 'SIMPLE_PREPARATION', R, 'WEAK', 'FOOD_PREPARATION', '§3 Q6 SIMPLE_PREPARATION: weak others'),
  // Q7 art_approval (§3). NO is neutral (Graphics without art approval is not a contradiction, §14.2).
  rule('q.art_approval', 'REQUIRED', G, 'STRONG', 'ART_APPROVAL', '§3 Q7 REQUIRED: strong Graphics'),
  rule('q.art_approval', 'SOMETIMES', G, 'WEAK', 'ART_APPROVAL', '§3 Q7 SOMETIMES: weak Graphics'),
  // Q8 fulfillment (§3). No option alone determines the pack; per-question cap applies.
  rule('q.fulfillment', 'DELIVERY', F, 'STRONG', 'DELIVERY_OPERATION', '§3 Q8 delivery: strong Food'),
  rule('q.fulfillment', 'DELIVERY', R, 'STRONG', 'DELIVERY_OPERATION', '§3 Q8 delivery: strong Store'),
  rule('q.fulfillment', 'DELIVERY', G, 'WEAK', 'DELIVERY_OPERATION', '§3 Q8 delivery: weak Graphics'),
  rule('q.fulfillment', 'PICKUP', F, 'STRONG', 'PICKUP_OPERATION', '§3 Q8 pickup: strong Food'),
  rule('q.fulfillment', 'PICKUP', R, 'STRONG', 'PICKUP_OPERATION', '§3 Q8 pickup: strong Store'),
  rule('q.fulfillment', 'PICKUP', G, 'WEAK', 'PICKUP_OPERATION', '§3 Q8 pickup: weak Graphics'),
  rule('q.fulfillment', 'ON_SITE', S, 'STRONG', 'ON_SITE_SERVICE', '§3 Q8 on-site: strong Services'),
  rule('q.fulfillment', 'DIGITAL_OR_REMOTE', S, 'WEAK', 'REMOTE_SERVICE', '§3 Q8 digital/remote: weak Services'),
  // Q9 scheduling (§3). NO is neutral.
  rule('q.scheduling', 'FREQUENT', S, 'STRONG', 'APPOINTMENT_LED_SERVICE', '§3 Q9 FREQUENT: strong Services'),
  rule('q.scheduling', 'SOMETIMES', S, 'WEAK', 'APPOINTMENT_LED_SERVICE', '§3 Q9 SOMETIMES: weak Services'),
  // Q10 stock_control (§3). NO_STOCK is neutral ("lack of stock does not invalidate Services"; §14.2 store without stock is not invalid).
  // ADAPTATION A2: "stock structure strongly supports Store" is read as WAREHOUSE_OR_DEPOSIT / MULTI_LOCATION (the options Q10 added
  // to capture structure); SIMPLE_STOCK is weak Store. Required for persona A2 (Food vs Store) to be AMBIGUOUS.
  rule('q.stock_control', 'SIMPLE_STOCK', R, 'WEAK', 'STOCK_OPERATION', '§3 Q10 simple stock: weak Store (ADAPTATION A2)'),
  rule('q.stock_control', 'SIMPLE_STOCK', G, 'WEAK', 'STOCK_OPERATION', '§3 Q10 weakly supports Graphics'),
  rule('q.stock_control', 'SIMPLE_STOCK', F, 'WEAK', 'STOCK_OPERATION', '§3 Q10 weakly supports Food'),
  rule('q.stock_control', 'WAREHOUSE_OR_DEPOSIT', R, 'STRONG', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 stock structure strongly supports Store'),
  rule('q.stock_control', 'WAREHOUSE_OR_DEPOSIT', G, 'WEAK', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 weakly supports Graphics'),
  rule('q.stock_control', 'WAREHOUSE_OR_DEPOSIT', F, 'WEAK', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 weakly supports Food'),
  rule('q.stock_control', 'MULTI_LOCATION', R, 'STRONG', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 stock structure strongly supports Store'),
  rule('q.stock_control', 'MULTI_LOCATION', G, 'WEAK', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 weakly supports Graphics'),
  rule('q.stock_control', 'MULTI_LOCATION', F, 'WEAK', 'DEPOSIT_OR_MULTI_LOCATION', '§3 Q10 weakly supports Food'),
  // Q12 lead_followup (§3). Neutral for Food; hidden for FOOD.
  rule('q.lead_followup', 'FREQUENT', S, 'STRONG', 'CRM_FOLLOWUP', '§3 Q12 strong Services at FREQUENT'),
  rule('q.lead_followup', 'FREQUENT', G, 'STRONG', 'CRM_FOLLOWUP', '§3 Q12 strong Graphics at FREQUENT'),
  rule('q.lead_followup', 'FREQUENT', R, 'WEAK', 'CRM_FOLLOWUP', '§3 Q12 weak Store where consultative sales exist'),
  rule('q.lead_followup', 'SOMETIMES', S, 'WEAK', 'CRM_FOLLOWUP', '§3 Q12 weak Services at SOMETIMES'),
  rule('q.lead_followup', 'SOMETIMES', G, 'WEAK', 'CRM_FOLLOWUP', '§3 Q12 weak Graphics at SOMETIMES'),
  rule('q.lead_followup', 'SOMETIMES', R, 'WEAK', 'CRM_FOLLOWUP', '§3 Q12 weak Store where consultative sales exist'),
]

/** Q2: a known subsegment supports the DECLARED pack with +10. OTHER / NOT_SURE never score and never contradict. */
export const NON_SCORING_SUBSEGMENTS: readonly string[] = ['OTHER', 'NOT_SURE']

/**
 * Evidence families: answers that express the same underlying trait share one cap per pack.
 * ADAPTATION A1 (confirmed by the user on 2026-09-28, pending Agent 7 ratification): on-site attendance
 * and scheduling describe one "service attendance" trait (scheduling is asked BECAUSE on-site work is
 * plausible, §3 Q9), so together they add at most one strong unit to Services — the §7.1 anti-inflation
 * principle applied across two questions. Required for persona A1 (Graphics vs Services) to be AMBIGUOUS.
 */
export type EvidenceFamily = { id: string; pack: SmartSetupPackKey; members: ReadonlyArray<{ questionId: QuestionId; options: readonly string[] | 'ANY' }>; cap: number; source: string }

export const EVIDENCE_FAMILIES: readonly EvidenceFamily[] = [
  {
    id: 'family.service_attendance',
    pack: S,
    members: [
      { questionId: 'q.fulfillment', options: ['ON_SITE'] },
      { questionId: 'q.scheduling', options: 'ANY' },
    ],
    cap: 6,
    source: 'ADAPTATION A1 — §7.1 anti-inflation applied to on-site + scheduling',
  },
]

/** §14.2: −8 ONLY for explicit mappings. Atypical ≠ invalid; no stereotype-based penalties. */
export type CounterRule = { questionId: QuestionId; option: string; pack: SmartSetupPackKey; code: RationaleCode; source: string }

export const COUNTER_RULES: readonly CounterRule[] = [
  {
    questionId: 'q.offer_kind',
    option: 'SERVICES',
    pack: R,
    code: 'COUNTER_SIGNAL_EXPLICIT',
    source: '§14.1 B: Store declared with a services-only offer is an explicit cross-segment counter-signal',
  },
]

/** §14.1 A: answers that cannot both describe the same setup. Gate, not a score. */
export type HardContradictionRule = {
  id: string
  test: (answers: NormalizedAnswers) => { questionIds: QuestionId[]; options: string[] } | null
  source: string
}

export const HARD_CONTRADICTION_RULES: readonly HardContradictionRule[] = [
  {
    id: 'hard.fulfillment_none_with_modes',
    source: '§14.1 A: "none / not applicable" fulfillment selected together with concrete fulfillment modes',
    test: (answers) => {
      const value = answers['q.fulfillment']
      if (!Array.isArray(value) || !value.includes('NONE_OR_NOT_APPLICABLE')) return null
      const concrete = value.filter((option) => option !== 'NONE_OR_NOT_APPLICABLE')
      return concrete.length ? { questionIds: ['q.fulfillment'], options: ['NONE_OR_NOT_APPLICABLE', ...concrete] } : null
    },
  },
]

export const RULESET_SUMMARY = {
  businessTypeRole: 'AUTHORITY_ELIGIBILITY_GATE',
  mainGoal: 'NOT_A_V1_QUESTION',
  teamModePackContribution: 0,
  adaptations: ['A1 family.service_attendance cap', 'A2 SIMPLE_STOCK is weak Store evidence'],
} as const
