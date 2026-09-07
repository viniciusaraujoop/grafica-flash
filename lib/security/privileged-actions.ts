export type SubscriptionMutationAction =
  | 'create'
  | 'renew'
  | 'sync'
  | 'cancel'
  | 'create_pix'
  | 'history'

export type TeamMutationOperation = 'create' | 'update' | 'delete'

const SETTINGS_STEP_UP_FIELDS = new Set([
  'pix_key',
  'pix_tipo',
  'pix_nome',
  'pix_cidade',
  'aceita_pix',
  'aceita_cartao',
  'cobrar_sinal',
  'percentual_sinal',
])

const ELEVATED_TEAM_ROLES = new Set([
  'dono',
  'owner',
  'gerente',
  'admin',
  'super_admin',
])

export function getSensitiveSettingsFields(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []
  return Object.keys(input as Record<string, unknown>).filter((field) => SETTINGS_STEP_UP_FIELDS.has(field))
}

export function requiresSettingsMfa(input: unknown) {
  return getSensitiveSettingsFields(input).length > 0
}

export function normalizeSubscriptionMutationAction(value: unknown): SubscriptionMutationAction {
  if (
    value === 'renew'
    || value === 'sync'
    || value === 'cancel'
    || value === 'create_pix'
    || value === 'history'
  ) {
    return value
  }
  return 'create'
}

export function requiresSubscriptionMfa(action: SubscriptionMutationAction) {
  return action === 'create'
    || action === 'renew'
    || action === 'cancel'
    || action === 'create_pix'
}

function normalizeRole(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function isElevatedTeamRole(value: unknown) {
  return ELEVATED_TEAM_ROLES.has(normalizeRole(value))
}

export function requiresTeamMutationMfa(input: {
  operation: TeamMutationOperation
  currentRole?: unknown
  nextRole?: unknown
  nextStatus?: unknown
}) {
  const currentElevated = isElevatedTeamRole(input.currentRole)
  const nextElevated = isElevatedTeamRole(input.nextRole)
  const status = String(input.nextStatus || '').trim().toLowerCase()

  if (input.operation === 'create') return nextElevated
  if (input.operation === 'delete') return currentElevated

  if (currentElevated || nextElevated) return true
  if ((status === 'removido' || status === 'bloqueado') && currentElevated) return true
  return false
}
