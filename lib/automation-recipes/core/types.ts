// Automation Recipe Contract v1 — normative types. CATALOG + CONTRACTS ONLY.
// Recipe = static template (code). Automation Instance = tenant configuration (future, automation_rules).

import type { BusinessType } from '@/lib/business-types'
import type { CompanyPermission } from '@/lib/access-control-core'
import type { FeatureId } from '@/lib/plan-limits'
import type { ActionImpact, ActionSensitivity } from '../../actions/contracts/types'
import type { JsonValue } from '../../wave1/shared/json'

export type RecipeStatus = 'draft' | 'catalog_only' | 'runtime_candidate' | 'published' | 'deprecated' | 'retired'

/** Statuses allowed by the Wave 1 T1 mission. `runtime_candidate` does NOT authorize runtime. */
export const T1_ALLOWED_RECIPE_STATUSES: readonly RecipeStatus[] = ['draft', 'catalog_only', 'runtime_candidate']

export type SubjectType = 'order' | 'proposal' | 'lead' | 'task' | 'product'

export type TriggerRequirement =
  | { type: 'domain_event'; eventType: string; acceptedVersions: number[]; subject: SubjectType }
  | {
      type: 'detector'
      detectorKey: string
      detectorVersion: number
      cadence: 'PT15M' | 'PT1H' | 'P1D'
      windowKey: 'day' | 'status' | 'none'
      subject: SubjectType
    }

export type TriggerField = 'subjectId' | 'companyId' | 'occurredAt' | 'eventId' | 'windowKey'

export type ParamRefOrLiteral =
  | { param: string }
  | { literal: string | number | boolean | null | string[] }

export type ConditionOp = 'eq' | 'neq' | 'in' | 'not_in' | 'gte' | 'lte' | 'is_null' | 'not_null'

export type ConditionSpec =
  | { op: 'all' | 'any'; of: ConditionSpec[] }
  | { op: ConditionOp; field: string; value?: ParamRefOrLiteral }

export type ActionInputMapping = ParamRefOrLiteral | { trigger: TriggerField }

export type ActionRequirement = {
  action: string
  input: Record<string, ActionInputMapping>
  onFailure: 'stop' | 'continue'
}

export type RecipeParameter =
  | { key: string; type: 'integer'; label: string; default: number; min: number; max: number }
  | { key: string; type: 'duration_days'; label: string; default: number; min: number; max: number }
  | { key: string; type: 'enum'; label: string; default: string; options: string[] }
  | { key: string; type: 'status_set'; label: string; scope: 'order' | 'proposal' | 'lead'; default: string[] }
  | { key: string; type: 'member_ref'; label: string; required: false }
  | { key: string; type: 'boolean'; label: string; default: boolean }

export type DataQualityCheck = 'products_have_stock' | 'orders_have_due_date' | 'leads_have_next_contact'

export type RecipeDependency =
  | { type: 'trigger_available'; ref: string }
  | { type: 'action_available'; action: string }
  | { type: 'feature'; feature: FeatureId }
  | { type: 'module'; moduleId: string }
  | { type: 'integration'; provider: string; capability: string }
  | { type: 'data_quality'; check: DataQualityCheck }
  | { type: 'communication_consent'; channel: string; purpose: 'transactional' | 'marketing' }

export type RecipeRiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED'

export type RecipeRisk = {
  maxImpact: ActionImpact
  sensitivities: ActionSensitivity[]
  actorType: 'automation'
  blastRadius: 'single_subject' | 'bulk'
  effectiveClass: RecipeRiskClass
}

export type RecipeConfirmationPolicy = {
  activation: 'explicit_user_activation'
  activationRequires: CompanyPermission
  perRun: 'none' | 'preapproved_at_activation' | 'human_each_run'
  reapprovalOn: Array<'major_version' | 'param_widening' | 'activator_lost_permission'>
}

export type RecipeDefinition = {
  schemaVersion: 1
  key: string
  version: string
  status: RecipeStatus
  name: string
  description: string
  category: 'operations' | 'sales' | 'inventory' | 'customer' | 'finance'
  internalOnly: boolean
  businessTypes: BusinessType[] | 'all'
  trigger: TriggerRequirement
  conditions: ConditionSpec
  actions: ActionRequirement[]
  parameters: RecipeParameter[]
  dependencies: RecipeDependency[]
  risk: RecipeRisk
  confirmation: RecipeConfirmationPolicy
  dedupe: { runKeyTemplate: string; cooldown?: string }
  limits: { maxRunsPerHourPerCompany: number; maxActionsPerRun: number }
  changelog: Array<{ version: string; date: string; kind: 'major' | 'minor' | 'patch'; summary: string }>
}

export type RecipeParams = Record<string, JsonValue>

/** Trigger occurrence handed to planRecipeRun (never read from I/O by the core). */
export type TriggerOccurrence =
  | {
      kind: 'domain_event'
      eventId: string
      eventType: string
      eventVersion: number
      companyId: string
      subjectId: string
      occurredAt: string
    }
  | {
      kind: 'detector'
      detectorKey: string
      detectorVersion: number
      companyId: string
      subjectId: string
      windowKey: string
      occurredAt: string
    }

/** Flat subject attributes for condition evaluation, keyed by allowlisted field (e.g. 'order.status'). */
export type SubjectSnapshot = Record<string, string | number | boolean | null>

export type PlannedRunOutcome =
  | 'WOULD_RUN'
  | 'CONDITIONS_NOT_MET'
  | 'BLOCKED_BY_DEPENDENCY'
  | 'BLOCKED_BY_RISK'
  | 'INVALID_PARAMS'
  | 'TRIGGER_MISMATCH'
  | 'INVALID_RECIPE'

export type PlannedRun = {
  recipeRef: string
  runKey: string | null
  outcome: PlannedRunOutcome
  actions: Array<{ action: string; input: Record<string, JsonValue>; idempotencyKey: string }>
  explanation: Array<{ code: string; params: Record<string, string | number> }>
  runtimeAuthorized: false
}

export type DependencyStatus = 'SATISFIED' | 'MISSING' | 'DEGRADED' | 'UNKNOWN'

export type RecipeDependencyContext = {
  entitledFeatures: FeatureId[]
  enabledModules: string[]
  connectedIntegrations: Array<{ provider: string; capabilities: string[] }>
  dataQuality: Partial<Record<DataQualityCheck, boolean>>
}
