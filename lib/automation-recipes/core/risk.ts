// deriveRecipeRisk — risk is derived from action metadata, never trusted from the recipe. Pure.

import type { ActionContractV1, ActionImpact, ActionSensitivity } from '../../actions/contracts/types'
import type { RecipeDefinition, RecipeRisk, RecipeRiskClass } from './types'

const IMPACT_ORDER: readonly ActionImpact[] = ['READ', 'PREPARE', 'WRITE_LOW', 'WRITE_BUSINESS', 'DESTRUCTIVE']

/** Sensitivities that are never allowed for the automation actor in Wave 1. */
export const BLOCKED_SENSITIVITIES: readonly ActionSensitivity[] = [
  'EXTERNAL_COMMUNICATION',
  'FINANCIAL',
  'REGULATED',
  'CROSS_PRODUCT',
  'BULK',
  'IRREVERSIBLE',
]

export type DerivedRisk = RecipeRisk & { reasons: string[] }

export function deriveRecipeRisk(
  recipe: Pick<RecipeDefinition, 'actions'>,
  resolveAction: (ref: string) => ActionContractV1 | null,
): DerivedRisk {
  const reasons: string[] = []
  let maxImpact: ActionImpact = 'READ'
  const sensitivities = new Set<ActionSensitivity>()
  let blocked = false

  for (const requirement of recipe.actions) {
    const action = resolveAction(requirement.action)
    if (!action) {
      blocked = true
      reasons.push(`UNKNOWN_ACTION:${requirement.action}`)
      continue
    }
    if (IMPACT_ORDER.indexOf(action.impact) > IMPACT_ORDER.indexOf(maxImpact)) maxImpact = action.impact
    for (const sensitivity of action.sensitivity) sensitivities.add(sensitivity)
    if (!action.allowedActors.includes('automation')) {
      blocked = true
      reasons.push(`ACTOR_NOT_ALLOWED:${requirement.action}`)
    }
    if (action.reversibility === 'irreversible') {
      blocked = true
      reasons.push(`IRREVERSIBLE:${requirement.action}`)
    }
  }

  for (const sensitivity of sensitivities) {
    if (BLOCKED_SENSITIVITIES.includes(sensitivity)) {
      blocked = true
      reasons.push(`SENSITIVITY:${sensitivity}`)
    }
  }
  if (maxImpact === 'DESTRUCTIVE') {
    blocked = true
    reasons.push('IMPACT:DESTRUCTIVE')
  }

  let effectiveClass: RecipeRiskClass
  if (blocked) effectiveClass = 'BLOCKED'
  else if (maxImpact === 'WRITE_BUSINESS') effectiveClass = 'HIGH'
  else effectiveClass = 'LOW'

  return {
    maxImpact,
    sensitivities: [...sensitivities].sort(),
    actorType: 'automation',
    blastRadius: sensitivities.has('BULK') ? 'bulk' : 'single_subject',
    effectiveClass,
    reasons,
  }
}
