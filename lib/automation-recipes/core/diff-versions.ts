// diffRecipeVersions — what changes between two versions of the same recipe. Pure.

import { stableStringify } from '../../wave1/shared/canonical'
import type { RecipeDefinition, RecipeRiskClass } from './types'

const RISK_ORDER: readonly RecipeRiskClass[] = ['LOW', 'MEDIUM', 'HIGH', 'BLOCKED']

export type RecipeVersionDiff = {
  key: string
  from: string
  to: string
  sameRecipe: boolean
  triggerChanged: boolean
  actionsChanged: boolean
  conditionsChanged: boolean
  params: { added: string[]; removed: string[]; changed: string[] }
  riskIncreased: boolean
  autoMigratable: boolean
}

export function diffRecipeVersions(from: RecipeDefinition, to: RecipeDefinition): RecipeVersionDiff {
  const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b)
  const fromParams = new Map(from.parameters.map((parameter) => [parameter.key, parameter]))
  const toParams = new Map(to.parameters.map((parameter) => [parameter.key, parameter]))
  const added = [...toParams.keys()].filter((key) => !fromParams.has(key)).sort()
  const removed = [...fromParams.keys()].filter((key) => !toParams.has(key)).sort()
  const changed = [...toParams.keys()].filter((key) => fromParams.has(key) && !same(fromParams.get(key), toParams.get(key))).sort()

  const triggerChanged = !same(from.trigger, to.trigger)
  const actionsChanged = !same(from.actions, to.actions)
  const conditionsChanged = !same(from.conditions, to.conditions)
  const riskIncreased = RISK_ORDER.indexOf(to.risk.effectiveClass) > RISK_ORDER.indexOf(from.risk.effectiveClass)
  const major = Number(to.version.split('.')[0]) !== Number(from.version.split('.')[0])
  const sameRecipe = from.key === to.key

  return {
    key: to.key,
    from: from.version,
    to: to.version,
    sameRecipe,
    triggerChanged,
    actionsChanged,
    conditionsChanged,
    params: { added, removed, changed },
    riskIncreased,
    autoMigratable: sameRecipe && !major && !riskIncreased && !triggerChanged && removed.length === 0 && changed.length === 0,
  }
}
