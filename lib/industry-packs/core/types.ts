// Industry Pack Contract v1 — normative types (pure, code-first).
// BusinessType is the segment; an Industry Pack is a niche configuration inside it.

import type { BusinessType } from '@/lib/business-types'
import type { CompanyPermission } from '@/lib/access-control-core'
import type { FeatureId, PlanId } from '@/lib/plan-limits'
import type { JsonValue } from '../../wave1/shared/json'

export type { BusinessType, CompanyPermission, FeatureId, PlanId, JsonValue }

export type PackStatus = 'draft' | 'preview' | 'published' | 'deprecated' | 'retired'

export type ItemRequirement = 'required' | 'default' | 'recommended' | 'optional'

export type PackItemKind =
  | 'module'
  | 'status'
  | 'category'
  | 'dashboard'
  | 'report'
  | 'recipe'
  | 'integration'
  | 'permission'
  | 'template'
  | 'onboarding'
  | 'setting'

export type PackItemPrecondition =
  | { type: 'feature'; feature: FeatureId }
  | { type: 'permission'; permission: CompanyPermission }
  | { type: 'integration'; provider: string; capability?: string }
  | { type: 'module'; moduleId: string }
  | { type: 'item'; kind: PackItemKind; id: string }

export type PackItemBase<K extends PackItemKind, V> = {
  kind: K
  id: string
  requirement: ItemRequirement
  value: V
  requires?: PackItemPrecondition[]
  since?: string
  deprecatedSince?: string
  replacedBy?: string
}

export type StatusScope = 'order' | 'proposal' | 'lead' | 'task'
export type StatusSemantic =
  | 'new'
  | 'in_progress'
  | 'waiting_customer'
  | 'waiting_payment'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type PackRole = 'gerente' | 'atendente' | 'producao'

export type TemplateKind = 'proposal' | 'ready_message' | 'order_question' | 'site_preset' | 'recommended_field'

export type TemplateContent =
  | { format: 'plain'; text: string }
  | {
      format: 'proposal'
      titulo: string
      introducao: string
      condicoes: string
      prazoPadrao: string
      validadeHoras: number
    }

export type SettingPath =
  | 'orders.questions'
  | 'orders.recommendedFields'
  | 'proposals.defaultValidityHours'
  | 'payments.depositEnabled'
  | 'payments.depositPercent'
  | 'site.templateKey'
  | 'delivery.enabled'

export type ModuleItem = PackItemBase<'module', { moduleId: string; order?: number }>
export type StatusItem = PackItemBase<
  'status',
  { scope: StatusScope; key: string; label: string; order: number; terminal?: boolean; semantic?: StatusSemantic }
>
export type CategoryItem = PackItemBase<'category', { scope: 'product' | 'finance'; label: string; parentId?: string }>
export type DashboardItem = PackItemBase<'dashboard', { cardId: string; metricKey: string; order: number }>
export type ReportItem = PackItemBase<'report', { reportKey: string }>
export type RecipeItem = PackItemBase<'recipe', { recipeRef: string; params?: Record<string, JsonValue> }>
export type IntegrationItem = PackItemBase<'integration', { provider: string; capabilities: string[] }>
export type PermissionItem = PackItemBase<'permission', { role: PackRole; grants: CompanyPermission[] }>
export type TemplateItem = PackItemBase<'template', { templateKind: TemplateKind; key: string; content: TemplateContent }>
export type OnboardingItem = PackItemBase<
  'onboarding',
  { stepKey: string; order: number; checklistLabel: string; completionSignal: string }
>
export type SettingItem = PackItemBase<'setting', { path: SettingPath; value: JsonValue }>

export type PackItem =
  | ModuleItem
  | StatusItem
  | CategoryItem
  | DashboardItem
  | ReportItem
  | RecipeItem
  | IntegrationItem
  | PermissionItem
  | TemplateItem
  | OnboardingItem
  | SettingItem

export type PackMinimumRequirements = {
  plan?: PlanId
  features?: FeatureId[]
  modules?: string[]
}

export type PackChangelogEntry = {
  version: string
  date: string
  kind: 'major' | 'minor' | 'patch'
  summary: string
  changes: Array<{ op: 'add' | 'remove' | 'change' | 'deprecate'; kind: PackItemKind; id: string; note?: string }>
}

export type IndustryPackDefinition = {
  schemaVersion: 1
  key: string
  version: string
  status: PackStatus
  businessType: BusinessType
  subsegments: string[]
  name: string
  description: string
  capabilities: string[]
  items: PackItem[]
  minimumRequirements: PackMinimumRequirements
  legacy?: { nichoIds?: string[] }
  changelog: PackChangelogEntry[]
}

