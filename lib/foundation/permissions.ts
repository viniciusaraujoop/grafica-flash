import type { FoundationPermission } from './contracts'

export type FoundationPermissionContext = {
  role?: string | null
  isAdminMaster?: boolean
  permissions?: Record<string, boolean> | null
}

const legacyPermission: Partial<Record<FoundationPermission, string>> = {
  'orders.read': 'orders',
  'orders.update': 'orders',
  'quotes.approve': 'proposals',
  'artwork.manage': 'production',
  'production.manage': 'production',
  'portal.manage': 'settings',
  'automation.manage': 'settings',
}

const rolePermissions: Record<string, ReadonlySet<FoundationPermission>> = {
  gerente: new Set([
    'orders.read',
    'orders.update',
    'quotes.approve',
    'artwork.manage',
    'production.manage',
  ]),
  atendente: new Set([
    'orders.read',
    'orders.update',
    'quotes.approve',
  ]),
  producao: new Set([
    'orders.read',
    'orders.update',
    'artwork.manage',
    'production.manage',
  ]),
  funcionario: new Set(['orders.read']),
}

export function hasFoundationPermission(
  context: FoundationPermissionContext,
  permission: FoundationPermission,
) {
  if (context.isAdminMaster) return true

  const role = String(context.role || '').trim().toLowerCase()
  if (role === 'dono' || role === 'super_admin') return true

  const explicit = context.permissions?.[permission]
  if (typeof explicit === 'boolean') return explicit

  const legacyKey = legacyPermission[permission]
  const legacy = legacyKey ? context.permissions?.[legacyKey] : undefined
  if (typeof legacy === 'boolean') return legacy

  return rolePermissions[role]?.has(permission) || false
}
