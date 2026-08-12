// ORCALY_OWNER_BACKOFFICE_V2
import { NextRequest } from 'next/server'
import { getRequester, getSupabaseAdmin } from '@/lib/company-access'

export const OFFICIAL_PLATFORM_OWNER_EMAIL = 'viniciusadm@orcaly.com'

export type PlatformRole = 'owner' | 'admin' | 'finance' | 'support' | 'prospector'

export type PlatformPermission =
  | 'portal.access'
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
  | 'founders.view_own'
  | 'founders.view_all'
  | 'founders.create_invite'
  | 'founders.resend_invite'
  | 'founders.revoke_pending'
  | 'prospecting.access'
  | 'prospecting.view_own'
  | 'prospecting.view_all'
  | 'prospecting.create'
  | 'prospecting.edit_own'
  | 'performance.view_own'
  | 'performance.view_all'

export const PLATFORM_PERMISSION_CATALOG: Array<{
  key: PlatformPermission
  label: string
  description: string
  supportAssignable: boolean
}> = [
  { key: 'portal.access', label: 'Acessar portal interno', description: 'Entrar somente nas areas internas permitidas ao perfil.', supportAssignable: true },
  { key: 'dashboard.view', label: 'Ver central de suporte', description: 'Acessar o resumo operacional permitido ao suporte.', supportAssignable: true },
  { key: 'companies.view', label: 'Ver assinantes', description: 'Consultar empresas, plano e situação do acesso.', supportAssignable: true },
  { key: 'marketplace.view', label: 'Ver status de integrações', description: 'Consultar somente o estado operacional das integrações.', supportAssignable: true },
  { key: 'finance.view', label: 'Ver valores financeiros', description: 'Visualizar faturamento, saldos e valores de pagamentos.', supportAssignable: false },
  { key: 'affiliates.view', label: 'Ver indicadores', description: 'Consultar cadastro e situação dos indicadores.', supportAssignable: true },
  { key: 'affiliates.manage', label: 'Gerenciar indicadores', description: 'Ativar, suspender ou rejeitar indicadores.', supportAssignable: false },
  { key: 'referrals.view', label: 'Ver indicações', description: 'Consultar indicações e seus estados.', supportAssignable: true },
  { key: 'referrals.review', label: 'Revisar indicações', description: 'Aprovar, sinalizar ou recusar indicações.', supportAssignable: false },
  { key: 'commissions.view', label: 'Ver comissões', description: 'Consultar valores de comissão e retenção.', supportAssignable: false },
  { key: 'commissions.reverse', label: 'Reverter comissões', description: 'Cancelar comissão e gerar ajuste financeiro.', supportAssignable: false },
  { key: 'payouts.view', label: 'Ver repasses', description: 'Consultar lotes e valores de pagamentos aos indicadores.', supportAssignable: false },
  { key: 'payouts.create', label: 'Criar repasses', description: 'Montar lotes de pagamentos.', supportAssignable: false },
  { key: 'payouts.approve', label: 'Aprovar repasses', description: 'Aprovar pagamentos pendentes.', supportAssignable: false },
  { key: 'payouts.cancel', label: 'Cancelar repasses', description: 'Cancelar pagamentos antes do envio.', supportAssignable: false },
  { key: 'payouts.send', label: 'Enviar Pix', description: 'Disparar transferências Pix.', supportAssignable: false },
  { key: 'payouts.mark_paid', label: 'Confirmar pagamento manual', description: 'Marcar um lote como pago manualmente.', supportAssignable: false },
  { key: 'pix.verify', label: 'Verificar conta Pix', description: 'Confirmar titularidade da conta Pix.', supportAssignable: false },
  { key: 'pix.reveal', label: 'Revelar chave Pix', description: 'Visualizar a chave Pix completa.', supportAssignable: false },
  { key: 'contact.view', label: 'Ver contatos', description: 'Visualizar e-mail e WhatsApp para atendimento.', supportAssignable: true },
  { key: 'founders.view_own', label: 'Ver próprios Fundadores', description: 'Consultar convites e Fundadores criados pelo próprio usuário.', supportAssignable: false },
  { key: 'founders.view_all', label: 'Ver todos os Fundadores', description: 'Consultar todos os Fundadores da plataforma.', supportAssignable: false },
  { key: 'founders.create_invite', label: 'Criar convite Founder', description: 'Gerar convite seguro para Cliente Fundador.', supportAssignable: false },
  { key: 'founders.resend_invite', label: 'Reenviar convite Founder', description: 'Rotacionar e reenviar convite Founder pendente.', supportAssignable: false },
  { key: 'founders.revoke_pending', label: 'Revogar convite Founder', description: 'Revogar convite Founder ainda pendente.', supportAssignable: false },
  { key: 'prospecting.access', label: 'Acessar Prospecção', description: 'Acessar a área comercial de prospecção.', supportAssignable: false },
  { key: 'prospecting.view_own', label: 'Ver próprios prospects', description: 'Consultar prospects atribuídos ao próprio usuário.', supportAssignable: false },
  { key: 'prospecting.view_all', label: 'Ver todos os prospects', description: 'Consultar todo o pipeline comercial.', supportAssignable: false },
  { key: 'prospecting.create', label: 'Criar prospects', description: 'Cadastrar novas oportunidades comerciais.', supportAssignable: false },
  { key: 'prospecting.edit_own', label: 'Editar próprios prospects', description: 'Atualizar oportunidades atribuídas ao próprio usuário.', supportAssignable: false },
  { key: 'performance.view_own', label: 'Ver própria performance', description: 'Consultar os próprios indicadores comerciais.', supportAssignable: false },
  { key: 'performance.view_all', label: 'Ver performance da equipe', description: 'Consultar indicadores da equipe comercial.', supportAssignable: false },  { key: 'team.manage', label: 'Gerenciar equipe', description: 'Criar e administrar acessos internos.', supportAssignable: false },
  { key: 'audit.view', label: 'Ver auditoria', description: 'Consultar histórico completo de ações internas.', supportAssignable: false },
  { key: 'settings.manage', label: 'Alterar configurações', description: 'Modificar regras críticas da plataforma.', supportAssignable: false },
]

