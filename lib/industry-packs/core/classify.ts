// Industry Pack Contract v1 — classifyPackItem. Pure and total.
//
// Deterministic precedence (first match wins):
// 1 DEPRECATED_SETTING  item deprecated and the company already has it
// 2 UNAVAILABLE         reference missing/disabled in the platform (module hidden/coming_soon, recipe/report not available)
// 3 ENTITLEMENT_BLOCKED feature precondition not entitled
// 4 INTEGRATION_UNAVAILABLE provider unavailable in the platform or not connected
// 5 SAFE_ADDITION       company does not have the item
// 6 SAME_VALUE          equivalent value
// 7 USER_OVERRIDE       tenant changed it after the applied pack
// 8 CONFLICT            otherwise

import { stableStringify } from '../../wave1/shared/canonical'
import type { JsonValue } from '../../wave1/shared/json'
import type {
  ClassificationReason,
  CompanyConfigurationSnapshot,
  IndustryPackDefinition,
  PackItem,
  PackItemClassification,
  PackRegistrySnapshot,
} from './types'
import { normalizeKey, normalizeText } from './util'

type Presence =
  | { present: false; proposed: JsonValue }
  | { present: true; equal: boolean; current: JsonValue; proposed: JsonValue; inUse: number }

const CONNECTED = new Set(['CONNECTED', 'DEGRADED'])

function reason(code: string, params: Record<string, string | number> = {}): ClassificationReason {
  return { code, params }
}

