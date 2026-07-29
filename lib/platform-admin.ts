// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest } from 'next/server'
import {
  getRequester,
  getSupabaseAdmin,
} from '@/lib/company-access'

export type PlatformRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'support'

export type PlatformPermission =
  | 'dashboard.view'
  | 'companies.view'
  | 'marketplace.view'
  | 'finance.view'
  | 'affiliates.view'
  | 'affiliates.manage'
  | 'referrals.view'
  | 'referrals.review'
  | 'commissions.view'
  | 'commissions.reverse'
  | 'payouts.view'
  | 'payouts.create'
  | 'payouts.approve'
  | 'payouts.cancel'
  | 'payouts.send'
  | 'payouts.mark_paid'
  | 'pix.verify'
  | 'pix.reveal'
  | 'contact.view'
  | 'team.manage'
  | 'audit.view'
  | 'settings.manage'

export const PLATFORM_PERMISSION_CATALOG: Array<{
  key: PlatformPermission
  label: string
  description: string
  supportAssignable: boolean
}> = [
  {
    key: 'dashboard.view',
    label: 'Ver dashboard',
    description: 'Acessar o resumo administrativo.',
    supportAssignable: true,
  },
  {
    key: 'companies.view',
    label: 'Ver empresas',
    description: 'Consultar empresas e assinaturas.',
    supportAssignable: true,
  },
  {
    key: 'marketplace.view',
    label: 'Ver integrações',
    description: 'Consultar status de integrações de pagamento.',
    supportAssignable: true,
  },
  {
    key: 'finance.view',
    label: 'Ver valores',
    description: 'Visualizar valores, saldos e comissões.',
    supportAssignable: true,
  },
  {
    key: 'affiliates.view',
    label: 'Ver parceiros',
    description: 'Consultar cadastros de parceiros.',
    supportAssignable: true,
  },
  {
    key: 'affiliates.manage',
    label: 'Gerenciar parceiros',
    description: 'Ativar, suspender ou rejeitar parceiros.',
    supportAssignable: false,
  },
  {
    key: 'referrals.view',
    label: 'Ver indicações',
    description: 'Consultar indicações e dados de contato.',
    supportAssignable: true,
  },
  {
    key: 'referrals.review',
    label: 'Revisar indicações',
    description: 'Aprovar, sinalizar ou recusar indicações.',
    supportAssignable: true,
  },
  {
    key: 'commissions.view',
    label: 'Ver comissões',
    description: 'Consultar comissões e retenções.',
    supportAssignable: true,
  },
  {
    key: 'commissions.reverse',
    label: 'Reverter comissões',
    description: 'Cancelar comissão e gerar ajuste financeiro.',
    supportAssignable: false,
  },
  {
    key: 'payouts.view',
    label: 'Ver pagamentos',
    description: 'Consultar lotes e pagamentos de parceiros.',
    supportAssignable: true,
  },
  {
    key: 'payouts.create',
    label: 'Criar lotes',
    description: 'Montar lotes de pagamentos.',
    supportAssignable: false,
  },
  {
    key: 'payouts.approve',
    label: 'Aprovar lotes',
    description: 'Aprovar pagamentos pendentes.',
    supportAssignable: false,
  },
  {
    key: 'payouts.cancel',
    label: 'Cancelar lotes',
    description: 'Cancelar pagamentos antes do envio.',
    supportAssignable: false,
  },
  {
    key: 'payouts.send',
    label: 'Enviar Pix',
    description: 'Disparar transferências Pix.',
    supportAssignable: false,
  },
  {
    key: 'payouts.mark_paid',
    label: 'Confirmar pagamento manual',
    description: 'Marcar um lote como pago manualmente.',
    supportAssignable: false,
  },
  {
    key: 'pix.verify',
    label: 'Verificar conta Pix',
    description: 'Confirmar titularidade da conta Pix.',
    supportAssignable: false,
  },
  {
    key: 'pix.reveal',
    label: 'Revelar chave Pix',
    description: 'Visualizar a chave Pix completa.',
    supportAssignable: false,
  },
  {
    key: 'contact.view',
    label: 'Ver contatos',
    description: 'Visualizar nome, e-mail e WhatsApp.',
    supportAssignable: true,
  },
  {
    key: 'team.manage',
    label: 'Gerenciar equipe',
    description: 'Criar e administrar acessos internos.',
    supportAssignable: false,
  },
  {
    key: 'audit.view',
    label: 'Ver auditoria',
    description: 'Consultar o histórico de ações internas.',
    supportAssignable: true,
  },
  {
    key: 'settings.manage',
    label: 'Alterar configurações',
    description: 'Modificar regras críticas da plataforma.',
    supportAssignable: false,
  },
]

const OWNER_ONLY = new Set<PlatformPermission>([
  'affiliates.manage',
  'commissions.reverse',
  'payouts.create',
  'payouts.approve',
  'payouts.cancel',
  'payouts.send',
  'payouts.mark_paid',
  'pix.verify',
  'pix.reveal',
  'team.manage',
  'settings.manage',
])

const ROLE_DEFAULTS: Record<
  PlatformRole,
  Partial<Record<PlatformPermission, boolean>>
