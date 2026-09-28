// validateRecipeParams — tenant-supplied instance params against a recipe definition. Pure.

import { isPlainRecord } from '../../wave1/shared/json'
import { fromIssues, issue, type Result, type ValidationIssue } from '../../wave1/shared/result'
import type { RecipeDefinition, RecipeParameter, RecipeParams } from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const PARAM_KEY = /^[a-z][a-z0-9_]{1,31}$/
export const MAX_PARAMETERS = 8

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function checkValue(parameter: RecipeParameter, value: unknown): boolean {
  switch (parameter.type) {
    case 'integer':
    case 'duration_days':
      return typeof value === 'number' && Number.isInteger(value) && value >= parameter.min && value <= parameter.max
    case 'enum':
      return typeof value === 'string' && parameter.options.includes(value)
    case 'status_set':
      return (
        Array.isArray(value) &&
        value.length <= 30 &&
        value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 60)
      )
    case 'member_ref':
      return value === null || isUuid(value)
    case 'boolean':
      return typeof value === 'boolean'
  }
}

/** Validates the parameter declarations themselves (used by validateRecipe). */
export function validateParameterDeclarations(parameters: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!Array.isArray(parameters)) return [issue('RECIPE_PARAMETER_INVALID', 'parameters')]
  if (parameters.length > MAX_PARAMETERS) issues.push(issue('RECIPE_PARAMETER_INVALID', 'parameters', { max: MAX_PARAMETERS }))
  const keys = new Set<string>()
  parameters.forEach((raw, index) => {
    const path = `parameters[${index}]`
    if (!isPlainRecord(raw) || typeof raw.key !== 'string' || !PARAM_KEY.test(raw.key)) {
      issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'key' }))
      return
    }
    if (keys.has(raw.key)) issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'duplicate' }))
    keys.add(raw.key)
    const parameter = raw as unknown as RecipeParameter
    if (!['integer', 'duration_days', 'enum', 'status_set', 'member_ref', 'boolean'].includes(parameter.type)) {
      issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'type' }))
      return
    }
    if (parameter.type === 'integer' || parameter.type === 'duration_days') {
      const bounds = Number.isInteger(parameter.min) && Number.isInteger(parameter.max) && parameter.min <= parameter.max
      const durationBounds = parameter.type !== 'duration_days' || (parameter.min >= 1 && parameter.max <= 90)
      if (!bounds || !durationBounds) issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'bounds' }))
    }
    if (parameter.type === 'enum' && (!Array.isArray(parameter.options) || parameter.options.length === 0)) {
      issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'options' }))
    }
    if (parameter.type === 'member_ref') {
      if (parameter.required !== false) issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'member_ref_optional' }))
    } else if (!checkValue(parameter, parameter.default)) {
      issues.push(issue('RECIPE_PARAMETER_INVALID', path, { reason: 'default' }))
    }
  })
  return issues
}

/** Applies defaults and validates tenant params. Unknown keys are rejected. */
export function validateRecipeParams(recipe: Pick<RecipeDefinition, 'parameters'>, input: unknown): Result<RecipeParams> {
  const issues: ValidationIssue[] = []
  const supplied = input === undefined || input === null ? {} : input
  if (!isPlainRecord(supplied)) return fromIssues({}, [issue('RECIPE_PARAMS_INVALID', '')])

  const declared = new Map(recipe.parameters.map((parameter) => [parameter.key, parameter]))
  for (const key of Object.keys(supplied).sort()) {
    if (!declared.has(key)) issues.push(issue('RECIPE_PARAM_UNKNOWN', key))
  }

  const params: RecipeParams = {}
  for (const parameter of recipe.parameters) {
    const has = Object.prototype.hasOwnProperty.call(supplied, parameter.key)
    const value = has ? supplied[parameter.key] : parameter.type === 'member_ref' ? null : parameter.default
    if (!checkValue(parameter, value)) {
      issues.push(issue('RECIPE_PARAM_OUT_OF_RANGE', parameter.key, { type: parameter.type }))
      continue
    }
    params[parameter.key] = Array.isArray(value) ? [...(value as string[])] : (value as RecipeParams[string])
  }
  return fromIssues(params, issues)
}
