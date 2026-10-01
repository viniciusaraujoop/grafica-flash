import type { ProductContext, ProductDefinition, ProductId } from './products'

export type WorkspaceContext = { kind: 'personal' | 'company'; id: string }
export type ProductGrant = {
  product_id: ProductId
  user_id: string | null
  company_id: string | null
  status: 'active' | 'revoked' | 'expired'
  starts_at: string
  expires_at: string | null
  permissions: string[]
}

export type AccessDecision = { allowed: boolean; reason: 'allowed' | 'unavailable' | 'context' | 'entitlement' | 'permission' }

export function activeGrant(grant: ProductGrant, now: number): boolean {
  const starts = Date.parse(grant.starts_at)
  const expires = grant.expires_at === null ? Infinity : Date.parse(grant.expires_at)
  return grant.status === 'active' && Number.isFinite(now) && Number.isFinite(starts) && starts <= now && expires > now
}

function contextMatches(kind: ProductContext, context: WorkspaceContext, actorId: string): boolean {
  return kind === 'personal' ? context.kind === 'personal' && context.id === actorId : kind === 'company' ? context.kind === 'company' : false
}

/** Grants never establish membership or a company's operational permissions. */
export function evaluateProductAccess(input: {
  product: ProductDefinition
  actorId: string
  context: WorkspaceContext
  member: boolean
  permission: string
  permissionAllowed: boolean
  rolloutEnabled: boolean
  grants: readonly ProductGrant[]
  now: number
}): AccessDecision {
  if (input.product.status === 'planned' || (input.product.status === 'preview' && !input.rolloutEnabled)) return { allowed: false, reason: 'unavailable' }
  if (!input.actorId || !input.member || !contextMatches(input.product.context, input.context, input.actorId)) return { allowed: false, reason: 'context' }
  const grant = input.grants.find((item) => item.product_id === input.product.id && activeGrant(item, input.now) && (
    input.context.kind === 'personal'
      ? item.user_id === input.actorId && item.company_id === null
      : item.company_id === input.context.id && item.user_id === null
  ))
  if (!grant) return { allowed: false, reason: 'entitlement' }
  if (!input.permissionAllowed || !grant.permissions.includes(input.permission)) return { allowed: false, reason: 'permission' }
  return { allowed: true, reason: 'allowed' }
}

export type ContextContract = {
  id: string
  actor_id: string
  source_product: ProductId
  target_product: ProductId
  source_context: WorkspaceContext
  target_context: WorkspaceContext
  data_scope: string
  purpose: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
}

export function permitsContextTransfer(contract: ContextContract, request: {
  actorId: string
  sourceProduct: ProductId
  targetProduct: ProductId
  sourceContext: WorkspaceContext
  targetContext: WorkspaceContext
  dataScope: string
  purpose: string
  sourceAuthorized: boolean
  targetAuthorized: boolean
  now: number
}): boolean {
  return Boolean(request.actorId && request.sourceAuthorized && request.targetAuthorized &&
    contract.actor_id === request.actorId && contract.revoked_at === null &&
    Date.parse(contract.granted_at) <= request.now && Date.parse(contract.expires_at) > request.now &&
    contract.source_product === request.sourceProduct && contract.target_product === request.targetProduct &&
    contract.source_context.kind === request.sourceContext.kind && contract.source_context.id === request.sourceContext.id &&
    contract.target_context.kind === request.targetContext.kind && contract.target_context.id === request.targetContext.id &&
    contract.data_scope === request.dataScope && contract.purpose === request.purpose)
}
