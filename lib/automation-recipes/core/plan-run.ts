// planRecipeRun — pure planning: evaluates a trigger occurrence against a recipe and produces the
// actions a FUTURE runtime would execute. Nothing is executed; runtimeAuthorized is always false.

import type { HashFn } from '../../wave1/shared/canonical'
import type { JsonValue } from '../../wave1/shared/json'
import { evaluateConditions } from './conditions'
import { evaluateRecipeDependencies } from './dependencies'
import { validateRecipeParams } from './params'
import type { RecipeRegistry } from './registry'
import { validateRecipe } from './validate'
import type {
  PlannedRun,
  RecipeDefinition,
  RecipeDependencyContext,
  SubjectSnapshot,
  TriggerOccurrence,
} from './types'

export function recipeRefOf(recipe: Pick<RecipeDefinition, 'key' | 'version'>): string {
  return `${recipe.key}@${recipe.version}`
}

/** Renders the dedupe template. Only the three allowlisted tokens are substituted. */
export function renderRunKey(template: string, trigger: TriggerOccurrence): string {
  const eventId = trigger.kind === 'domain_event' ? trigger.eventId : ''
  const windowKey = trigger.kind === 'detector' ? trigger.windowKey : ''
  return template
    .replaceAll('{{trigger.subjectId}}', trigger.subjectId)
    .replaceAll('{{trigger.eventId}}', eventId)
    .replaceAll('{{trigger.windowKey}}', windowKey)
}

/**
 * Idempotency key per planned action. Includes company and recipe identity (not only the run key)
 * so two recipes of the same company reacting to the same event can never collide.
 */
export function actionIdempotencyKey(hash: HashFn, input: { companyId: string; recipeKey: string; runKey: string; index: number; action: string }): string {
  return hash(`${input.companyId}|${input.recipeKey}|${input.runKey}|${input.index}|${input.action}`)
}

function triggerMatches(recipe: RecipeDefinition, trigger: TriggerOccurrence): boolean {
  if (recipe.trigger.type === 'domain_event') {
    return (
      trigger.kind === 'domain_event' &&
      trigger.eventType === recipe.trigger.eventType &&
      recipe.trigger.acceptedVersions.includes(trigger.eventVersion)
    )
  }
  return (
    trigger.kind === 'detector' &&
    trigger.detectorKey === recipe.trigger.detectorKey &&
    trigger.detectorVersion === recipe.trigger.detectorVersion
  )
}

export function planRecipeRun(input: {
  recipe: RecipeDefinition
  params: unknown
  trigger: TriggerOccurrence
  subject: SubjectSnapshot
  registry: RecipeRegistry
  hash: HashFn
  dependencyContext?: RecipeDependencyContext
}): PlannedRun {
  const { recipe, trigger, subject, registry, hash } = input
  const recipeRef = recipeRefOf(recipe)
  const plan = (outcome: PlannedRun['outcome'], runKey: string | null, explanation: PlannedRun['explanation'], actions: PlannedRun['actions'] = []): PlannedRun => ({
    recipeRef,
    runKey,
    outcome,
    actions,
    explanation,
    runtimeAuthorized: false,
  })

  const validation = validateRecipe(recipe, registry)
  if (!validation.ok) return plan('INVALID_RECIPE', null, validation.errors.map((error) => ({ code: error.code, params: { path: error.path } })))

  if (recipe.risk.effectiveClass === 'BLOCKED') return plan('BLOCKED_BY_RISK', null, [{ code: 'RISK_BLOCKED', params: {} }])

  if (!triggerMatches(recipe, trigger)) return plan('TRIGGER_MISMATCH', null, [{ code: 'TRIGGER_MISMATCH', params: {} }])

  const runKey = renderRunKey(recipe.dedupe.runKeyTemplate, trigger)

  const params = validateRecipeParams(recipe, input.params)
  if (!params.ok) return plan('INVALID_PARAMS', runKey, params.errors.map((error) => ({ code: error.code, params: { path: error.path } })))

  if (input.dependencyContext) {
    const missing = evaluateRecipeDependencies(recipe, input.dependencyContext, registry).filter(
      (entry) => entry.status === 'MISSING' || entry.status === 'UNKNOWN',
    )
    if (missing.length) {
      return plan(
        'BLOCKED_BY_DEPENDENCY',
        runKey,
        missing.map((entry) => ({ code: entry.reason, params: { type: entry.dependency.type } })),
      )
    }
  }

  if (!evaluateConditions(recipe.conditions, subject, params.value)) {
    return plan('CONDITIONS_NOT_MET', runKey, [{ code: 'CONDITIONS_NOT_MET', params: {} }])
  }

  const actions = recipe.actions.map((requirement, index) => {
    const resolved: Record<string, JsonValue> = {}
    for (const [field, mapping] of Object.entries(requirement.input).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if ('trigger' in mapping) resolved[field] = trigger.subjectId
      else if ('param' in mapping) resolved[field] = params.value[mapping.param] ?? null
      else resolved[field] = Array.isArray(mapping.literal) ? [...mapping.literal] : mapping.literal
    }
    return {
      action: requirement.action,
      input: resolved,
      idempotencyKey: actionIdempotencyKey(hash, {
        companyId: trigger.companyId,
        recipeKey: recipe.key,
        runKey,
        index,
        action: requirement.action,
      }),
    }
  })

  return plan('WOULD_RUN', runKey, [{ code: 'PLANNED_ONLY_NO_RUNTIME', params: { actions: actions.length } }], actions)
}
