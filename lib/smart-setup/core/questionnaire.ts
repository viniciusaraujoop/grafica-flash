// Smart Setup Questionnaire V1 (§3) and deterministic branching (§3 conditionals, §4).

import {
  NOT_SURE,
  type BusinessTypeAuthority,
  type DeclaredBusinessTypeAnswer,
  type NormalizedAnswers,
  type QuestionDefinition,
  type QuestionId,
} from './types'

const SUBSEGMENTS: Readonly<Record<DeclaredBusinessTypeAnswer, readonly string[]>> = {
  GRAPHICS: ['PRINT_SHOP', 'VISUAL_COMMUNICATION', 'PERSONALIZED_PRINTING', 'MIXED_GRAPHICS', 'OTHER', NOT_SURE],
  FOOD: ['RESTAURANT', 'SNACK_BAR', 'PIZZERIA', 'BAKERY_OR_CAFE', 'DARK_KITCHEN', 'MIXED_FOOD', 'OTHER', NOT_SURE],
  SERVICES: ['MAINTENANCE', 'TECHNICAL_ASSISTANCE', 'CONSULTING', 'PROFESSIONAL_SERVICE', 'FIELD_SERVICE', 'MIXED_SERVICES', 'OTHER', NOT_SURE],
  STORE: ['LOCAL_RETAIL', 'RESELLER', 'HYBRID_PHYSICAL_ONLINE', 'SPECIALTY_STORE', 'MIXED_RETAIL', 'OTHER', NOT_SURE],
}

const FREQUENCY = ['FREQUENT', 'SOMETIMES', 'NO', NOT_SURE] as const

export const QUESTIONNAIRE_V1: readonly QuestionDefinition[] = [
  { id: 'q.business_type', role: 'PRIMARY_AUTHORITY', selection: 'single', scored: false, options: ['GRAPHICS', 'FOOD', 'SERVICES', 'STORE', NOT_SURE], condition: null },
  { id: 'q.subsegment', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: SUBSEGMENTS, condition: 'q.business_type is a supported declared type' },
  { id: 'q.offer_kind', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: ['PRODUCTS', 'SERVICES', 'BOTH', NOT_SURE], condition: null },
  { id: 'q.sales_channels', role: 'PACK_EVIDENCE', selection: 'multi', scored: true, options: ['IN_PERSON', 'WHATSAPP', 'WEBSITE_ECOMMERCE', 'INSTAGRAM_SOCIAL', 'MARKETPLACE', 'PHONE_OTHER', NOT_SURE], condition: null },
  { id: 'q.quote_flow', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: FREQUENCY, condition: null },
  { id: 'q.production', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: ['CUSTOM_TO_ORDER', 'MULTI_STAGE', 'SIMPLE_PREPARATION', 'NO', NOT_SURE], condition: null },
  { id: 'q.art_approval', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: ['REQUIRED', 'SOMETIMES', 'NO', NOT_SURE], condition: 'q.business_type = GRAPHICS or q.production = CUSTOM_TO_ORDER' },
  { id: 'q.fulfillment', role: 'PACK_EVIDENCE', selection: 'multi', scored: true, options: ['DELIVERY', 'PICKUP', 'ON_SITE', 'DIGITAL_OR_REMOTE', 'NONE_OR_NOT_APPLICABLE', NOT_SURE], condition: null },
  {
    id: 'q.scheduling',
    role: 'PACK_EVIDENCE',
    selection: 'single',
    scored: true,
    options: FREQUENCY,
    condition: 'hidden only when clearly irrelevant: q.offer_kind = PRODUCTS, q.business_type ≠ SERVICES and q.fulfillment has neither ON_SITE nor DIGITAL_OR_REMOTE',
  },
  { id: 'q.stock_control', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: ['NO_STOCK', 'SIMPLE_STOCK', 'WAREHOUSE_OR_DEPOSIT', 'MULTI_LOCATION', NOT_SURE], condition: null },
  { id: 'q.team_mode', role: 'CAPABILITY_ONLY', selection: 'single', scored: false, options: ['SOLO', 'TEAM_SHARED_TASKS', 'TEAM_WITHOUT_SHARED_TASKS', NOT_SURE], condition: null },
  { id: 'q.lead_followup', role: 'PACK_EVIDENCE', selection: 'single', scored: true, options: FREQUENCY, condition: 'hidden when q.business_type = FOOD (neutral for Food)' },
]

const BY_ID = new Map(QUESTIONNAIRE_V1.map((question) => [question.id, question]))

export function questionDefinition(id: QuestionId): QuestionDefinition {
  return BY_ID.get(id) as QuestionDefinition
}

const AUTHORITY: Readonly<Record<DeclaredBusinessTypeAnswer, BusinessTypeAuthority>> = {
  GRAPHICS: { answer: 'GRAPHICS', businessType: 'graphic', pack: 'graphic.print_shop' },
  FOOD: { answer: 'FOOD', businessType: 'food', pack: 'food.restaurant' },
  SERVICES: { answer: 'SERVICES', businessType: 'services', pack: 'services.general' },
  STORE: { answer: 'STORE', businessType: 'store', pack: 'store.local_store' },
}

/** §3 Q1 mapping. NOT_SURE / unanswered → no authority gate. */
export function businessTypeAuthority(answer: string | readonly string[] | undefined): BusinessTypeAuthority | null {
  return typeof answer === 'string' && Object.prototype.hasOwnProperty.call(AUTHORITY, answer) ? AUTHORITY[answer as DeclaredBusinessTypeAnswer] : null
}

/** Allowed options for a question given the (already validated) business type. */
export function optionsFor(id: QuestionId, businessType: string | undefined): readonly string[] {
  const options = questionDefinition(id).options
  if (!Array.isArray(options)) {
    const authority = businessTypeAuthority(businessType)
    return authority ? (options as Readonly<Record<DeclaredBusinessTypeAnswer, readonly string[]>>)[authority.answer] : []
  }
  return options as readonly string[]
}

const single = (answers: NormalizedAnswers, id: QuestionId): string | undefined => {
  const value = answers[id]
  return typeof value === 'string' ? value : undefined
}
const multi = (answers: NormalizedAnswers, id: QuestionId): readonly string[] => {
  const value = answers[id]
  return Array.isArray(value) ? value : []
}

/**
 * Deterministic applicability. Depends only on answers to always-presented questions
 * (business_type, offer_kind, production, fulfillment), so one pass is enough.
 */
export function isApplicable(id: QuestionId, answers: NormalizedAnswers): boolean {
  const businessType = single(answers, 'q.business_type')
  switch (id) {
    case 'q.subsegment':
      return businessTypeAuthority(businessType) !== null
    case 'q.art_approval':
      return businessType === 'GRAPHICS' || single(answers, 'q.production') === 'CUSTOM_TO_ORDER'
    case 'q.scheduling': {
      const fulfillment = multi(answers, 'q.fulfillment')
      const clearlyIrrelevant =
        single(answers, 'q.offer_kind') === 'PRODUCTS' &&
        businessType !== 'SERVICES' &&
        !fulfillment.includes('ON_SITE') &&
        !fulfillment.includes('DIGITAL_OR_REMOTE')
      return !clearlyIrrelevant
    }
    case 'q.lead_followup':
      return businessType !== 'FOOD'
    default:
      return true
  }
}