const OWNER_ONLY = new Set<PlatformPermission>([
  'finance.view', 'affiliates.manage', 'referrals.review', 'commissions.view',
  'commissions.reverse', 'payouts.view', 'payouts.create', 'payouts.approve',
  'payouts.cancel', 'payouts.send', 'payouts.mark_paid', 'pix.verify', 'pix.reveal',
  'team.manage', 'audit.view', 'settings.manage',
  'founders.view_all', 'prospecting.view_all', 'performance.view_all',
])

const SUPPORT_ALLOWED = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.view', 'marketplace.view',
  'affiliates.view', 'referrals.view', 'contact.view',
])

const PROSPECTOR_ALLOWED = new Set<PlatformPermission>([
  'portal.access',
  'founders.view_own',
  'founders.create_invite',
  'founders.resend_invite',
  'founders.revoke_pending',
  'prospecting.access',
  'prospecting.view_own',
  'prospecting.create',
  'prospecting.edit_own',
  'performance.view_own',
])

const PROSPECTOR_DEFAULTS = new Set<PlatformPermission>([
  'portal.access',
  'founders.view_own',
  'founders.create_invite',
  'founders.resend_invite',
  'founders.revoke_pending',
  'prospecting.access',
  'prospecting.view_own',
  'prospecting.create',
  'prospecting.edit_own',
  'performance.view_own',
])

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
  if (role === 'owner' || role === 'admin' || role === 'finance' || role === 'support' || role === 'prospector') return role
  return null
}

function normalizePermissions(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, boolean> = {}
  for (const [key, allowed] of Object.entries(value)) {
    if (typeof allowed === 'boolean') result[key] = allowed
  }
  return result
}

export function isOfficialPlatformOwner(admin: Pick<PlatformAdmin, 'email' | 'role'> | null | undefined) {
  return Boolean(
    admin && admin.role === 'owner' &&
    String(admin.email || '').toLowerCase() === OFFICIAL_PLATFORM_OWNER_EMAIL,
  )
}

export function canPlatform(admin: PlatformAdmin, permission: PlatformPermission) {
  if (admin.role === 'owner') return isOfficialPlatformOwner(admin)

  if (OWNER_ONLY.has(permission)) return false

  if (admin.role === 'support') {
    if (!SUPPORT_ALLOWED.has(permission)) return false
    if (typeof admin.permissions[permission] === 'boolean') {
      return admin.permissions[permission] === true
    }
    return permission === 'portal.access' || permission === 'dashboard.view'
  }

  if (admin.role === 'prospector') {
    if (!PROSPECTOR_ALLOWED.has(permission)) return false
    if (typeof admin.permissions[permission] === 'boolean') {
      return admin.permissions[permission] === true
    }
    return PROSPECTOR_DEFAULTS.has(permission)
  }

  return false
}

