// Capability inference (§3 per-question "Capability" lines, §5). Uses ONLY the 15 certified T1 keys.
// Capabilities never decide pack identity; q.team_mode is capability-only.

import { CAPABILITY_KEYS } from '../../industry-packs/core/constants'
import type { IndustryPackDefinition } from '../../industry-packs/core/types'
import type { CapabilityKey, CapabilitySource, QuestionId, QuestionState, RecommendedCapability, SmartSetupPackKey } from './types'

export type CapabilityRule = { questionId: QuestionId; option: string; capability: CapabilityKey; strength: 'STRONG' | 'WEAK' }

const cap = (questionId: QuestionId, option: string, capability: CapabilityKey, strength: 'STRONG' | 'WEAK' = 'STRONG'): CapabilityRule => ({ questionId, option, capability, strength })

export const CAPABILITY_RULES: readonly CapabilityRule[] = [
  cap('q.sales_channels', 'MARKETPLACE', 'cap.marketplace_channel'),
  cap('q.sales_channels', 'WEBSITE_ECOMMERCE', 'cap.catalog_sales'),
  cap('q.quote_flow', 'FREQUENT', 'cap.quotes'),
  cap('q.quote_flow', 'SOMETIMES', 'cap.quotes'),
  cap('q.production', 'CUSTOM_TO_ORDER', 'cap.custom_production'),
  cap('q.production', 'MULTI_STAGE', 'cap.production_tracking'),
  cap('q.production', 'SIMPLE_PREPARATION', 'cap.production_tracking', 'WEAK'),
  cap('q.art_approval', 'REQUIRED', 'cap.art_approval'),
  cap('q.art_approval', 'SOMETIMES', 'cap.art_approval'),
  cap('q.fulfillment', 'DELIVERY', 'cap.delivery'),
  cap('q.fulfillment', 'PICKUP', 'cap.pickup'),
  cap('q.fulfillment', 'ON_SITE', 'cap.on_site_service'),
  cap('q.scheduling', 'FREQUENT', 'cap.appointments'),
  cap('q.scheduling', 'SOMETIMES', 'cap.appointments'),
  cap('q.stock_control', 'SIMPLE_STOCK', 'cap.stock'),
  cap('q.stock_control', 'WAREHOUSE_OR_DEPOSIT', 'cap.stock'),
  cap('q.stock_control', 'WAREHOUSE_OR_DEPOSIT', 'cap.deposit'),
  cap('q.stock_control', 'MULTI_LOCATION', 'cap.stock'),
  cap('q.stock_control', 'MULTI_LOCATION', 'cap.deposit'),
  cap('q.team_mode', 'TEAM_SHARED_TASKS', 'cap.team_tasks'),
  cap('q.lead_followup', 'FREQUENT', 'cap.crm_followup'),
  cap('q.lead_followup', 'SOMETIMES', 'cap.crm_followup'),
]

const ORDER = new Map<string, number>(CAPABILITY_KEYS.map((key, index) => [key, index]))

/**
 * Answer-inferred capabilities (any answered question, scored or capability-only), plus — when a primary
 * pack is set — the capabilities the pack declares. Capabilities the caller marks blocked are excluded
 * here and reported separately. Output order = CAPABILITY_KEYS order.
 */
export function inferCapabilities(
  questions: readonly QuestionState[],
  primaryPack: SmartSetupPackKey | null,
  catalog: readonly IndustryPackDefinition[],
  blocked: ReadonlySet<string>,
): RecommendedCapability[] {
  const collected = new Map<CapabilityKey, { strength: 'STRONG' | 'WEAK'; sources: CapabilitySource[] }>()
  const add = (capability: CapabilityKey, strength: 'STRONG' | 'WEAK', source: CapabilitySource) => {
    const current = collected.get(capability)
    if (!current) collected.set(capability, { strength, sources: [source] })
    else {
      if (strength === 'STRONG') current.strength = 'STRONG'
      current.sources.push(source)
    }
  }
  for (const question of questions) {
    if (question.status !== 'ANSWERED') continue
    for (const option of question.selected) {
      for (const rule of CAPABILITY_RULES) if (rule.questionId === question.id && rule.option === option) add(rule.capability, rule.strength, { questionId: question.id, option })
    }
  }
  if (primaryPack) {
    const pack = catalog.find((entry) => entry.key === primaryPack && entry.status === 'published')
    for (const key of pack?.capabilities ?? []) if (ORDER.has(key)) add(key as CapabilityKey, 'STRONG', { questionId: 'PRIMARY_PACK', option: null })
  }
  return [...collected.entries()]
    .filter(([capability]) => !blocked.has(capability))
    .sort((a, b) => (ORDER.get(a[0]) ?? 99) - (ORDER.get(b[0]) ?? 99))
    .map(([capability, entry]) => ({ capability, strength: entry.strength, sources: entry.sources }))
}
