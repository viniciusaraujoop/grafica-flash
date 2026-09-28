// Industry Pack Contract v1 — buildRegistrySnapshot.
// Derives the platform registry from static, side-effect-free modules (read-only consumption).
// No I/O: segment-modules, access-control-core, plan-limits and orcaly-nichos are pure data/functions.

import { companyPermissionAllowed, type CompanyPermission, type CompanyPermissionContext } from '../../access-control-core'
import { nichosOrcaly } from '../../orcaly-nichos'
import { getRequiredPlan, planLimits, type FeatureId, type PlanId } from '../../plan-limits'
import { allSegments, getSegmentDashboardCards, segmentModules } from '../../segment-modules'
import type { PackRegistrySnapshot, PackRole } from './types'

/** Every CompanyPermission (runtime list; exhaustiveness is enforced at the type level below). */
export const ALL_COMPANY_PERMISSIONS = [
  'orders.read',
  'orders.update',
  'products.manage',
  'finance.read',
  'finance.manage',
  'site.publish',
  'proposals.manage',
  'production.manage',
  'automations.manage',
  'team.manage',
  'subscription.manage',
  'data.export',
  'company.settings',
] as const satisfies readonly CompanyPermission[]

type MissingPermission = Exclude<CompanyPermission, (typeof ALL_COMPANY_PERMISSIONS)[number]>
const permissionsExhaustive: MissingPermission extends never ? true : false = true
void permissionsExhaustive

/**
 * Mirror of `permissionsByRole` in lib/company-access.ts (that module imports Supabase and
 * next/server, so the pure core cannot import it). A parity test guards this mirror.
 */
export function roleCapabilityFlags(role: PackRole): CompanyPermissionContext {
  const isManager = role === 'gerente'
  const isAttendant = role === 'atendente'
  const isProduction = role === 'producao'
  return {
    role,
    isAdminMaster: false,
    canManage: isManager,
    canFinance: isManager,
    canConfig: false,
    canProducts: isManager || isProduction,
    canProposal: isManager || isAttendant,
    canSubscription: isManager,
    canProduction: isManager || isProduction,
  }
}

const ROLES: readonly PackRole[] = ['gerente', 'atendente', 'producao']

export type RegistrySnapshotInput = {
  recipes?: PackRegistrySnapshot['recipes']
  reportKeys?: string[]
}

export function buildRegistrySnapshot(input: RegistrySnapshotInput = {}): PackRegistrySnapshot {
  const features = [...planLimits.premium.features].sort() as FeatureId[]
  const featureRequiredPlan: Partial<Record<FeatureId, PlanId>> = {}
  for (const feature of features) featureRequiredPlan[feature] = getRequiredPlan(feature)

  const metricKeys = new Set<string>()
  for (const segment of allSegments) for (const card of getSegmentDashboardCards(segment)) metricKeys.add(card.metricKey)

  const rolePermissions = {} as Record<PackRole, CompanyPermission[]>
  for (const role of ROLES) {
    const flags = roleCapabilityFlags(role)
    rolePermissions[role] = ALL_COMPANY_PERMISSIONS.filter((permission) => companyPermissionAllowed(flags, permission))
  }

  return {
    businessTypes: [...allSegments],
    modules: segmentModules
      .map((module) => ({
        id: module.id,
        segments: [...module.segments],
        status: module.status,
        isGlobal: module.isGlobal === true,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    metricKeys: [...metricKeys].sort(),
    features,
    featureRequiredPlan,
    permissions: [...ALL_COMPANY_PERMISSIONS],
    rolePermissions,
    recipes: [...(input.recipes || [])].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)),
    reportKeys: [...(input.reportKeys || [])].sort(),
    legacyNichoIds: nichosOrcaly.map((nicho) => nicho.id).sort(),
  }
}