function sameJson(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function presence(item: PackItem, company: CompanyConfigurationSnapshot): Presence {
  switch (item.kind) {
    case 'module': {
      const present = company.enabledModules.includes(item.value.moduleId)
      return present
        ? { present, equal: true, current: item.value.moduleId, proposed: item.value.moduleId, inUse: 0 }
        : { present, proposed: item.value.moduleId }
    }
    case 'status': {
      const list = company.statuses[item.value.scope] || []
      const index = list.findIndex((entry) => normalizeKey(entry.key) === normalizeKey(item.value.key))
      const proposed = { label: item.value.label, order: item.value.order }
      if (index < 0) return { present: false, proposed }
      const entry = list[index]
      const equal = normalizeText(entry.label) === normalizeText(item.value.label) && index + 1 === item.value.order
      return { present: true, equal, current: { label: entry.label, order: index + 1 }, proposed, inUse: entry.inUseCount }
    }
    case 'category': {
      const entry = company.categories.find(
        (candidate) => candidate.scope === item.value.scope && normalizeKey(candidate.label) === normalizeKey(item.value.label),
      )
      return entry
        ? { present: true, equal: true, current: entry.label, proposed: item.value.label, inUse: entry.inUseCount }
        : { present: false, proposed: item.value.label }
    }
    case 'dashboard': {
      const present = company.dashboardCards.includes(item.value.cardId)
      return present
        ? { present, equal: true, current: item.value.cardId, proposed: item.value.cardId, inUse: 0 }
        : { present, proposed: item.value.cardId }
    }
    case 'report': {
      const present = company.enabledReports.includes(item.value.reportKey)
      return present
        ? { present, equal: true, current: item.value.reportKey, proposed: item.value.reportKey, inUse: 0 }
        : { present, proposed: item.value.reportKey }
    }
    case 'recipe': {
      const key = item.value.recipeRef.split('@')[0]
      const current = company.activeRecipes.find((ref) => ref.split('@')[0] === key)
      return current
        ? { present: true, equal: current === item.value.recipeRef, current, proposed: item.value.recipeRef, inUse: 0 }
        : { present: false, proposed: item.value.recipeRef }
    }
    case 'integration': {
      const connection = company.integrations.find(
        (entry) => entry.provider === item.value.provider && CONNECTED.has(entry.status),
      )
      const proposed = [...item.value.capabilities].sort()
      if (!connection) return { present: false, proposed }
      const equal = item.value.capabilities.every((capability) => connection.capabilities.includes(capability))
      return { present: true, equal, current: [...connection.capabilities].sort(), proposed, inUse: 0 }
    }
    case 'permission': {
      const current = company.rolePermissionProfiles[item.value.role]
      const proposed = [...item.value.grants].sort()
      if (!current) return { present: false, proposed }
      const equal = item.value.grants.every((grant) => current.includes(grant))
      return { present: true, equal, current: [...current].sort(), proposed, inUse: 0 }
    }
    case 'template': {
      const entry = company.templates.find(
        (candidate) => candidate.templateKind === item.value.templateKind && candidate.key === item.value.key,
      )
      const proposed = item.value.content as unknown as JsonValue
      if (!entry) return { present: false, proposed }
      const current = entry.content as unknown as JsonValue
      return { present: true, equal: sameJson(current, proposed), current, proposed, inUse: 0 }
    }
    case 'onboarding': {
      const present = company.onboardingSteps.includes(item.value.stepKey)
      return present
        ? { present, equal: true, current: item.value.stepKey, proposed: item.value.stepKey, inUse: 0 }
        : { present, proposed: item.value.stepKey }
    }
    case 'setting': {
      const current = company.settings[item.value.path]
      if (current === undefined) return { present: false, proposed: item.value.value }
      return { present: true, equal: sameJson(current, item.value.value), current, proposed: item.value.value, inUse: 0 }
    }
  }
}

function unavailableReason(item: PackItem, company: CompanyConfigurationSnapshot, registry: PackRegistrySnapshot): ClassificationReason | null {
  const moduleUnavailable = (moduleId: string) => {
    const moduleEntry = registry.modules.find((entry) => entry.id === moduleId)
    return !moduleEntry || moduleEntry.status === 'hidden' || moduleEntry.status === 'coming_soon' ? moduleEntry?.status ?? 'unknown' : null
  }

  if (item.kind === 'module') {
    const status = moduleUnavailable(item.value.moduleId)
    if (status) return reason('MODULE_NOT_AVAILABLE', { moduleId: item.value.moduleId, status })
  }
  if (item.kind === 'report' && !registry.reportKeys.includes(item.value.reportKey)) {
    return reason('REPORT_REGISTRY_MISSING', { reportKey: item.value.reportKey })
  }
  if (item.kind === 'recipe') {
    const known = registry.recipes.some((entry) => entry.ref === item.value.recipeRef)
    if (!known || !company.platform.availableRecipes.includes(item.value.recipeRef)) {
      return reason('RECIPE_NOT_AVAILABLE', { recipeRef: item.value.recipeRef })
    }
  }
  for (const pre of item.requires || []) {
    if (pre.type === 'module') {
      const status = moduleUnavailable(pre.moduleId)
      if (status) return reason('REQUIRED_MODULE_NOT_AVAILABLE', { moduleId: pre.moduleId, status })
    }
  }
  return null
}

/** Classifies ONE pack item against a company snapshot. Pure and total. */
export function classifyPackItem(
  item: PackItem,
  company: CompanyConfigurationSnapshot,
  registry: PackRegistrySnapshot,
  pack: Pick<IndustryPackDefinition, 'key' | 'version'>,
): PackItemClassification {
  const base = { kind: item.kind, id: item.id, requirement: item.requirement }
  const found = presence(item, company)
  const withValues = found.present
    ? { current: found.current, proposed: found.proposed }
    : { proposed: found.proposed }
  const context = { pack: `${pack.key}@${pack.version}` }

  // 1
  if (item.deprecatedSince && found.present) {
    return {
      ...base,
      ...withValues,
      state: 'DEPRECATED_SETTING',
      blocking: false,
      reason: reason('ITEM_DEPRECATED', { ...context, since: item.deprecatedSince }),
      ...(item.replacedBy ? { replacedBy: item.replacedBy } : {}),
    }
  }

  // 2
  const unavailable = unavailableReason(item, company, registry)
  if (unavailable) {
    return { ...base, ...withValues, state: 'UNAVAILABLE', blocking: item.requirement === 'required', reason: unavailable }
  }

  // 3
  for (const pre of item.requires || []) {
    if (pre.type === 'feature' && !company.entitledFeatures.includes(pre.feature)) {
      const requiredPlan = registry.featureRequiredPlan[pre.feature]
      return {
        ...base,
        ...withValues,
        state: 'ENTITLEMENT_BLOCKED',
        blocking: item.requirement === 'required',
        reason: reason('FEATURE_NOT_ENTITLED', { feature: pre.feature, ...(requiredPlan ? { requiredPlan } : {}) }),
        ...(requiredPlan ? { requiredPlan } : {}),
      }
    }
  }

  // 4
  const providers: string[] = []
  if (item.kind === 'integration') providers.push(item.value.provider)
  for (const pre of item.requires || []) if (pre.type === 'integration') providers.push(pre.provider)
  for (const provider of providers) {
    const inPlatform = company.platform.availableIntegrations.includes(provider)
    const connected = company.integrations.some((entry) => entry.provider === provider && CONNECTED.has(entry.status))
    const needsConnection = item.kind !== 'integration'
    if (!inPlatform || (needsConnection && !connected)) {
      return {
        ...base,
        ...withValues,
        state: 'INTEGRATION_UNAVAILABLE',
        blocking: item.requirement === 'required',
        reason: reason(inPlatform ? 'INTEGRATION_NOT_CONNECTED' : 'INTEGRATION_NOT_IN_PLATFORM', { provider }),
        requiredIntegration: provider,
      }
    }
  }

  // 5
  if (!found.present) {
    return { ...base, ...withValues, state: 'SAFE_ADDITION', blocking: false, reason: reason('NOT_PRESENT', context) }
  }
  // 6
  if (found.equal) {
    return { ...base, ...withValues, state: 'SAME_VALUE', blocking: false, reason: reason('EQUIVALENT', context) }
  }
  // 7
  if (company.userOverrides.some((entry) => entry.kind === item.kind && entry.id === item.id)) {
    return { ...base, ...withValues, state: 'USER_OVERRIDE', blocking: false, reason: reason('TENANT_OVERRIDE', context) }
  }
  // 8
  return {
    ...base,
    ...withValues,
    state: 'CONFLICT',
    blocking: found.inUse > 0,
    reason: reason(found.inUse > 0 ? 'VALUE_DIFFERS_IN_USE' : 'VALUE_DIFFERS', { ...context, inUse: found.inUse }),
  }
}
