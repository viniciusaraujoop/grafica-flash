// Automation Recipes — public surface of the pure core (Wave 1 T1). CATALOG + CONTRACTS ONLY.
// Runtime status: NOT_READY_FOR_RUNTIME.

import type { RecipeDefinition } from './core/types'
import { recipeCatalog } from './catalog/recipes'

export * from './core/types'
export { validateRecipe } from './core/validate'
export { validateRecipeParams } from './core/params'
export { deriveRecipeRisk, BLOCKED_SENSITIVITIES } from './core/risk'
export { evaluateRecipeDependencies, type DependencyEvaluation } from './core/dependencies'
export { evaluateConditions, validateConditions, CONDITION_FIELDS } from './core/conditions'
export { planRecipeRun, renderRunKey, actionIdempotencyKey, recipeRefOf } from './core/plan-run'
export { diffRecipeVersions, type RecipeVersionDiff } from './core/diff-versions'
export { defaultRecipeRegistry, findAction, triggerRef, type RecipeRegistry } from './core/registry'
export { recipeCatalog }

export const RECIPE_RUNTIME_STATUS = 'NOT_READY_FOR_RUNTIME' as const

/** Summary entries consumed by the Industry Pack registry snapshot (validation I6). */
export function recipeRegistryEntries(catalog: readonly RecipeDefinition[] = recipeCatalog) {
  return catalog.map((recipe) => ({
    ref: `${recipe.key}@${recipe.version}`,
    key: recipe.key,
    internalOnly: recipe.internalOnly,
    status: recipe.status,
  }))
}
