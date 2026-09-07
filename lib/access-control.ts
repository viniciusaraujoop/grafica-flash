import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompanyAccess } from '@/lib/company-access'
import { resolvePlatformFeatureFlag } from '@/lib/admin/feature-flags'
import { canUseFeature as planCanUseFeature, type FeatureId } from '@/lib/plan-limits'
import {
  companyPermissionAllowed,
  evaluateFeatureAccess,
  type CompanyPermission,
} from '@/lib/access-control-core'

export type CompanyEntitlement =
  | 'site'
  | 'orders'
  | 'products'
  | 'whatsapp'
  | 'crm'
  | 'finance'
  | 'proposals'
  | 'production'
  | 'automations'
  | 'team_permissions'
  | 'advanced_modules'

const ENTITLEMENT_FEATURE: Record<CompanyEntitlement, FeatureId> = {
  site: 'site',
  orders: 'pedidos',
  products: 'produtos',
  whatsapp: 'whatsapp',
  crm: 'crm',
  finance: 'financeiro',
  proposals: 'propostas',
  production: 'producao',
  automations: 'automacoes',
  team_permissions: 'permissoes_equipe',
  advanced_modules: 'modulos_avancados',
}

export type CanUseFeatureInput = {
  db: SupabaseClient
  access: CompanyAccess
  actorCompanyId: string | null | undefined
  company: Record<string, unknown>
  permission: CompanyPermission
  entitlement?: CompanyEntitlement | null
  featureFlag?: string | null
  allowCrossCompanyAdmin?: boolean
}

export async function canUseFeature(input: CanUseFeatureInput) {
  const targetCompanyId = String(input.company.id || '') || null
  const plan = input.company.assinatura_plano || input.company.plano
  const segment = String(input.company.segmento || input.company.business_type || '') || null
  const permissionAllowed = companyPermissionAllowed(input.access, input.permission)
  const entitlementAllowed = input.entitlement
    ? planCanUseFeature(plan, ENTITLEMENT_FEATURE[input.entitlement])
    : true

  let featureFlagAllowed = true
  let flag = {
    schemaReady: true,
    enabled: true,
    config: null as Record<string, unknown> | null,
    matchedScope: null as string | null,
  }

  if (input.featureFlag) {
    const resolved = await resolvePlatformFeatureFlag(input.db, input.featureFlag, {
      companyId: targetCompanyId,
      segment,
      plan: String(plan || ''),
    })
    flag = {
      schemaReady: resolved.schemaReady,
      enabled: resolved.enabled,
      config: resolved.config,
      matchedScope: resolved.matchedScope,
    }
    featureFlagAllowed = resolved.schemaReady && resolved.enabled
  }

  const decision = evaluateFeatureAccess({
    actorCompanyId: input.actorCompanyId,
    targetCompanyId,
    allowCrossCompanyAdmin: input.allowCrossCompanyAdmin === true && input.access.isAdminMaster,
    permissionAllowed,
    entitlementAllowed,
    featureFlagAllowed,
  })

  return {
    ...decision,
    permission: input.permission,
    entitlement: input.entitlement || null,
    featureFlag: input.featureFlag || null,
    plan: String(plan || ''),
    flag,
  }
}

export function requireFeatureDecision<T extends { allowed: boolean; deniedBy: string[] }>(decision: T) {
  if (decision.allowed) return decision

  const reason = decision.deniedBy[0] || 'permission'
  const status = reason === 'tenant' || reason === 'permission' ? 403 : 402
  return {
    ...decision,
    error: reason === 'tenant'
      ? 'Recurso não pertence à empresa atual.'
      : reason === 'permission'
        ? 'Seu perfil não possui permissão para esta ação.'
        : reason === 'entitlement'
          ? 'Seu plano atual não inclui este recurso.'
          : 'Este recurso ainda não está liberado para sua empresa.',
    status,
  }
}
