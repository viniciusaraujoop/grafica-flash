// Declarative condition language: allowlisted fields, no expressions, no code. Pure.

import type { JsonValue } from '../../wave1/shared/json'
import { issue, type ValidationIssue } from '../../wave1/shared/result'
import type { ConditionSpec, ParamRefOrLiteral, RecipeParams, SubjectSnapshot, SubjectType } from './types'

/** Allowlist derived from real production columns of each subject table. */
export const CONDITION_FIELDS: Readonly<Record<SubjectType, readonly string[]>> = {
  order: ['order.status', 'order.payment_status', 'order.prazo_entrega', 'order.prioridade', 'order.canal_origem'],
  proposal: ['proposal.status', 'proposal.valid_until'],
  lead: ['lead.etapa', 'lead.status', 'lead.origem', 'lead.proximo_contato_em'],
  task: ['task.status', 'task.prioridade', 'task.due_at'],
  product: ['product.estoque', 'product.ativo', 'product.categoria'],
}

export const CONDITION_LIMITS = { maxDepth: 3, maxLeaves: 10 } as const

const LEAF_OPS = new Set(['eq', 'neq', 'in', 'not_in', 'gte', 'lte', 'is_null', 'not_null'])

export function validateConditions(
  spec: unknown,
  subject: SubjectType,
  paramKeys: readonly string[],
  path = 'conditions',
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  let leaves = 0
  const allowed = CONDITION_FIELDS[subject] || []

  const walk = (node: unknown, nodePath: string, depth: number) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      issues.push(issue('RECIPE_CONDITION_INVALID', nodePath, { reason: 'shape' }))
      return
    }
    const record = node as Record<string, unknown>
    if (record.op === 'all' || record.op === 'any') {
      if (depth >= CONDITION_LIMITS.maxDepth) issues.push(issue('RECIPE_CONDITION_INVALID', nodePath, { reason: 'depth' }))
      if (!Array.isArray(record.of)) {
        issues.push(issue('RECIPE_CONDITION_INVALID', nodePath, { reason: 'of' }))
        return
      }
      record.of.forEach((child, index) => walk(child, `${nodePath}.of[${index}]`, depth + 1))
      return
    }
    if (typeof record.op !== 'string' || !LEAF_OPS.has(record.op)) {
      issues.push(issue('RECIPE_CONDITION_INVALID', nodePath, { reason: 'op' }))
      return
    }
    leaves += 1
    if (typeof record.field !== 'string' || !allowed.includes(record.field)) {
      issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.field`, { reason: 'field', field: String(record.field) }))
    }
    const needsValue = record.op !== 'is_null' && record.op !== 'not_null'
    const value = record.value as ParamRefOrLiteral | undefined
    if (!needsValue) {
      if (value !== undefined) issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.value`, { reason: 'unexpected_value' }))
      return
    }
    if (!value || typeof value !== 'object') {
      issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.value`, { reason: 'missing_value' }))
    } else if ('param' in value) {
      if (!paramKeys.includes(value.param)) issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.value`, { reason: 'unknown_param', param: value.param }))
    } else if (!('literal' in value)) {
      issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.value`, { reason: 'value_shape' }))
    } else if ((record.op === 'in' || record.op === 'not_in') !== Array.isArray(value.literal)) {
      issues.push(issue('RECIPE_CONDITION_INVALID', `${nodePath}.value`, { reason: 'list_operator_mismatch' }))
    }
  }

  walk(spec, path, 0)
  if (leaves > CONDITION_LIMITS.maxLeaves) issues.push(issue('RECIPE_CONDITION_INVALID', path, { reason: 'too_many_leaves' }))
  return issues
}

function resolveOperand(value: ParamRefOrLiteral | undefined, params: RecipeParams): JsonValue | undefined {
  if (!value) return undefined
  if ('param' in value) return params[value.param]
  return value.literal
}

function normalize(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}

/** Evaluates a validated condition tree. Missing fields are treated as null. */
export function evaluateConditions(spec: ConditionSpec, subject: SubjectSnapshot, params: RecipeParams): boolean {
  if (spec.op === 'all' || spec.op === 'any') {
    const group = spec as Extract<ConditionSpec, { of: ConditionSpec[] }>
    return group.op === 'all'
      ? group.of.every((child) => evaluateConditions(child, subject, params))
      : group.of.some((child) => evaluateConditions(child, subject, params))
  }

  const leaf = spec as Extract<ConditionSpec, { field: string }>
  const actual = Object.prototype.hasOwnProperty.call(subject, leaf.field) ? subject[leaf.field] : null
  const expected = resolveOperand(leaf.value, params)
  switch (leaf.op) {
    case 'is_null':
      return actual === null
    case 'not_null':
      return actual !== null
    case 'eq':
      return actual !== null && normalize(actual) === normalize(expected)
    case 'neq':
      return normalize(actual) !== normalize(expected)
    case 'in':
      return Array.isArray(expected) && actual !== null && expected.map(normalize).includes(normalize(actual))
    case 'not_in':
      return Array.isArray(expected) && !expected.map(normalize).includes(normalize(actual))
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
  }
}