> = {
  owner: {
    'dashboard.view': true,
  },
  admin: {
    'dashboard.view': true,
    'companies.view': true,
    'marketplace.view': true,
    'finance.view': true,
    'affiliates.view': true,
    'referrals.view': true,
    'referrals.review': true,
    'commissions.view': true,
    'payouts.view': true,
    'contact.view': true,
    'audit.view': true,
  },
  finance: {
    'dashboard.view': true,
    'finance.view': true,
    'affiliates.view': true,
    'referrals.view': true,
    'commissions.view': true,
    'payouts.view': true,
    'contact.view': true,
  },
  support: {
    'dashboard.view': true,
    'companies.view': true,
    'affiliates.view': true,
    'referrals.view': true,
    'contact.view': true,
  },
}

export type PlatformAdmin = {
  id: string
  user_id: string
  email: string
  nome: string
  role: PlatformRole
  is_active: boolean
  permissions: Record<string, boolean>
  area: string
  observacoes: string | null
  last_login_at: string | null
  must_change_password: boolean
}

function normalizeRole(value: unknown): PlatformRole | null {
  const role = String(value || '').trim().toLowerCase()

  if (role === 'super_admin') return 'owner'
  if (role === 'suporte') return 'support'

  if (
    role === 'owner' ||
    role === 'admin' ||
    role === 'finance' ||
    role === 'support'
  ) {
    return role
  }

  return null
}

function normalizePermissions(
  value: unknown,
): Record<string, boolean> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  const result: Record<string, boolean> = {}

  for (const [key, allowed] of Object.entries(value)) {
    if (typeof allowed === 'boolean') {
      result[key] = allowed
    }
  }

  return result
}

export function canPlatform(
  admin: PlatformAdmin,
  permission: PlatformPermission,
) {
  if (admin.role === 'owner') return true

  if (OWNER_ONLY.has(permission)) {
    return false
  }

  if (admin.permissions.all === true) {
    return true
  }

  if (
    typeof admin.permissions[permission] === 'boolean'
  ) {
    return admin.permissions[permission] === true
  }

  return (
    ROLE_DEFAULTS[admin.role]?.[permission] === true
  )
}

export function platformCapabilities(
  admin: PlatformAdmin,
) {
  return Object.fromEntries(
    PLATFORM_PERMISSION_CATALOG.map((item) => [
      item.key,
      canPlatform(admin, item.key),
    ]),
  ) as Record<PlatformPermission, boolean>
}

export function sanitizeSupportPermissions(
  value: unknown,
) {
  const input = normalizePermissions(value)
  const allowed = new Set(
    PLATFORM_PERMISSION_CATALOG.filter(
      (item) => item.supportAssignable,
    ).map((item) => item.key),
  )
  const result: Record<string, boolean> = {}

  for (const key of allowed) {
    result[key] = input[key] === true
  }

  result['dashboard.view'] = true
  result['affiliates.view'] = true
  result['referrals.view'] = true
  result['contact.view'] = true

  return result
}

export async function getCurrentPlatformAdminFromRequest(
  request: NextRequest,
): Promise<PlatformAdmin | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(
    request,
    supabaseAdmin,
  )

  if (!requester?.email) return null

  const email = requester.email.toLowerCase()
  const { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select(
      'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password',
    )
    .or(
      `user_id.eq.${requester.id},email.ilike.${email}`,
    )
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !admin) return null

  const role = normalizeRole(admin.role)
  if (!role) return null

  const resolved: PlatformAdmin = {
    id: String(admin.id),
    user_id: String(admin.user_id || requester.id),
    email,
    nome:
      String(admin.nome || '').trim() ||
      email.split('@')[0] ||
      'Admin',
    role,
    is_active: Boolean(admin.is_active),
    permissions: normalizePermissions(admin.permissions),
    area: String(admin.area || 'Plataforma'),
    observacoes: admin.observacoes
      ? String(admin.observacoes)
      : null,
    last_login_at: admin.last_login_at
      ? String(admin.last_login_at)
      : null,
    must_change_password: Boolean(
      admin.must_change_password,
    ),
  }

  const patch: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (!admin.user_id) {
    patch.user_id = requester.id
  }

  await supabaseAdmin
    .from('platform_admins')
    .update(patch)
    .eq('id', admin.id)

  return resolved
}

export async function requirePlatformAdmin(
  request: NextRequest,
  permission?: PlatformPermission,
) {
  const admin =
    await getCurrentPlatformAdminFromRequest(request)

  if (!admin) {
    return {
      ok: false as const,
      error: 'Acesso administrativo não encontrado.',
      status: 403,
    }
  }

  if (
    permission &&
    !canPlatform(admin, permission)
  ) {
    return {
      ok: false as const,
      error: 'Seu perfil não possui permissão para esta ação.',
      status: 403,
    }
  }

  if (!permission && admin.role !== 'owner') {
    return {
      ok: false as const,
      error:
        'Esta rota administrativa exige permissão explícita.',
      status: 403,
    }
  }

  return {
    ok: true as const,
    admin,
    supabaseAdmin: getSupabaseAdmin(),
  }
}

export async function auditPlatformAction(
  adminEmail: string,
  action: string,
  input: {
    targetType?: string
    targetId?: string
    targetLabel?: string
    payload?: Record<string, unknown>
  } = {},
) {
  const supabaseAdmin = getSupabaseAdmin()
  const payload = input.payload || {}

  await supabaseAdmin
    .from('admin_audit_logs')
    .insert({
      admin_email: adminEmail,
      action,
      target_type: input.targetType || null,
      target_id: input.targetId || null,
      target_label: input.targetLabel || null,
      payload,
      metadata: payload,
    })
}