export function platformCapabilities(admin: PlatformAdmin) {
  return Object.fromEntries(
    PLATFORM_PERMISSION_CATALOG.map((item) => [item.key, canPlatform(admin, item.key)]),
  ) as Record<PlatformPermission, boolean>
}

export function sanitizeSupportPermissions(value: unknown) {
  const input = normalizePermissions(value)
  const result: Record<string, boolean> = {}
  for (const permission of SUPPORT_ALLOWED) {
    result[permission] =
      permission === 'portal.access' || permission === 'dashboard.view'
        ? true
        : input[permission] === true
  }
  return result
}


export function sanitizeProspectorPermissions(value: unknown) {
  const input = normalizePermissions(value)
  const result: Record<string, boolean> = {}

  for (const permission of PROSPECTOR_ALLOWED) {
    result[permission] =
      typeof input[permission] === 'boolean'
        ? input[permission]
        : PROSPECTOR_DEFAULTS.has(permission)
  }

  result['portal.access'] = true
  result['founders.view_own'] = true
  result['prospecting.access'] = true
  result['prospecting.view_own'] = true
  result['performance.view_own'] = true

  return result
}
export async function getCurrentPlatformAdminFromRequest(request: NextRequest): Promise<PlatformAdmin | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)
  if (!requester?.email) return null

  const email = requester.email.toLowerCase()
  const adminSelect =
    'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password'

  let { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select(adminSelect)
    .eq('user_id', requester.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!error && !admin) {
    const fallback = await supabaseAdmin
      .from('platform_admins')
      .select(adminSelect)
      .is('user_id', null)
      .ilike('email', email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    admin = fallback.data
    error = fallback.error
  }

  if (error || !admin) return null
  const role = normalizeRole(admin.role)
  if (!role) return null
  if (role === 'owner' && email !== OFFICIAL_PLATFORM_OWNER_EMAIL) return null
  if (role !== 'owner' && role !== 'support' && role !== 'prospector') return null

  const resolved: PlatformAdmin = {
    id: String(admin.id),
    user_id: String(admin.user_id || requester.id),
    email,
    nome: String(admin.nome || '').trim() || email.split('@')[0] || 'Admin',
    role,
    is_active: Boolean(admin.is_active),
    permissions: normalizePermissions(admin.permissions),
    area: String(admin.area || 'Plataforma'),
    observacoes: admin.observacoes ? String(admin.observacoes) : null,
    last_login_at: admin.last_login_at ? String(admin.last_login_at) : null,
    must_change_password: Boolean(admin.must_change_password),
  }

  const patch: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (!admin.user_id) patch.user_id = requester.id
  await supabaseAdmin.from('platform_admins').update(patch).eq('id', admin.id)
  return resolved
}

export async function requirePlatformAdmin(request: NextRequest, permission?: PlatformPermission) {
  const admin = await getCurrentPlatformAdminFromRequest(request)
  if (!admin) return { ok: false as const, error: 'Acesso administrativo não encontrado.', status: 403 }
  if (permission && !canPlatform(admin, permission)) {
    return { ok: false as const, error: 'Seu perfil não possui permissão para esta ação.', status: 403 }
  }
  if (!permission && !isOfficialPlatformOwner(admin)) {
    return { ok: false as const, error: 'Esta rota é exclusiva do dono da plataforma.', status: 403 }
  }
  return { ok: true as const, admin, supabaseAdmin: getSupabaseAdmin() }
}

export async function requireOfficialPlatformOwner(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'dashboard.view')
  if (!session.ok) return session
  if (!isOfficialPlatformOwner(session.admin)) {
    return { ok: false as const, error: 'Esta área é exclusiva do dono oficial da plataforma.', status: 403 }
  }
  return session
}

export async function auditPlatformAction(
  adminEmail: string,
  action: string,
  input: { targetType?: string; targetId?: string; targetLabel?: string; payload?: Record<string, unknown> } = {},
) {
  const supabaseAdmin = getSupabaseAdmin()
  const payload = input.payload || {}
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    target_label: input.targetLabel || null,
    payload,
    metadata: payload,
  })
}
