// validateRecipe — Recipe Contract v1 invariants (R1–R16). Pure; never throws.

import type { ActionContractV1, ActionInputField } from '../../actions/contracts/types'
import { isNonEmptyString, isPlainRecord, isStringArray } from '../../wave1/shared/json'
import { fromIssues, issue, type Result, type ValidationIssue } from '../../wave1/shared/result'
import { validateConditions } from './conditions'
import { validateParameterDeclarations } from './params'
import { findAction, triggerRef, type RecipeRegistry } from './registry'
import { deriveRecipeRisk } from './risk'
import {
  T1_ALLOWED_RECIPE_STATUSES,
  type ActionInputMapping,
  type RecipeDefinition,
  type RecipeParameter,
  type SubjectType,
} from './types'

const RECIPE_KEY = /^[a-z][a-z0-9_]{2,63}$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RUN_KEY_TOKENS = new Set(['{{trigger.subjectId}}', '{{trigger.windowKey}}', '{{trigger.eventId}}'])
const SUBJECTS: readonly SubjectType[] = ['order', 'proposal', 'lead', 'task', 'product']
const CATEGORIES = ['operations', 'sales', 'inventory', 'customer', 'finance']
const TENANT_REFERENCE_FOR_SUBJECT: Partial<Record<SubjectType, string>> = {
  order: 'orders',
  proposal: 'proposals',
  lead: 'crm_leads',
}

