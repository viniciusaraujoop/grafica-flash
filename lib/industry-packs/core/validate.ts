// Industry Pack Contract v1 — validatePack (invariants I1–I16). Pure; never throws.

import { stableStringify } from '../../wave1/shared/canonical'
import { isJsonValue, isNonEmptyString, isPlainRecord, isStringArray } from '../../wave1/shared/json'
import { fromIssues, issue, type Result, type ValidationIssue } from '../../wave1/shared/result'
import {
  CAPABILITY_KEYS,
  ISO_DATE,
  ITEM_ID,
  ITEM_REQUIREMENTS,
  PACK_ITEM_KINDS,
  PACK_KEY_SLUG,
  PACK_LIMITS,
  PACK_STATUSES,
  PROVIDER_KEY,
  REPORT_KEY,
  SETTING_VALIDATORS,
  STATUS_SCOPES,
  STATUS_SEMANTICS,
  TEMPLATE_KINDS,
  TEMPLATE_PLACEHOLDERS,
} from './constants'
import type { IndustryPackDefinition, PackItem, PackItemKind, PackRegistrySnapshot, SettingPath } from './types'
import {
  collectStrings,
  compareSemver,
  containsMarkup,
  containsRemoteReference,
  extractPlaceholders,
  parseSemver,
  utf8ByteLength,
} from './util'

const PLAN_IDS = ['basic', 'intermediate', 'premium']
const ROLES = ['gerente', 'atendente', 'producao']
const CAPABILITIES = new Set<string>(CAPABILITY_KEYS)

type Ctx = { issues: ValidationIssue[]; registry: PackRegistrySnapshot }

function push(ctx: Ctx, code: string, path: string, params?: Record<string, string | number>) {
  ctx.issues.push(issue(code, path, params))
}

function checkText(ctx: Ctx, value: unknown, path: string, max: number, code = 'PACK_FIELD_INVALID'): value is string {
  if (!isNonEmptyString(value) || value.length > max) {
    push(ctx, code, path, { max })
    return false
  }
  return true
}

function checkTemplateText(ctx: Ctx, text: string, path: string) {
  if (text.length > PACK_LIMITS.maxTemplateTextLength || containsMarkup(text)) {
    push(ctx, 'PACK_TEMPLATE_UNSAFE', path, { reason: containsMarkup(text) ? 'markup' : 'length' })
  }
  for (const placeholder of extractPlaceholders(text)) {
    if (!TEMPLATE_PLACEHOLDERS.includes(placeholder)) {
      push(ctx, 'PACK_TEMPLATE_UNSAFE', path, { reason: 'placeholder', placeholder })
    }
  }
}

