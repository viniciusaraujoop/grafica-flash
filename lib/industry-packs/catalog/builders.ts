// Small pure builders to keep catalog definitions readable. Output is plain data.

import type {
  CategoryItem,
  CompanyPermission,
  DashboardItem,
  FeatureId,
  IntegrationItem,
  ItemRequirement,
  ModuleItem,
  OnboardingItem,
  PackItemPrecondition,
  PackRole,
  PermissionItem,
  RecipeItem,
  SettingItem,
  SettingPath,
  StatusItem,
  StatusScope,
  StatusSemantic,
  TemplateItem,
} from '../core/types'
import type { JsonValue } from '../../wave1/shared/json'

const withRequires = (features: FeatureId[]): { requires?: PackItemPrecondition[] } =>
  features.length ? { requires: features.map((feature) => ({ type: 'feature' as const, feature })) } : {}

export function moduleItem(moduleId: string, requirement: ItemRequirement, order: number, features: FeatureId[] = []): ModuleItem {
  return { kind: 'module', id: moduleId, requirement, value: { moduleId, order }, ...withRequires(features) }
}

export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function statusFlow(
  scope: StatusScope,
  entries: Array<{ label: string; semantic?: StatusSemantic; terminal?: boolean }>,
): StatusItem[] {
  return entries.map((entry, index) => ({
    kind: 'status',
    id: `${scope}.${slugify(entry.label)}`,
    requirement: 'default',
    value: {
      scope,
      key: slugify(entry.label),
      label: entry.label,
      order: index + 1,
      ...(entry.semantic ? { semantic: entry.semantic } : {}),
      ...(entry.terminal ? { terminal: true } : {}),
    },
  }))
}

export function categories(labels: string[]): CategoryItem[] {
  return labels.map((label) => ({
    kind: 'category',
    id: `product.${slugify(label)}`,
    requirement: 'default',
    value: { scope: 'product', label },
  }))
}

export function dashboards(metricKeys: string[]): DashboardItem[] {
  return metricKeys.map((metricKey, index) => ({
    kind: 'dashboard',
    id: `card.${metricKey}`,
    requirement: 'default',
    value: { cardId: `card.${metricKey}`, metricKey, order: index + 1 },
  }))
}

export function recipe(recipeRef: string, requirement: 'recommended' | 'optional'): RecipeItem {
  return {
    kind: 'recipe',
    id: recipeRef.split('@')[0],
    requirement,
    value: { recipeRef },
    requires: [{ type: 'feature', feature: 'automacoes' }],
  }
}

export function integration(provider: string, capabilities: string[]): IntegrationItem {
  return { kind: 'integration', id: provider, requirement: 'optional', value: { provider, capabilities } }
}

export function permission(role: PackRole, grants: CompanyPermission[]): PermissionItem {
  return { kind: 'permission', id: `role.${role}`, requirement: 'recommended', value: { role, grants } }
}

export function proposalTemplate(content: {
  titulo: string
  introducao: string
  condicoes: string
  prazoPadrao: string
  validadeHoras: number
}, features: FeatureId[] = []): TemplateItem {
  return {
    kind: 'template',
    id: 'proposal.default',
    requirement: 'default',
    value: { templateKind: 'proposal', key: 'default', content: { format: 'proposal', ...content } },
    ...withRequires(features),
  }
}

export function readyMessages(texts: string[]): TemplateItem[] {
  return texts.map((text, index) => ({
    kind: 'template',
    id: `ready_message.${index + 1}`,
    requirement: 'default',
    value: { templateKind: 'ready_message', key: `m${index + 1}`, content: { format: 'plain', text } },
  }))
}

export function onboarding(steps: Array<{ stepKey: string; label: string; signal: string }>): OnboardingItem[] {
  return steps.map((step, index) => ({
    kind: 'onboarding',
    id: `step.${step.stepKey}`,
    requirement: 'default',
    value: { stepKey: step.stepKey, order: index + 1, checklistLabel: step.label, completionSignal: step.signal },
  }))
}

export function setting(path: SettingPath, value: JsonValue, requirement: ItemRequirement = 'default'): SettingItem {
  return { kind: 'setting', id: path, requirement, value: { path, value } }
}
