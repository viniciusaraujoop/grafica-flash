// Wave 1 manifests — pure JSON views of the code-first catalogs (for review, AI/UI discovery).

import {
  defaultRecipeRegistry,
  deriveRecipeRisk,
  findAction,
  recipeCatalog,
  recipeRegistryEntries,
  RECIPE_RUNTIME_STATUS,
  validateRecipe,
} from '../automation-recipes'
import { buildRegistrySnapshot, industryPackCatalog, validatePack, type PackRegistrySnapshot } from '../industry-packs'
import { DETECTORS } from '../detectors/contracts/registry'
import {
  OUTCOMES,
  QUESTIONNAIRE_V1,
  QUESTIONNAIRE_VERSION,
  RULESET_SUMMARY,
  RULESET_VERSION,
  SMART_SETUP_PACKS,
  THRESHOLDS_BPS,
  WEIGHTS,
  MAX_PACK_POINTS_PER_QUESTION,
} from '../smart-setup/core'
import { ALLOWED_DELIMITERS, AUTOMATION_POLICY, DESTINATIONS, IMPORT_ENTITIES, IMPORT_LIMITS, IMPORT_RULESET_VERSION, IMPORT_SCHEMA_VERSION } from '../import-engine/core'
import { DOMAIN_EVENTS, TIMELINE_ONLY_EVENTS } from '../events/contracts/registry'

export function buildWave1PackRegistry(): PackRegistrySnapshot {
  return buildRegistrySnapshot({ recipes: recipeRegistryEntries(), reportKeys: [] })
}

export function buildIndustryPackManifest() {
  const registry = buildWave1PackRegistry()
  return {
    manifest: 'orcaly.industry-packs',
    schemaVersion: 1,
    applyStatus: 'MIGRATION_REQUIRED_BLOCKED_BY_M0',
    packs: industryPackCatalog.map((pack) => {
      const validation = validatePack(pack, registry)
      const count = (kind: string) => pack.items.filter((item) => item.kind === kind).length
      return {
        ref: `${pack.key}@${pack.version}`,
        status: pack.status,
        businessType: pack.businessType,
        name: pack.name,
        subsegments: pack.subsegments,
        capabilities: pack.capabilities,
        legacyNichoIds: pack.legacy?.nichoIds ?? [],
        itemCounts: {
          module: count('module'),
          status: count('status'),
          category: count('category'),
          dashboard: count('dashboard'),
          report: count('report'),
          recipe: count('recipe'),
          integration: count('integration'),
          permission: count('permission'),
          template: count('template'),
          onboarding: count('onboarding'),
          setting: count('setting'),
        },
        requiredModules: pack.items.filter((item) => item.kind === 'module' && item.requirement === 'required').map((item) => item.id),
        recipes: pack.items.filter((item) => item.kind === 'recipe').map((item) => (item.kind === 'recipe' ? item.value.recipeRef : '')),
        integrations: pack.items.filter((item) => item.kind === 'integration').map((item) => item.id),
        valid: validation.ok,
      }
    }),
  }
}

export function buildRecipeManifest() {
  const registry = defaultRecipeRegistry()
  return {
    manifest: 'orcaly.automation-recipes',
    schemaVersion: 1,
    runtimeStatus: RECIPE_RUNTIME_STATUS,
    events: DOMAIN_EVENTS.map((event) => ({ eventType: event.eventType, version: event.version, status: event.status, consumerRuntime: event.consumerRuntime })),
    timelineOnlyEvents: [...TIMELINE_ONLY_EVENTS],
    detectors: DETECTORS.map((detector) => ({ key: detector.key, version: detector.version, status: detector.status, scheduled: detector.scheduled })),
    actions: registry.actions.map((action) => ({
      ref: `${action.key}@${action.majorVersion}`,
      impact: action.impact,
      sensitivity: [...action.sensitivity],
      executor: action.executor,
      publication: action.publication,
      reconciliation: [...action.reconciliation],
    })),
    recipes: recipeCatalog.map((recipe) => {
      const risk = deriveRecipeRisk(recipe, (ref) => findAction(registry, ref))
      const trigger =
        recipe.trigger.type === 'domain_event'
          ? `event:${recipe.trigger.eventType}@${recipe.trigger.acceptedVersions.join('|')}`
          : `detector:${recipe.trigger.detectorKey}@${recipe.trigger.detectorVersion}`
      return {
        ref: `${recipe.key}@${recipe.version}`,
        status: recipe.status,
        internalOnly: recipe.internalOnly,
        trigger,
        actions: recipe.actions.map((action) => action.action),
        risk: risk.effectiveClass,
        dedupe: recipe.dedupe.runKeyTemplate,
        valid: validateRecipe(recipe, registry).ok,
      }
    }),
  }
}

/** Smart Setup T2 manifest — safe metadata only. Never contains user answers. */
export function buildSmartSetupManifest() {
  return {
    manifest: 'orcaly.smart-setup',
    schemaVersion: 1,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    rulesetVersion: RULESET_VERSION,
    supportedPacks: [...SMART_SETUP_PACKS],
    questions: QUESTIONNAIRE_V1.map((question) => ({ id: question.id, role: question.role, selection: question.selection, scored: question.scored, conditional: question.condition !== null })),
    weights: { ...WEIGHTS, maxPackPointsPerQuestion: MAX_PACK_POINTS_PER_QUESTION },
    thresholds: {
      T_CLEAR: THRESHOLDS_BPS.T_CLEAR / 10000,
      T_MIN: THRESHOLDS_BPS.T_MIN / 10000,
      MARGIN: THRESHOLDS_BPS.MARGIN / 10000,
      MIN_COMPLETENESS: THRESHOLDS_BPS.MIN_COMPLETENESS / 10000,
    },
    outcomes: [...OUTCOMES],
    businessTypeRole: RULESET_SUMMARY.businessTypeRole,
    adaptations: [...RULESET_SUMMARY.adaptations],
    runtimeStatus: 'PURE_RECOMMENDATION_ONLY',
    applyStatus: 'NOT_AUTHORIZED',
  }
}

/** Import CSV T3 manifest — safe metadata only (no rows, no PII, no tenant data, no raw CSV). */
export function buildImportCsvManifest() {
  return {
    manifest: 'orcaly.import-csv',
    schemaVersion: IMPORT_SCHEMA_VERSION,
    rulesetVersion: IMPORT_RULESET_VERSION,
    entityTypes: [...IMPORT_ENTITIES],
    destinations: { CUSTOMERS: DESTINATIONS.CUSTOMERS.map((field) => field.id), PRODUCTS: DESTINATIONS.PRODUCTS.map((field) => field.id) },
    limits: { ...IMPORT_LIMITS },
    supportedDelimiters: [...ALLOWED_DELIMITERS],
    encoding: 'UTF-8 (BOM accepted)',
    parserStatus: 'CSV_PARSE_ADAPTER_PENDING',
    runtimeStatus: 'PURE_DRY_RUN_ONLY',
    applyStatus: 'NOT_AUTHORIZED',
    automationPolicy: AUTOMATION_POLICY,
    xlsxStatus: 'HOLD',
  }
}