function unsafeText(value: string): boolean {
  return /<\s*\/?\s*[a-z!?][^>]*>/i.test(value) || /(^|[\s("'])(?:https?:|javascript:|data:|file:|\/\/|www\.)/i.test(value)
}

function checkMapping(
  mapping: ActionInputMapping,
  field: ActionInputField,
  parameters: Map<string, RecipeParameter>,
  subject: SubjectType,
  path: string,
): ValidationIssue[] {
  const bad = (reason: string) => [issue('RECIPE_ACTION_INPUT_INVALID', path, { reason })]
  if (!isPlainRecord(mapping)) return bad('shape')

  if ('trigger' in mapping) {
    if (mapping.trigger === 'subjectId') {
      if (field.type !== 'uuid') return bad('subject_id_needs_uuid_field')
      if (field.tenantReference !== TENANT_REFERENCE_FOR_SUBJECT[subject]) return bad('subject_reference_mismatch')
      return []
    }
    return bad('trigger_field_not_mappable')
  }

  if ('param' in mapping) {
    const parameter = parameters.get(mapping.param)
    if (!parameter) return bad('unknown_param')
    switch (field.type) {
      case 'enum':
        return parameter.type === 'enum' && parameter.options.every((option) => field.options.includes(option)) ? [] : bad('param_type')
      case 'integer':
        return (parameter.type === 'integer' || parameter.type === 'duration_days') &&
          parameter.min >= field.min &&
          parameter.max <= field.max
          ? []
          : bad('param_type')
      case 'uuid':
        return parameter.type === 'member_ref' && field.tenantReference === 'company_members' ? [] : bad('param_type')
      case 'string':
        return bad('string_from_param_not_allowed')
    }
  }

  if ('literal' in mapping) {
    const literal = mapping.literal
    switch (field.type) {
      case 'string':
        if (typeof literal !== 'string' || literal.length === 0 || literal.length > field.maxLength) return bad('literal_string')
        if (unsafeText(literal)) return [issue('RECIPE_TEMPLATE_UNSAFE', path)]
        if (field.pattern && !new RegExp(field.pattern).test(literal)) return bad('literal_pattern')
        return []
      case 'enum':
        return typeof literal === 'string' && field.options.includes(literal) ? [] : bad('literal_enum')
      case 'integer':
        return typeof literal === 'number' && Number.isInteger(literal) && literal >= field.min && literal <= field.max ? [] : bad('literal_integer')
      case 'uuid':
        return bad('literal_uuid_not_allowed')
    }
  }
  return bad('shape')
}

function validateActions(recipe: Record<string, unknown>, registry: RecipeRegistry, subject: SubjectType | null): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const actions = recipe.actions
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 5) {
    return [issue('RECIPE_ACTION_INVALID', 'actions', { reason: 'count' })]
  }
  const parameters = new Map(
    (Array.isArray(recipe.parameters) ? (recipe.parameters as RecipeParameter[]) : [])
      .filter((parameter) => isPlainRecord(parameter))
      .map((parameter) => [parameter.key, parameter]),
  )
  actions.forEach((raw, index) => {
    const path = `actions[${index}]`
    if (!isPlainRecord(raw) || typeof raw.action !== 'string') {
      issues.push(issue('RECIPE_ACTION_INVALID', path))
      return
    }
    const action: ActionContractV1 | null = findAction(registry, raw.action)
    // R3
    if (!action) {
      issues.push(issue('RECIPE_ACTION_UNKNOWN', `${path}.action`, { action: raw.action }))
      return
    }
    if (!action.allowedActors.includes('automation')) issues.push(issue('RECIPE_ACTOR_FORBIDDEN', `${path}.action`, { action: raw.action }))
    if (raw.onFailure !== 'stop' && raw.onFailure !== 'continue') issues.push(issue('RECIPE_ACTION_INVALID', `${path}.onFailure`))
    // R7
    const input = raw.input
    if (!isPlainRecord(input)) {
      issues.push(issue('RECIPE_ACTION_INPUT_INVALID', `${path}.input`))
      return
    }
    for (const key of Object.keys(input).sort()) {
      const field = action.input[key]
      if (!field) {
        issues.push(issue('RECIPE_ACTION_INPUT_INVALID', `${path}.input.${key}`, { reason: 'unknown_field' }))
        continue
      }
      if (subject) issues.push(...checkMapping(input[key] as ActionInputMapping, field, parameters, subject, `${path}.input.${key}`))
    }
    for (const [key, field] of Object.entries(action.input)) {
      if (field.required && !Object.prototype.hasOwnProperty.call(input, key)) {
        issues.push(issue('RECIPE_ACTION_INPUT_INVALID', `${path}.input.${key}`, { reason: 'required_missing' }))
      }
    }
  })
  return issues
}

/** Validates a recipe definition (untrusted input) against the injected registries. */
export function validateRecipe(input: unknown, registry: RecipeRegistry): Result<RecipeDefinition> {
  const issues: ValidationIssue[] = []
  if (!isPlainRecord(input)) return fromIssues(input as RecipeDefinition, [issue('RECIPE_NOT_OBJECT', '')])
  const recipe = input

  // R1 identity + changelog
  if (recipe.schemaVersion !== 1) issues.push(issue('RECIPE_SCHEMA_VERSION', 'schemaVersion'))
  if (typeof recipe.key !== 'string' || !RECIPE_KEY.test(recipe.key)) issues.push(issue('RECIPE_ID_INVALID', 'key'))
  if (typeof recipe.version !== 'string' || !SEMVER.test(recipe.version)) issues.push(issue('RECIPE_ID_INVALID', 'version'))
  const changelog = recipe.changelog
  if (
    !Array.isArray(changelog) ||
    changelog.length === 0 ||
    !isPlainRecord(changelog[0]) ||
    changelog[0].version !== recipe.version ||
    !changelog.every((entry) => isPlainRecord(entry) && typeof entry.date === 'string' && ISO_DATE.test(entry.date) && isNonEmptyString(entry.summary))
  ) {
    issues.push(issue('RECIPE_ID_INVALID', 'changelog'))
  }
  if (!isNonEmptyString(recipe.name) || recipe.name.length > 80 || unsafeText(recipe.name)) issues.push(issue('RECIPE_FIELD_INVALID', 'name'))
  if (!isNonEmptyString(recipe.description) || recipe.description.length > 280 || unsafeText(recipe.description)) issues.push(issue('RECIPE_FIELD_INVALID', 'description'))
  if (!CATEGORIES.includes(String(recipe.category))) issues.push(issue('RECIPE_FIELD_INVALID', 'category'))

  // R12 status allowed in T1 (never published)
  if (!T1_ALLOWED_RECIPE_STATUSES.includes(recipe.status as never)) {
    issues.push(issue('RECIPE_STATUS_NOT_ALLOWED', 'status', { status: String(recipe.status) }))
  }

  // R13 business types
  if (recipe.businessTypes !== 'all') {
    if (!isStringArray(recipe.businessTypes) || recipe.businessTypes.length === 0) issues.push(issue('RECIPE_FIELD_INVALID', 'businessTypes'))
    else recipe.businessTypes.forEach((value, index) => {
      if (!registry.businessTypes.includes(value as never)) issues.push(issue('RECIPE_FIELD_INVALID', `businessTypes[${index}]`, { businessType: value }))
    })
  }

  // R2 trigger
  const trigger = recipe.trigger
  let subject: SubjectType | null = null
  let triggerIsPlanned = false
  if (!isPlainRecord(trigger)) {
    issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger'))
  } else {
    if (SUBJECTS.includes(trigger.subject as SubjectType)) subject = trigger.subject as SubjectType
    else issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.subject'))
    if (trigger.type === 'domain_event') {
      const eventType = String(trigger.eventType)
      const versions = Array.isArray(trigger.acceptedVersions) ? trigger.acceptedVersions : []
      if (registry.timelineOnlyEvents.includes(eventType)) {
        issues.push(issue('RECIPE_TRIGGER_TIMELINE_ONLY', 'trigger.eventType', { eventType }))
      } else if (!versions.length || !versions.every((version) => registry.events.some((event) => event.eventType === eventType && event.version === version))) {
        issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.eventType', { eventType }))
      } else {
        const event = registry.events.find((candidate) => candidate.eventType === eventType)
        if (event && event.aggregateType !== trigger.subject) issues.push(issue('RECIPE_TRIGGER_SUBJECT_MISMATCH', 'trigger.subject'))
      }
    } else if (trigger.type === 'detector') {
      const detector = registry.detectors.find((candidate) => candidate.key === trigger.detectorKey && candidate.version === trigger.detectorVersion)
      if (!detector) issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.detectorKey', { detectorKey: String(trigger.detectorKey) }))
      else {
        triggerIsPlanned = detector.status === 'PLANNED'
        if (detector.subject !== trigger.subject) issues.push(issue('RECIPE_TRIGGER_SUBJECT_MISMATCH', 'trigger.subject'))
      }
      if (!['PT15M', 'PT1H', 'P1D'].includes(String(trigger.cadence))) issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.cadence'))
      if (!['day', 'status', 'none'].includes(String(trigger.windowKey))) issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.windowKey'))
    } else {
      issues.push(issue('RECIPE_TRIGGER_UNKNOWN', 'trigger.type'))
    }
  }
  // A PLANNED detector can never sustain a runtime_candidate.
  if (triggerIsPlanned && recipe.status === 'runtime_candidate') {
    issues.push(issue('RECIPE_TRIGGER_PLANNED', 'status', { reason: 'planned_detector_cannot_be_runtime_candidate' }))
  }

  // R16 parameters
  issues.push(...validateParameterDeclarations(recipe.parameters))
  const paramKeys = Array.isArray(recipe.parameters)
    ? (recipe.parameters as unknown[]).filter(isPlainRecord).map((parameter) => String(parameter.key))
    : []

  // R6 conditions
  if (subject) issues.push(...validateConditions(recipe.conditions, subject, paramKeys))

  // R3 / R7 actions
  issues.push(...validateActions(recipe, registry, subject))

  // R4 / R5 risk (derived, never trusted)
  const actions = Array.isArray(recipe.actions) ? (recipe.actions as RecipeDefinition['actions']).filter(isPlainRecord) : []
  const derived = deriveRecipeRisk({ actions }, (ref) => findAction(registry, ref))
  if (derived.effectiveClass === 'BLOCKED') {
    issues.push(issue('RECIPE_RISK_BLOCKED', 'actions', { reasons: derived.reasons.join(',') }))
  }
  if (derived.sensitivities.includes('EXTERNAL_COMMUNICATION') || recipe.internalOnly !== true) {
    // Wave 1 T1: every recipe must be internal-only.
    issues.push(issue('RECIPE_EXTERNAL_FORBIDDEN', 'internalOnly'))
  }
  const declaredRisk = recipe.risk
  if (
    !isPlainRecord(declaredRisk) ||
    declaredRisk.effectiveClass !== derived.effectiveClass ||
    declaredRisk.maxImpact !== derived.maxImpact ||
    declaredRisk.actorType !== 'automation' ||
    declaredRisk.blastRadius !== derived.blastRadius ||
    !isStringArray(declaredRisk.sensitivities) ||
    [...declaredRisk.sensitivities].sort().join(',') !== derived.sensitivities.join(',')
  ) {
    issues.push(issue('RECIPE_RISK_MISMATCH', 'risk', { derived: derived.effectiveClass }))
  }

  // R15 confirmation
  const confirmation = recipe.confirmation
  if (
    !isPlainRecord(confirmation) ||
    confirmation.activation !== 'explicit_user_activation' ||
    confirmation.activationRequires !== 'automations.manage' ||
    !['none', 'preapproved_at_activation', 'human_each_run'].includes(String(confirmation.perRun)) ||
    (derived.effectiveClass === 'HIGH' && confirmation.perRun !== 'human_each_run')
  ) {
    issues.push(issue('RECIPE_CONFIRMATION_INVALID', 'confirmation'))
  }

  // R8 dedupe
  const dedupe = recipe.dedupe
  if (!isPlainRecord(dedupe) || typeof dedupe.runKeyTemplate !== 'string' || dedupe.runKeyTemplate.length === 0) {
    issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe'))
  } else {
    const template = dedupe.runKeyTemplate
    const tokens: string[] = template.match(/\{\{[^}]*\}\}/g) ?? []
    const literalPart = template.replace(/\{\{[^}]*\}\}/g, '')
    if (!tokens.length || tokens.some((token) => !RUN_KEY_TOKENS.has(token)) || !/^[:|_-]*$/.test(literalPart)) {
      issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe.runKeyTemplate', { reason: 'tokens' }))
    }
    if (isPlainRecord(trigger) && trigger.type === 'domain_event' && !tokens.includes('{{trigger.eventId}}')) {
      issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe.runKeyTemplate', { reason: 'event_identity_required' }))
    }
    if (isPlainRecord(trigger) && trigger.type === 'detector') {
      if (!tokens.includes('{{trigger.subjectId}}')) issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe.runKeyTemplate', { reason: 'subject_required' }))
      if (trigger.windowKey !== 'none' && !tokens.includes('{{trigger.windowKey}}')) {
        issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe.runKeyTemplate', { reason: 'window_required' }))
      }
      if (tokens.includes('{{trigger.eventId}}')) issues.push(issue('RECIPE_DEDUPE_INVALID', 'dedupe.runKeyTemplate', { reason: 'detector_has_no_event_id' }))
    }
  }

  // R9 / R14 dependencies
  const dependencies = Array.isArray(recipe.dependencies) ? (recipe.dependencies as unknown[]).filter(isPlainRecord) : []
  if (!Array.isArray(recipe.dependencies)) issues.push(issue('RECIPE_DEPENDENCY_INVALID', 'dependencies'))
  if (!dependencies.some((dependency) => dependency.type === 'feature' && dependency.feature === 'automacoes')) {
    issues.push(issue('RECIPE_ENTITLEMENT_MISSING', 'dependencies', { feature: 'automacoes' }))
  }
  for (const dependency of dependencies) {
    if (dependency.type === 'feature' && !registry.features.includes(dependency.feature as never)) {
      issues.push(issue('RECIPE_DEPENDENCY_INVALID', 'dependencies', { feature: String(dependency.feature) }))
    }
    if (dependency.type === 'communication_consent' || dependency.type === 'integration') {
      issues.push(issue('RECIPE_EXTERNAL_FORBIDDEN', 'dependencies', { type: String(dependency.type) }))
    }
  }
  if (isPlainRecord(trigger) && (trigger.type === 'domain_event' || trigger.type === 'detector')) {
    const expected = triggerRef(trigger as never)
    if (!dependencies.some((dependency) => dependency.type === 'trigger_available' && dependency.ref === expected)) {
      issues.push(issue('RECIPE_DEPENDENCY_INVALID', 'dependencies', { missing: expected }))
    }
  }
  for (const action of actions) {
    if (!dependencies.some((dependency) => dependency.type === 'action_available' && dependency.action === action.action)) {
      issues.push(issue('RECIPE_DEPENDENCY_INVALID', 'dependencies', { missing: `action:${action.action}` }))
    }
  }

  // R10 limits
  const limits = recipe.limits
  if (
    !isPlainRecord(limits) ||
    !Number.isInteger(limits.maxRunsPerHourPerCompany) ||
    Number(limits.maxRunsPerHourPerCompany) < 1 ||
    Number(limits.maxRunsPerHourPerCompany) > 60 ||
    !Number.isInteger(limits.maxActionsPerRun) ||
    Number(limits.maxActionsPerRun) < 1 ||
    Number(limits.maxActionsPerRun) > 5 ||
    Number(limits.maxActionsPerRun) < actions.length
  ) {
    issues.push(issue('RECIPE_LIMITS_INVALID', 'limits'))
  }

  return fromIssues(recipe as unknown as RecipeDefinition, issues)
}
