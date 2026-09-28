// Registries a recipe is validated against. Injected so tests can use fixtures; the default
// composes the real (static, pure) event, detector and action registries.

import { ACTION_CATALOG } from '../../actions/contracts/catalog'
import type { ActionContractV1 } from '../../actions/contracts/types'
import { DETECTORS, type DetectorContractV1 } from '../../detectors/contracts/registry'
import { DOMAIN_EVENTS, TIMELINE_ONLY_EVENTS, type EventContractV1 } from '../../events/contracts/registry'
import { planLimits, type FeatureId } from '../../plan-limits'
import { allSegments } from '../../segment-modules'
import type { BusinessType } from '@/lib/business-types'

export type RecipeRegistry = {
  events: readonly EventContractV1[]
  timelineOnlyEvents: readonly string[]
  detectors: readonly DetectorContractV1[]
  actions: readonly ActionContractV1[]
  businessTypes: readonly BusinessType[]
  features: readonly FeatureId[]
}

export function defaultRecipeRegistry(): RecipeRegistry {
  return {
    events: DOMAIN_EVENTS,
    timelineOnlyEvents: TIMELINE_ONLY_EVENTS,
    detectors: DETECTORS,
    actions: ACTION_CATALOG,
    businessTypes: [...allSegments],
    features: [...planLimits.premium.features],
  }
}

export function findAction(registry: RecipeRegistry, ref: string): ActionContractV1 | null {
  const at = ref.lastIndexOf('@')
  if (at <= 0) return null
  const key = ref.slice(0, at)
  const major = Number(ref.slice(at + 1))
  return registry.actions.find((action) => action.key === key && action.majorVersion === major) ?? null
}

export function triggerRef(trigger: { type: 'domain_event'; eventType: string } | { type: 'detector'; detectorKey: string; detectorVersion: number }): string {
  return trigger.type === 'domain_event' ? `event:${trigger.eventType}` : `detector:${trigger.detectorKey}@${trigger.detectorVersion}`
}