function validateHeader(ctx: Ctx, input: Record<string, unknown>) {
  const { registry } = ctx
  if (input.schemaVersion !== 1) push(ctx, 'PACK_SCHEMA_VERSION', 'schemaVersion')

  // I1 key / businessType
  const businessType = input.businessType
  if (typeof businessType !== 'string' || !registry.businessTypes.includes(businessType as never)) {
    push(ctx, 'PACK_BUSINESS_TYPE_INVALID', 'businessType')
  }
  const key = input.key
  if (typeof key !== 'string') {
    push(ctx, 'PACK_KEY_INVALID', 'key')
  } else {
    const dot = key.indexOf('.')
    const prefix = dot > 0 ? key.slice(0, dot) : ''
    const slug = dot > 0 ? key.slice(dot + 1) : ''
    if (prefix !== businessType || !PACK_KEY_SLUG.test(slug)) push(ctx, 'PACK_KEY_INVALID', 'key')
  }

  if (typeof input.status !== 'string' || !PACK_STATUSES.includes(input.status as never)) {
    push(ctx, 'PACK_STATUS_INVALID', 'status')
  }

  checkText(ctx, input.name, 'name', PACK_LIMITS.maxNameLength)
  checkText(ctx, input.description, 'description', PACK_LIMITS.maxDescriptionLength)

  if (!isStringArray(input.subsegments) || input.subsegments.length > PACK_LIMITS.maxSubsegments) {
    push(ctx, 'PACK_FIELD_INVALID', 'subsegments')
  } else {
    input.subsegments.forEach((value, index) => checkText(ctx, value, `subsegments[${index}]`, PACK_LIMITS.maxSubsegmentLength))
    if (new Set(input.subsegments).size !== input.subsegments.length) push(ctx, 'PACK_FIELD_INVALID', 'subsegments', { reason: 'duplicate' })
  }

  if (!isStringArray(input.capabilities)) {
    push(ctx, 'PACK_FIELD_INVALID', 'capabilities')
  } else {
    input.capabilities.forEach((value, index) => {
      if (!CAPABILITIES.has(value)) push(ctx, 'PACK_CAPABILITY_UNKNOWN', `capabilities[${index}]`, { capability: value })
    })
    if (new Set(input.capabilities).size !== input.capabilities.length) push(ctx, 'PACK_FIELD_INVALID', 'capabilities', { reason: 'duplicate' })
  }

  // minimum requirements
  const minimum = input.minimumRequirements
  if (!isPlainRecord(minimum)) {
    push(ctx, 'PACK_FIELD_INVALID', 'minimumRequirements')
  } else {
    if (minimum.plan !== undefined && !PLAN_IDS.includes(String(minimum.plan))) push(ctx, 'PACK_FIELD_INVALID', 'minimumRequirements.plan')
    if (minimum.features !== undefined) {
      if (!isStringArray(minimum.features)) push(ctx, 'PACK_FIELD_INVALID', 'minimumRequirements.features')
      else minimum.features.forEach((feature, index) => {
        if (!registry.features.includes(feature as never)) push(ctx, 'PACK_FEATURE_UNKNOWN', `minimumRequirements.features[${index}]`, { feature })
      })
    }
    if (minimum.modules !== undefined) {
      if (!isStringArray(minimum.modules)) push(ctx, 'PACK_FIELD_INVALID', 'minimumRequirements.modules')
      else minimum.modules.forEach((moduleId, index) => {
        if (!registry.modules.some((module) => module.id === moduleId)) push(ctx, 'PACK_MODULE_UNKNOWN', `minimumRequirements.modules[${index}]`, { moduleId })
      })
    }
  }

  // legacy
  if (input.legacy !== undefined) {
    const legacy = input.legacy
    if (!isPlainRecord(legacy) || (legacy.nichoIds !== undefined && !isStringArray(legacy.nichoIds))) {
      push(ctx, 'PACK_FIELD_INVALID', 'legacy')
    } else if (Array.isArray(legacy.nichoIds)) {
      legacy.nichoIds.forEach((nichoId, index) => {
        if (!registry.legacyNichoIds.includes(nichoId)) push(ctx, 'PACK_LEGACY_UNKNOWN', `legacy.nichoIds[${index}]`, { nichoId })
      })
    }
  }
}

function validateVersion(ctx: Ctx, input: Record<string, unknown>) {
  // I2 version + changelog
  const version = input.version
  if (typeof version !== 'string' || !parseSemver(version)) {
    push(ctx, 'PACK_VERSION_INVALID', 'version')
    return
  }
  const changelog = input.changelog
  if (!Array.isArray(changelog) || changelog.length === 0) {
    push(ctx, 'PACK_VERSION_INVALID', 'changelog', { reason: 'empty' })
    return
  }
  changelog.forEach((entry, index) => {
    const path = `changelog[${index}]`
    if (!isPlainRecord(entry) || typeof entry.version !== 'string' || !parseSemver(entry.version)) {
      push(ctx, 'PACK_VERSION_INVALID', path)
      return
    }
    if (typeof entry.date !== 'string' || !ISO_DATE.test(entry.date)) push(ctx, 'PACK_VERSION_INVALID', `${path}.date`)
    if (!['major', 'minor', 'patch'].includes(String(entry.kind))) push(ctx, 'PACK_VERSION_INVALID', `${path}.kind`)
    if (!isNonEmptyString(entry.summary)) push(ctx, 'PACK_VERSION_INVALID', `${path}.summary`)
    if (!Array.isArray(entry.changes)) push(ctx, 'PACK_VERSION_INVALID', `${path}.changes`)
    if (index > 0) {
      const previous = changelog[index - 1]
      if (isPlainRecord(previous) && typeof previous.version === 'string' && compareSemver(previous.version, entry.version) <= 0) {
        push(ctx, 'PACK_VERSION_INVALID', path, { reason: 'changelog_not_descending' })
      }
    }
  })
  const head = changelog[0]
  if (!isPlainRecord(head) || head.version !== version) push(ctx, 'PACK_VERSION_INVALID', 'changelog[0]', { reason: 'head_mismatch' })
}

