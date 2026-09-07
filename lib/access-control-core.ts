export type CompanyPermission =
  | 'orders.read'
  | 'orders.update'
  | 'products.manage'
  | 'finance.read'
  | 'finance.manage'
  | 'site.publish'
  | 'proposals.manage'
  | 'production.manage'
  | 'automations.manage'
  | 'team.manage'
  | 'subscription.manage'
  | 'data.export'
  | 'company.settings'

export type CompanyPermissionContext = {
  role: string | null
  isAdminMaster: boolean
  canManage: boolean
  canFinance: boolean
  canConfig: boolean
  canProducts: boolean
  canProposal: boolean
  canSubscription: boolean
  canProduction: boolean
}

export type AccessDecisionInput = {
  actorCompanyId?: string | null
  targetCompanyId?: string | null
  allowCrossCompanyAdmin?: boolean
  permissionAllowed: boolean
  entitlementAllowed: boolean
  featureFlagAllowed: boolean
}

export type AccessDecision = {
  allowed: boolean
  deniedBy: Array<'tenant' | 'permission' | 'entitlement' | 'feature_flag'>
}

export function companyPermissionAllowed(
  access: CompanyPermissionContext,
  permission: CompanyPermission,
) {
  if (!access.role && !access.isAdminMaster) return false
  if (access.isAdminMaster) return true

  switch (permission) {
    case 'orders.read':
      return true
    case 'orders.update':
      return access.canManage || access.canProposal || access.canProduction
    case 'products.manage':
      return access.canProducts
    case 'finance.read':
    case 'finance.manage':
      return access.canFinance
    case 'site.publish':
    case 'team.manage':
    case 'data.export':
    case 'company.settings':
      return access.canConfig
    case 'proposals.manage':
      return access.canProposal
    case 'production.manage':
      return access.canProduction
    case 'automations.manage':
      return access.canManage
    case 'subscription.manage':
      return access.canSubscription
    default:
      return false
  }
}

export function evaluateFeatureAccess(input: AccessDecisionInput): AccessDecision {
  const deniedBy: AccessDecision['deniedBy'] = []
  const sameTenant = Boolean(input.actorCompanyId && input.targetCompanyId && input.actorCompanyId === input.targetCompanyId)
  const tenantAllowed = sameTenant || input.allowCrossCompanyAdmin === true

  if (!tenantAllowed) deniedBy.push('tenant')
  if (!input.permissionAllowed) deniedBy.push('permission')
  if (!input.entitlementAllowed) deniedBy.push('entitlement')
  if (!input.featureFlagAllowed) deniedBy.push('feature_flag')

  return {
    allowed: deniedBy.length === 0,
    deniedBy,
  }
}
