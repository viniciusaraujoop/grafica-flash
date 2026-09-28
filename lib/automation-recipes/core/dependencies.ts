// evaluateRecipeDependencies — pure evaluation against an injected context snapshot.

import { findAction, type RecipeRegistry } from './registry'
import type { DependencyStatus, RecipeDefinition, RecipeDependency, RecipeDependencyContext } from './types'

export type DependencyEvaluation = { dependency: RecipeDependency; status: DependencyStatus; reason: string }

function evaluateTrigger(ref: string, registry: RecipeRegistry): { status: DependencyStatus; reason: string } {
  if (ref.startsWith('event:')) {
    const eventType = ref.slice('event:'.length)
    return registry.events.some((event) => event.eventType === eventType && event.status === 'EXISTING')
      ? { status: 'SATISFIED', reason: 'EVENT_EXISTING_NO_CONSUMER_RUNTIME' }
      : { status: 'MISSING', reason: 'EVENT_NOT_REGISTERED' }
  }
  if (ref.startsWith('detector:')) {
    const [key, version] = ref.slice('detector:'.length).split('@')
    const detector = registry.detectors.find((candidate) => candidate.key === key && candidate.version === Number(version))
    if (!detector) return { status: 'MISSING', reason: 'DETECTOR_NOT_REGISTERED' }
    return detector.status === 'EXISTING'
      ? { status: 'SATISFIED', reason: 'DETECTOR_EXISTING_NOT_SCHEDULED' }
      : { status: 'MISSING', reason: 'DETECTOR_PLANNED' }
  }
  return { status: 'UNKNOWN', reason: 'TRIGGER_REF_UNRECOGNIZED' }
}

export function evaluateRecipeDependencies(
  recipe: Pick<RecipeDefinition, 'dependencies'>,
  context: RecipeDependencyContext,
  registry: RecipeRegistry,
): DependencyEvaluation[] {
  return recipe.dependencies.map((dependency) => {
    switch (dependency.type) {
      case 'trigger_available':
        return { dependency, ...evaluateTrigger(dependency.ref, registry) }
      case 'action_available':
        // Metadata exists, but no executor exists yet: never SATISFIED in Wave 1 T1.
        return findAction(registry, dependency.action)
          ? { dependency, status: 'DEGRADED', reason: 'ACTION_METADATA_ONLY_NO_EXECUTOR' }
          : { dependency, status: 'MISSING', reason: 'ACTION_NOT_REGISTERED' }
      case 'feature':
        return context.entitledFeatures.includes(dependency.feature)
          ? { dependency, status: 'SATISFIED', reason: 'FEATURE_ENTITLED' }
          : { dependency, status: 'MISSING', reason: 'FEATURE_NOT_ENTITLED' }
      case 'module':
        return context.enabledModules.includes(dependency.moduleId)
          ? { dependency, status: 'SATISFIED', reason: 'MODULE_ENABLED' }
          : { dependency, status: 'MISSING', reason: 'MODULE_NOT_ENABLED' }
      case 'integration': {
        const connection = context.connectedIntegrations.find((entry) => entry.provider === dependency.provider)
        return connection && connection.capabilities.includes(dependency.capability)
          ? { dependency, status: 'SATISFIED', reason: 'INTEGRATION_CONNECTED' }
          : { dependency, status: 'MISSING', reason: 'INTEGRATION_NOT_CONNECTED' }
      }
      case 'data_quality': {
        const value = context.dataQuality[dependency.check]
        return value === undefined
          ? { dependency, status: 'UNKNOWN', reason: 'DATA_QUALITY_NOT_MEASURED' }
          : { dependency, status: value ? 'SATISFIED' : 'MISSING', reason: value ? 'DATA_QUALITY_OK' : 'DATA_QUALITY_FAILED' }
      }
      case 'communication_consent':
        return { dependency, status: 'MISSING', reason: 'COMMUNICATION_PREFERENCES_NOT_IMPLEMENTED' }
    }
  })
}