export type ResolvedPackView = {
  ref: string
  definition: IndustryPackDefinition
  required: PackItem[]
  defaults: PackItem[]
  recommended: PackItem[]
  optional: PackItem[]
  modules: ModuleItem[]
  statuses: StatusItem[]
  categories: CategoryItem[]
  dashboards: DashboardItem[]
  reports: ReportItem[]
  recipes: RecipeItem[]
  integrations: IntegrationItem[]
  permissions: PermissionItem[]
  templates: TemplateItem[]
  onboarding: OnboardingItem[]
  settings: SettingItem[]
}

export type ModuleAvailability = 'active' | 'beta' | 'coming_soon' | 'hidden'

/** Everything validation needs from the platform, injected so the core stays pure. */
export type PackRegistrySnapshot = {
  businessTypes: BusinessType[]
  modules: Array<{ id: string; segments: BusinessType[]; status: ModuleAvailability; isGlobal: boolean }>
  metricKeys: string[]
  features: FeatureId[]
  featureRequiredPlan: Partial<Record<FeatureId, PlanId>>
  permissions: CompanyPermission[]
  rolePermissions: Record<PackRole, CompanyPermission[]>
  recipes: Array<{ ref: string; key: string; internalOnly: boolean; status: string }>
  reportKeys: string[]
  legacyNichoIds: string[]
}

export type CompanyStatusEntry = { key: string; label: string; inUseCount: number }
export type CompanyCategoryEntry = { scope: 'product' | 'finance'; label: string; inUseCount: number }

export type CompanyConfigurationSnapshot = {
  schemaVersion: 1
  companyId: string
  businessType: BusinessType | null
  plan: PlanId
  entitledFeatures: FeatureId[]
  enabledModules: string[]
  statuses: Partial<Record<StatusScope, CompanyStatusEntry[]>>
  categories: CompanyCategoryEntry[]
  settings: Partial<Record<SettingPath, JsonValue>>
  templates: Array<{ templateKind: TemplateKind; key: string; content: TemplateContent }>
  dashboardCards: string[]
  enabledReports: string[]
  activeRecipes: string[]
  integrations: Array<{ provider: string; status: string; capabilities: string[] }>
  rolePermissionProfiles: Partial<Record<PackRole, CompanyPermission[]>>
  onboardingSteps: string[]
  appliedPack: { ref: string; appliedAt: string } | null
  userOverrides: Array<{ kind: PackItemKind; id: string }>
  platform: { availableIntegrations: string[]; availableRecipes: string[] }
}

export type PackDiffState =
  | 'SAFE_ADDITION'
  | 'SAME_VALUE'
  | 'CONFLICT'
  | 'USER_OVERRIDE'
  | 'UNAVAILABLE'
  | 'ENTITLEMENT_BLOCKED'
  | 'INTEGRATION_UNAVAILABLE'
  | 'DEPRECATED_SETTING'

export type ClassificationReason = { code: string; params: Record<string, string | number> }

export type PackItemClassification = {
  kind: PackItemKind
  id: string
  requirement: ItemRequirement
  state: PackDiffState
  blocking: boolean
  current?: JsonValue
  proposed?: JsonValue
  reason: ClassificationReason
  requiredPlan?: PlanId
  requiredIntegration?: string
  replacedBy?: string
}

export type PackRemoval = {
  kind: 'status' | 'category'
  id: string
  scope: string
  inUseCount: number
  state: 'CONFLICT' | 'USER_OVERRIDE'
  replacesFlow: boolean
}

export type PackDiff = {
  packRef: string
  companyId: string
  basis: { appliedPackRef: string | null }
  items: PackItemClassification[]
  removals: PackRemoval[]
  summary: Record<PackDiffState, number>
  blockingCount: number
  fingerprint: string
}

export type ProposalDecision = 'ADD' | 'KEEP_CURRENT' | 'SKIP' | 'SUGGEST_REPLACEMENT' | 'REQUIRES_MAPPING'

export type PackProposal = {
  schemaVersion: 1
  packRef: string
  diffFingerprint: string
  decisions: Array<{
    kind: PackItemKind
    id: string
    state: PackDiffState
    defaultDecision: ProposalDecision
    userSelectable: boolean
    reason: ClassificationReason
  }>
  blocking: Array<{ kind: PackItemKind; id: string; reason: ClassificationReason }>
  applicable: boolean
  notApplied: true
  applyStatus: 'MIGRATION_REQUIRED_BLOCKED_BY_M0'
}