function validateItemShape(ctx: Ctx, item: Record<string, unknown>, path: string, businessType: string): boolean {
  const { registry } = ctx
  const kind = item.kind as PackItemKind
  if (!PACK_ITEM_KINDS.includes(kind)) {
    push(ctx, 'PACK_ITEM_KIND_INVALID', `${path}.kind`)
    return false
  }
  if (typeof item.id !== 'string' || !ITEM_ID.test(item.id)) push(ctx, 'PACK_ITEM_ID_INVALID', `${path}.id`)
  if (!ITEM_REQUIREMENTS.includes(item.requirement as never)) push(ctx, 'PACK_ITEM_REQUIREMENT_INVALID', `${path}.requirement`)
  const value = item.value
  if (!isPlainRecord(value)) {
    push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value`)
    return false
  }

  switch (kind) {
    case 'module': {
      const moduleEntry = registry.modules.find((entry) => entry.id === value.moduleId)
      if (!moduleEntry) push(ctx, 'PACK_MODULE_UNKNOWN', `${path}.value.moduleId`, { moduleId: String(value.moduleId) })
      else if (!moduleEntry.isGlobal && !moduleEntry.segments.includes(businessType as never)) {
        push(ctx, 'PACK_MODULE_SEGMENT_MISMATCH', `${path}.value.moduleId`, { moduleId: moduleEntry.id, businessType })
      }
      if (value.order !== undefined && !Number.isInteger(value.order)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.order`)
      break
    }
    case 'status': {
      if (!STATUS_SCOPES.includes(value.scope as never)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.scope`)
      if (typeof value.key !== 'string' || !ITEM_ID.test(value.key)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.key`)
      checkText(ctx, value.label, `${path}.value.label`, PACK_LIMITS.maxLabelLength, 'PACK_ITEM_VALUE_INVALID')
      if (!Number.isInteger(value.order) || Number(value.order) < 1) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.order`)
      if (value.terminal !== undefined && typeof value.terminal !== 'boolean') push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.terminal`)
      if (value.semantic !== undefined && !STATUS_SEMANTICS.includes(value.semantic as never)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.semantic`)
      break
    }
    case 'category':
      if (value.scope !== 'product' && value.scope !== 'finance') push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.scope`)
      checkText(ctx, value.label, `${path}.value.label`, PACK_LIMITS.maxLabelLength, 'PACK_ITEM_VALUE_INVALID')
      if (value.parentId !== undefined && typeof value.parentId !== 'string') push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.parentId`)
      break
    case 'dashboard':
      // I5
      if (typeof value.cardId !== 'string' || !ITEM_ID.test(value.cardId)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.cardId`)
      if (typeof value.metricKey !== 'string' || !registry.metricKeys.includes(value.metricKey)) {
        push(ctx, 'PACK_METRIC_UNKNOWN', `${path}.value.metricKey`, { metricKey: String(value.metricKey) })
      }
      if (!Number.isInteger(value.order)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.order`)
      break
    case 'report':
      // Report registry does not exist yet: shape only; classification reports UNAVAILABLE.
      if (typeof value.reportKey !== 'string' || !REPORT_KEY.test(value.reportKey)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.reportKey`)
      break
    case 'recipe': {
      // I6
      const recipe = registry.recipes.find((entry) => entry.ref === value.recipeRef)
      if (!recipe) push(ctx, 'PACK_RECIPE_UNKNOWN', `${path}.value.recipeRef`, { recipeRef: String(value.recipeRef) })
      else if (!recipe.internalOnly) push(ctx, 'PACK_RECIPE_BLOCKED', `${path}.value.recipeRef`, { recipeRef: recipe.ref })
      if (value.params !== undefined && (!isPlainRecord(value.params) || !isJsonValue(value.params))) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.params`)
      break
    }
    case 'integration':
      if (typeof value.provider !== 'string' || !PROVIDER_KEY.test(value.provider)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.provider`)
      if (!isStringArray(value.capabilities) || value.capabilities.length === 0) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.capabilities`)
      break
    case 'permission': {
      // I11
      const role = String(value.role)
      if (!ROLES.includes(role)) {
        push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.role`)
        break
      }
      if (!isStringArray(value.grants) || value.grants.length === 0) {
        push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.grants`)
        break
      }
      const allowed = registry.rolePermissions[role as keyof PackRegistrySnapshot['rolePermissions']] || []
      value.grants.forEach((grant, index) => {
        if (!registry.permissions.includes(grant as never)) push(ctx, 'PACK_PERMISSION_UNKNOWN', `${path}.value.grants[${index}]`, { permission: grant })
        else if (!allowed.includes(grant as never)) push(ctx, 'PACK_PERMISSION_ESCALATION', `${path}.value.grants[${index}]`, { role, permission: grant })
      })
      break
    }
    case 'template': {
      // I9
      if (!TEMPLATE_KINDS.includes(value.templateKind as never)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.templateKind`)
      if (typeof value.key !== 'string' || !ITEM_ID.test(value.key)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.key`)
      const content = value.content
      if (!isPlainRecord(content)) {
        push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.content`)
        break
      }
      if (content.format === 'plain') {
        if (!isNonEmptyString(content.text)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.content.text`)
        else checkTemplateText(ctx, content.text, `${path}.value.content.text`)
      } else if (content.format === 'proposal') {
        for (const field of ['titulo', 'introducao', 'condicoes', 'prazoPadrao']) {
          const text = content[field]
          if (!isNonEmptyString(text)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.content.${field}`)
          else checkTemplateText(ctx, text, `${path}.value.content.${field}`)
        }
        const hours = content.validadeHoras
        if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 24 * 90) {
          push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.content.validadeHoras`)
        }
      } else {
        push(ctx, 'PACK_TEMPLATE_UNSAFE', `${path}.value.content.format`, { reason: 'format' })
      }
      break
    }
    case 'onboarding':
      if (typeof value.stepKey !== 'string' || !ITEM_ID.test(value.stepKey)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.stepKey`)
      if (!Number.isInteger(value.order)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.order`)
      checkText(ctx, value.checklistLabel, `${path}.value.checklistLabel`, 120, 'PACK_ITEM_VALUE_INVALID')
      if (typeof value.completionSignal !== 'string' || !ITEM_ID.test(value.completionSignal)) push(ctx, 'PACK_ITEM_VALUE_INVALID', `${path}.value.completionSignal`)
      break
    case 'setting': {
      // I10
      const settingPath = String(value.path) as SettingPath
      const validator = SETTING_VALIDATORS[settingPath]
      if (!validator) push(ctx, 'PACK_SETTING_FORBIDDEN', `${path}.value.path`, { settingPath })
      else if (!validator(value.value)) push(ctx, 'PACK_SETTING_FORBIDDEN', `${path}.value.value`, { settingPath, reason: 'value' })
      break
    }
  }

  // I7 recipes and integrations are always opt-in
  if ((kind === 'recipe' || kind === 'integration') && (item.requirement === 'required' || item.requirement === 'default')) {
    push(ctx, 'PACK_OPT_IN_REQUIRED', `${path}.requirement`, { kind })
  }
  return true
}

function validatePreconditions(ctx: Ctx, index: Map<string, PackItem>, rawItems: unknown[]) {
  const { registry } = ctx
  const edges = new Map<string, string[]>()
  rawItems.forEach((raw, position) => {
    if (!isPlainRecord(raw)) return
    const path = `items[${position}]`
    const self = `${String(raw.kind)}:${String(raw.id)}`
    const requires = raw.requires
    if (requires === undefined) return
    if (!Array.isArray(requires)) {
      push(ctx, 'PACK_DEPENDENCY_INVALID', `${path}.requires`)
      return
    }
    requires.forEach((pre, preIndex) => {
      const prePath = `${path}.requires[${preIndex}]`
      if (!isPlainRecord(pre)) return push(ctx, 'PACK_DEPENDENCY_INVALID', prePath)
      switch (pre.type) {
        case 'feature':
          if (!registry.features.includes(pre.feature as never)) push(ctx, 'PACK_FEATURE_UNKNOWN', prePath, { feature: String(pre.feature) })
          break
        case 'permission':
          if (!registry.permissions.includes(pre.permission as never)) push(ctx, 'PACK_PERMISSION_UNKNOWN', prePath, { permission: String(pre.permission) })
          break
        case 'integration':
          if (typeof pre.provider !== 'string' || !PROVIDER_KEY.test(pre.provider)) push(ctx, 'PACK_DEPENDENCY_INVALID', prePath)
          break
        case 'module':
          if (!registry.modules.some((module) => module.id === pre.moduleId)) push(ctx, 'PACK_MODULE_UNKNOWN', prePath, { moduleId: String(pre.moduleId) })
          break
        case 'item': {
          const target = `${String(pre.kind)}:${String(pre.id)}`
          if (!index.has(target) || target === self) push(ctx, 'PACK_DEPENDENCY_INVALID', prePath, { target })
          else edges.set(self, [...(edges.get(self) || []), target])
          break
        }
        default:
          push(ctx, 'PACK_DEPENDENCY_INVALID', prePath)
      }
    })
  })

  // I12 acyclic
  const state = new Map<string, 1 | 2>()
  const visit = (node: string): boolean => {
    if (state.get(node) === 2) return false
    if (state.get(node) === 1) return true
    state.set(node, 1)
    for (const next of edges.get(node) || []) if (visit(next)) return true
    state.set(node, 2)
    return false
  }
  for (const node of [...edges.keys()].sort()) {
    if (visit(node)) {
      push(ctx, 'PACK_DEPENDENCY_INVALID', 'items', { reason: 'cycle', node })
      break
    }
  }
}

function validateStatusFlows(ctx: Ctx, items: PackItem[]) {
  // I8
  for (const scope of STATUS_SCOPES) {
    const statuses = items.filter((item) => item.kind === 'status' && item.value.scope === scope)
    if (!statuses.length) continue
    const orders = statuses.map((item) => (item.kind === 'status' ? item.value.order : 0)).sort((a, b) => a - b)
    const contiguous = orders.every((order, position) => order === position + 1)
    const keys = new Set(statuses.map((item) => (item.kind === 'status' ? item.value.key : '')))
    if (!contiguous || keys.size !== statuses.length) push(ctx, 'PACK_STATUS_FLOW_INVALID', 'items', { scope, reason: 'order_or_key' })
    if (scope === 'order') {
      const hasNew = statuses.some((item) => item.kind === 'status' && item.value.semantic === 'new')
      const hasTerminal = statuses.some((item) => item.kind === 'status' && item.value.terminal === true)
      if (!hasNew || !hasTerminal) push(ctx, 'PACK_STATUS_FLOW_INVALID', 'items', { scope, reason: 'new_or_terminal_missing' })
    }
  }
}

function validateDeprecations(ctx: Ctx, items: PackItem[], index: Map<string, PackItem>, version: string) {
  // I13
  items.forEach((item, position) => {
    const path = `items[${position}]`
    if (item.since !== undefined && (!parseSemver(item.since) || compareSemver(item.since, version) > 0)) {
      push(ctx, 'PACK_DEPRECATION_INVALID', `${path}.since`)
    }
    if (item.deprecatedSince !== undefined && (!parseSemver(item.deprecatedSince) || compareSemver(item.deprecatedSince, version) > 0)) {
      push(ctx, 'PACK_DEPRECATION_INVALID', `${path}.deprecatedSince`)
    }
    if (item.replacedBy !== undefined) {
      const target = index.get(`${item.kind}:${item.replacedBy}`)
      if (!target || item.replacedBy === item.id || item.deprecatedSince === undefined) push(ctx, 'PACK_DEPRECATION_INVALID', `${path}.replacedBy`)
    }
  })
}

/** Validates an untrusted pack definition against invariants I1–I16. Never throws. */
export function validatePack(pack: unknown, registry: PackRegistrySnapshot): Result<IndustryPackDefinition> {
  const ctx: Ctx = { issues: [], registry }
  if (!isPlainRecord(pack)) return fromIssues(pack as IndustryPackDefinition, [issue('PACK_NOT_OBJECT', '')])

  validateHeader(ctx, pack)
  validateVersion(ctx, pack)

  const rawItems = pack.items
  if (!Array.isArray(rawItems)) {
    push(ctx, 'PACK_FIELD_INVALID', 'items')
    return fromIssues(pack as IndustryPackDefinition, ctx.issues)
  }

  // I15 size
  if (rawItems.length > PACK_LIMITS.maxItems) push(ctx, 'PACK_TOO_LARGE', 'items', { max: PACK_LIMITS.maxItems })
  const serialized = stableStringify(pack)
  if (serialized === null) push(ctx, 'PACK_NOT_SERIALIZABLE', '')
  else if (utf8ByteLength(serialized) > PACK_LIMITS.maxSerializedBytes) push(ctx, 'PACK_TOO_LARGE', '', { maxBytes: PACK_LIMITS.maxSerializedBytes })

  const businessType = String(pack.businessType)
  const index = new Map<string, PackItem>()
  const items: PackItem[] = []
  rawItems.forEach((raw, position) => {
    const path = `items[${position}]`
    if (!isPlainRecord(raw)) return push(ctx, 'PACK_ITEM_VALUE_INVALID', path)
    if (!validateItemShape(ctx, raw, path, businessType)) return
    const identity = `${String(raw.kind)}:${String(raw.id)}`
    // I3
    if (index.has(identity)) push(ctx, 'PACK_ITEM_DUPLICATE', path, { identity })
    const item = raw as unknown as PackItem
    index.set(identity, item)
    items.push(item)
  })

  validatePreconditions(ctx, index, rawItems)
  validateStatusFlows(ctx, items)
  if (typeof pack.version === 'string' && parseSemver(pack.version)) validateDeprecations(ctx, items, index, pack.version)

  // I16 no remote references anywhere in the definition
  const strings = collectStrings({ name: pack.name, description: pack.description, subsegments: pack.subsegments, items: rawItems })
  const remote = strings.find(containsRemoteReference)
  if (remote !== undefined) push(ctx, 'PACK_REMOTE_REFERENCE', '', { sample: remote.slice(0, 60) })

  // I14 published completeness
  if (pack.status === 'published') {
    const hasRequiredModule = items.some((item) => item.kind === 'module' && item.requirement === 'required')
    const hasOrderStatus = items.some((item) => item.kind === 'status' && item.value.scope === 'order')
    const hasOnboarding = items.some((item) => item.kind === 'onboarding')
    if (!hasRequiredModule || !hasOrderStatus || !hasOnboarding) {
      push(ctx, 'PACK_INCOMPLETE', 'items', {
        requiredModule: hasRequiredModule ? 1 : 0,
        orderStatus: hasOrderStatus ? 1 : 0,
        onboarding: hasOnboarding ? 1 : 0,
      })
    }
  }

  return fromIssues(pack as unknown as IndustryPackDefinition, ctx.issues)
}
