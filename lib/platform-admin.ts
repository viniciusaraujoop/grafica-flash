// ORCALY_ADMIN_CONTROL_CENTER_V2
import { NextRequest } from 'next/server'
import { getRequester, getSupabaseAdmin } from '@/lib/company-access'

export const OFFICIAL_PLATFORM_OWNER_EMAIL = 'viniciusadm@orcaly.com'

export type PlatformRole =
  | 'owner'
  | 'platform_admin'
  | 'finance'
  | 'support'
  | 'security'
  | 'operations'
  | 'viewer'
  | 'prospector'

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
  | 'companies.read'
  | 'companies.write'
  | 'companies.block'
  | 'users.read'
  | 'users.manage'
  | 'billing.read'
  | 'billing.manage'
  | 'billing.refund'
  | 'partners.read'
  | 'partners.manage'
  | 'partners.payout'
  | 'support.read'
  | 'support.write'
  | 'support.impersonate_readonly'
  | 'support.impersonate_write'
  | 'system.read'
  | 'system.manage'
  | 'security.read'
  | 'security.manage'
  | 'features.read'
  | 'features.manage'
  | 'admins.read'
  | 'admins.manage'
  | 'audit.read'
  | 'webhooks.read'
  | 'webhooks.retry'
  | 'growth.read'
  | 'notifications.read'
  | 'scanner.read'
  | 'scanner.run'

export const PLATFORM_PERMISSION_CATALOG: Array<{
  key: PlatformPermission
  label: string
  description: string
  supportAssignable: boolean
}> = [
  { key: 'portal.access', label: 'Acessar portal interno', description: 'Entrar nas áreas internas compatíveis com o papel.', supportAssignable: true },
  { key: 'dashboard.view', label: 'Ver Control Center', description: 'Consultar a visão operacional permitida ao perfil.', supportAssignable: true },
  { key: 'companies.read', label: 'Ver empresas', description: 'Consultar empresas e contexto operacional.', supportAssignable: true },
  { key: 'companies.write', label: 'Editar empresas', description: 'Executar alterações administrativas permitidas.', supportAssignable: false },
  { key: 'companies.block', label: 'Bloquear empresas', description: 'Suspender ou restaurar acesso administrativo da empresa.', supportAssignable: false },
  { key: 'users.read', label: 'Ver usuários', description: 'Consultar memberships e identidade operacional.', supportAssignable: true },
  { key: 'users.manage', label: 'Gerenciar usuários', description: 'Executar ações administrativas sobre usuários.', supportAssignable: false },
  { key: 'billing.read', label: 'Ver billing', description: 'Consultar receita, assinatura e pagamentos.', supportAssignable: false },
  { key: 'billing.manage', label: 'Gerenciar billing', description: 'Executar ações manuais de assinatura permitidas.', supportAssignable: false },
  { key: 'billing.refund', label: 'Reembolsar', description: 'Autorizar fluxo de reembolso quando suportado.', supportAssignable: false },
  { key: 'partners.read', label: 'Ver parceiros', description: 'Consultar parceiros e performance.', supportAssignable: true },
  { key: 'partners.manage', label: 'Gerenciar parceiros', description: 'Gerenciar situação de parceiros e indicações.', supportAssignable: false },
  { key: 'partners.payout', label: 'Gerenciar payouts', description: 'Operar repasses do programa de parceiros.', supportAssignable: false },
  { key: 'support.read', label: 'Ver suporte', description: 'Consultar contexto e tickets de suporte.', supportAssignable: true },
  { key: 'support.write', label: 'Operar suporte', description: 'Responder e movimentar tickets.', supportAssignable: true },
  { key: 'support.impersonate_readonly', label: 'Modo suporte leitura', description: 'Visualizar contexto de uma empresa sem roubar sessão.', supportAssignable: true },
  { key: 'support.impersonate_write', label: 'Modo suporte manutenção', description: 'Executar manutenção temporária auditada quando habilitada.', supportAssignable: false },
  { key: 'system.read', label: 'Ver saúde do sistema', description: 'Consultar status e observabilidade da plataforma.', supportAssignable: true },
  { key: 'system.manage', label: 'Gerenciar sistema', description: 'Executar ações operacionais de sistema.', supportAssignable: false },
  { key: 'security.read', label: 'Ver segurança', description: 'Consultar eventos e sinais de segurança.', supportAssignable: false },
  { key: 'security.manage', label: 'Gerenciar segurança', description: 'Resolver eventos e administrar controles permitidos.', supportAssignable: false },
  { key: 'features.read', label: 'Ver feature flags', description: 'Consultar flags e resolução por escopo.', supportAssignable: false },
  { key: 'features.manage', label: 'Gerenciar feature flags', description: 'Criar e alterar flags auditadas.', supportAssignable: false },
  { key: 'admins.read', label: 'Ver equipe Admin', description: 'Consultar administradores e permissões.', supportAssignable: false },
  { key: 'admins.manage', label: 'Gerenciar equipe Admin', description: 'Criar e alterar acessos administrativos.', supportAssignable: false },
  { key: 'audit.read', label: 'Ver auditoria', description: 'Consultar trilha de ações administrativas.', supportAssignable: false },
  { key: 'webhooks.read', label: 'Ver webhooks', description: 'Inspecionar eventos sanitizados.', supportAssignable: false },
  { key: 'webhooks.retry', label: 'Reprocessar webhooks', description: 'Reprocessar eventos somente quando o domínio oferecer idempotência segura.', supportAssignable: false },
  { key: 'growth.read', label: 'Ver Growth', description: 'Consultar aquisição, conversão e parceiros.', supportAssignable: true },
  { key: 'notifications.read', label: 'Ver alertas', description: 'Consultar alertas operacionais administrativos.', supportAssignable: true },
  { key: 'scanner.read', label: 'Ver scanner', description: 'Consultar diagnósticos do scanner administrativo.', supportAssignable: false },
  { key: 'scanner.run', label: 'Executar scanner', description: 'Executar varredura administrativa auditada.', supportAssignable: false },
  { key: 'marketplace.view', label: 'Ver integrações de pagamento', description: 'Compatibilidade: consultar estado de integrações.', supportAssignable: true },
  { key: 'finance.view', label: 'Ver financeiro', description: 'Compatibilidade: visualizar financeiro da plataforma.', supportAssignable: false },
  { key: 'affiliates.view', label: 'Ver indicadores', description: 'Compatibilidade: consultar parceiros.', supportAssignable: true },
  { key: 'affiliates.manage', label: 'Gerenciar indicadores', description: 'Compatibilidade: gerenciar parceiros.', supportAssignable: false },
  { key: 'referrals.view', label: 'Ver indicações', description: 'Compatibilidade: consultar indicações.', supportAssignable: true },
  { key: 'referrals.review', label: 'Revisar indicações', description: 'Compatibilidade: revisar indicações.', supportAssignable: false },
  { key: 'commissions.view', label: 'Ver comissões', description: 'Compatibilidade: consultar comissões.', supportAssignable: false },
  { key: 'commissions.reverse', label: 'Reverter comissões', description: 'Compatibilidade: reverter comissão com auditoria.', supportAssignable: false },
  { key: 'payouts.view', label: 'Ver repasses', description: 'Compatibilidade: consultar payouts.', supportAssignable: false },
  { key: 'payouts.create', label: 'Criar repasses', description: 'Compatibilidade: criar lotes.', supportAssignable: false },
  { key: 'payouts.approve', label: 'Aprovar repasses', description: 'Compatibilidade: aprovar payouts.', supportAssignable: false },
  { key: 'payouts.cancel', label: 'Cancelar repasses', description: 'Compatibilidade: cancelar payouts.', supportAssignable: false },
  { key: 'payouts.send', label: 'Enviar Pix', description: 'Compatibilidade: enviar payout.', supportAssignable: false },
  { key: 'payouts.mark_paid', label: 'Confirmar pagamento manual', description: 'Compatibilidade: confirmar payout.', supportAssignable: false },
  { key: 'pix.verify', label: 'Verificar Pix', description: 'Compatibilidade: verificar conta Pix.', supportAssignable: false },
  { key: 'pix.reveal', label: 'Revelar Pix', description: 'Compatibilidade: revelar chave Pix auditada.', supportAssignable: false },
  { key: 'contact.view', label: 'Ver contatos', description: 'Compatibilidade: ver contatos necessários ao atendimento.', supportAssignable: true },
  { key: 'team.manage', label: 'Gerenciar equipe', description: 'Compatibilidade: gerenciar equipe interna.', supportAssignable: false },
  { key: 'audit.view', label: 'Ver auditoria legada', description: 'Compatibilidade com rotas existentes.', supportAssignable: false },
  { key: 'settings.manage', label: 'Alterar configurações', description: 'Compatibilidade com configurações existentes.', supportAssignable: false },
  { key: 'companies.view', label: 'Ver assinantes', description: 'Compatibilidade com rotas existentes.', supportAssignable: true },
  { key: 'founders.view_own', label: 'Ver próprios Fundadores', description: 'Consultar Fundadores do próprio prospector.', supportAssignable: false },
  { key: 'founders.view_all', label: 'Ver todos os Fundadores', description: 'Consultar todos os Fundadores.', supportAssignable: false },
  { key: 'founders.create_invite', label: 'Criar convite Founder', description: 'Gerar convite seguro.', supportAssignable: false },
  { key: 'founders.resend_invite', label: 'Reenviar convite Founder', description: 'Rotacionar e reenviar convite.', supportAssignable: false },
  { key: 'founders.revoke_pending', label: 'Revogar convite Founder', description: 'Revogar convite pendente.', supportAssignable: false },
  { key: 'prospecting.access', label: 'Acessar Prospecção', description: 'Acessar área comercial.', supportAssignable: false },
  { key: 'prospecting.view_own', label: 'Ver próprios prospects', description: 'Consultar prospects próprios.', supportAssignable: false },
  { key: 'prospecting.view_all', label: 'Ver todos os prospects', description: 'Consultar pipeline completo.', supportAssignable: false },
  { key: 'prospecting.create', label: 'Criar prospects', description: 'Cadastrar oportunidades.', supportAssignable: false },
  { key: 'prospecting.edit_own', label: 'Editar próprios prospects', description: 'Atualizar oportunidades próprias.', supportAssignable: false },
  { key: 'performance.view_own', label: 'Ver própria performance', description: 'Consultar performance própria.', supportAssignable: false },
  { key: 'performance.view_all', label: 'Ver performance da equipe', description: 'Consultar performance da equipe.', supportAssignable: false },
]

const LEGACY_ALIAS: Partial<Record<PlatformPermission, PlatformPermission>> = {
  'companies.view': 'companies.read',
  'finance.view': 'billing.read',
  'affiliates.view': 'partners.read',
  'affiliates.manage': 'partners.manage',
  'referrals.view': 'partners.read',
  'referrals.review': 'partners.manage',
  'commissions.view': 'billing.read',
  'commissions.reverse': 'partners.payout',
  'payouts.view': 'partners.payout',
  'payouts.create': 'partners.payout',
  'payouts.approve': 'partners.payout',
  'payouts.cancel': 'partners.payout',
  'payouts.send': 'partners.payout',
  'payouts.mark_paid': 'partners.payout',
  'pix.verify': 'partners.payout',
  'pix.reveal': 'partners.payout',
  'team.manage': 'admins.manage',
  'audit.view': 'audit.read',
  'settings.manage': 'system.manage',
}

const READ_ONLY = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.read', 'companies.view', 'users.read',
  'billing.read', 'finance.view', 'partners.read', 'affiliates.view', 'referrals.view',
  'support.read', 'system.read', 'security.read', 'features.read', 'admins.read',
  'audit.read', 'audit.view', 'webhooks.read', 'growth.read', 'notifications.read',
  'scanner.read', 'marketplace.view', 'contact.view',
])

const PLATFORM_ADMIN_DEFAULTS = new Set<PlatformPermission>([
  ...READ_ONLY,
  'companies.write', 'companies.block', 'users.manage', 'billing.manage',
  'partners.manage', 'support.write', 'support.impersonate_readonly', 'system.manage',
  'security.manage', 'features.manage', 'webhooks.retry', 'scanner.run',
  'affiliates.manage', 'referrals.review', 'settings.manage',
])

const FINANCE_DEFAULTS = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.read', 'companies.view', 'users.read',
  'billing.read', 'billing.manage', 'finance.view', 'partners.read', 'affiliates.view',
  'referrals.view', 'partners.payout', 'commissions.view', 'payouts.view', 'payouts.create',
  'payouts.approve', 'payouts.cancel', 'payouts.send', 'payouts.mark_paid', 'pix.verify',
  'pix.reveal', 'audit.read', 'audit.view', 'growth.read', 'notifications.read',
])

const SUPPORT_DEFAULTS = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.read', 'companies.view', 'users.read',
  'support.read', 'support.write', 'support.impersonate_readonly', 'system.read',
  'partners.read', 'affiliates.view', 'referrals.view', 'marketplace.view', 'contact.view',
  'notifications.read', 'growth.read',
])

const SECURITY_DEFAULTS = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.read', 'users.read', 'security.read',
  'security.manage', 'system.read', 'audit.read', 'audit.view', 'webhooks.read',
  'notifications.read', 'scanner.read', 'scanner.run',
])

const OPERATIONS_DEFAULTS = new Set<PlatformPermission>([
  ...READ_ONLY,
  'companies.write', 'support.write', 'support.impersonate_readonly', 'system.manage',
])

const PROSPECTOR_DEFAULTS = new Set<PlatformPermission>([
  'portal.access', 'founders.view_own', 'founders.create_invite', 'founders.resend_invite',
  'founders.revoke_pending', 'prospecting.access', 'prospecting.view_own',
  'prospecting.create', 'prospecting.edit_own', 'performance.view_own',
])

const ROLE_DEFAULTS: Record<Exclude<PlatformRole, 'owner'>, Set<PlatformPermission>> = {
  platform_admin: PLATFORM_ADMIN_DEFAULTS,
  finance: FINANCE_DEFAULTS,
  support: SUPPORT_DEFAULTS,
  security: SECURITY_DEFAULTS,
  operations: OPERATIONS_DEFAULTS,
  viewer: READ_ONLY,
  prospector: PROSPECTOR_DEFAULTS,
}

const ROLE_CAPS: Record<Exclude<PlatformRole, 'owner'>, Set<PlatformPermission>> = {
  platform_admin: new Set(PLATFORM_PERMISSION_CATALOG.map((item) => item.key).filter((key) => !['billing.refund', 'support.impersonate_write', 'admins.manage'].includes(key))),
  finance: new Set([...FINANCE_DEFAULTS, 'billing.refund']),
  support: SUPPORT_DEFAULTS,
  security: SECURITY_DEFAULTS,
  operations: new Set([...OPERATIONS_DEFAULTS, 'companies.block', 'users.manage', 'webhooks.retry']),
  viewer: READ_ONLY,
  prospector: PROSPECTOR_DEFAULTS,
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
  if (role === 'super_admin' || role === 'owner') return 'owner'
  if (role === 'admin' || role === 'platform_admin') return 'platform_admin'
  if (role === 'suporte' || role === 'support') return 'support'
  if (role === 'financeiro' || role === 'finance') return 'finance'
  if (role === 'seguranca' || role === 'security') return 'security'
  if (role === 'operacoes' || role === 'operations') return 'operations'
  if (role === 'visualizador' || role === 'viewer') return 'viewer'
  if (role === 'prospector') return 'prospector'
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
  return Boolean(admin && admin.role === 'owner' && String(admin.email || '').toLowerCase() === OFFICIAL_PLATFORM_OWNER_EMAIL)
}

function explicitPermission(admin: PlatformAdmin, permission: PlatformPermission) {
  if (typeof admin.permissions[permission] === 'boolean') return admin.permissions[permission]
  const canonical = LEGACY_ALIAS[permission] || permission
  if (canonical !== permission && typeof admin.permissions[canonical] === 'boolean') return admin.permissions[canonical]
  return undefined
}

export function canPlatform(admin: PlatformAdmin, permission: PlatformPermission) {
  if (admin.role === 'owner') return isOfficialPlatformOwner(admin)
  const canonical = LEGACY_ALIAS[permission] || permission
  const cap = ROLE_CAPS[admin.role]
  if (!cap.has(permission) && !cap.has(canonical)) return false
  const explicit = explicitPermission(admin, permission)
  if (typeof explicit === 'boolean') return explicit
  const defaults = ROLE_DEFAULTS[admin.role]
  return defaults.has(permission) || defaults.has(canonical)
}

export function platformCapabilities(admin: PlatformAdmin) {
  return Object.fromEntries(PLATFORM_PERMISSION_CATALOG.map((item) => [item.key, canPlatform(admin, item.key)])) as Record<PlatformPermission, boolean>
}

export function sanitizeSupportPermissions(value: unknown) {
  const input = normalizePermissions(value)
  const result: Record<string, boolean> = {}
  for (const permission of SUPPORT_DEFAULTS) {
    result[permission] = typeof input[permission] === 'boolean' ? input[permission] : true
  }
  result['portal.access'] = true
  result['dashboard.view'] = true
  return result
}

export function sanitizeProspectorPermissions(value: unknown) {
  const input = normalizePermissions(value)
  const result: Record<string, boolean> = {}
  for (const permission of PROSPECTOR_DEFAULTS) {
    result[permission] = typeof input[permission] === 'boolean' ? input[permission] : true
  }
  result['portal.access'] = true
  result['founders.view_own'] = true
  result['prospecting.access'] = true
  result['prospecting.view_own'] = true
  result['performance.view_own'] = true
  return result
}

const SECRET_KEY = /password|authorization|access[_-]?token|refresh[_-]?token|service[_-]?role|client[_-]?secret|webhook[_-]?secret|verify[_-]?token|cvv|card[_-]?(number|data)|raw_(payment|webhook|subscription|authorized_payment)/i

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]'
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditPayload(item, depth + 1))
  if (typeof value !== 'object') return String(value)
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    output[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeAuditPayload(item, depth + 1)
  }
  return output
}

export async function getCurrentPlatformAdminFromRequest(request: NextRequest): Promise<PlatformAdmin | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)
  if (!requester?.email) return null
  const email = requester.email.toLowerCase()
  const adminSelect = 'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password'

  let { data: admin, error } = await supabaseAdmin.from('platform_admins').select(adminSelect).eq('user_id', requester.id).eq('is_active', true).limit(1).maybeSingle()
  if (!error && !admin) {
    const fallback = await supabaseAdmin.from('platform_admins').select(adminSelect).is('user_id', null).ilike('email', email).eq('is_active', true).limit(1).maybeSingle()
    admin = fallback.data
    error = fallback.error
  }
  if (error || !admin) return null

  const role = normalizeRole(admin.role)
  if (!role) return null
  if (role === 'owner' && email !== OFFICIAL_PLATFORM_OWNER_EMAIL) return null

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

  const patch: Record<string, unknown> = { last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (!admin.user_id) patch.user_id = requester.id
  await supabaseAdmin.from('platform_admins').update(patch).eq('id', admin.id)
  return resolved
}

export async function requirePlatformAdmin(request: NextRequest, permission?: PlatformPermission) {
  const admin = await getCurrentPlatformAdminFromRequest(request)
  if (!admin) return { ok: false as const, error: 'Acesso administrativo não encontrado.', status: 403 }
  if (permission && !canPlatform(admin, permission)) return { ok: false as const, error: 'Seu perfil não possui permissão para esta ação.', status: 403 }
  if (!permission && !isOfficialPlatformOwner(admin)) return { ok: false as const, error: 'Esta rota é exclusiva do dono da plataforma.', status: 403 }
  return { ok: true as const, admin, supabaseAdmin: getSupabaseAdmin() }
}

export async function requireOfficialPlatformOwner(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'dashboard.view')
  if (!session.ok) return session
  if (!isOfficialPlatformOwner(session.admin)) return { ok: false as const, error: 'Esta área é exclusiva do dono oficial da plataforma.', status: 403 }
  return session
}

export async function auditPlatformAction(
  adminEmail: string,
  action: string,
  input: { targetType?: string; targetId?: string; targetLabel?: string; payload?: Record<string, unknown> } = {},
) {
  const supabaseAdmin = getSupabaseAdmin()
  const safe = sanitizeAuditPayload(input.payload || {}) as Record<string, unknown>
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    target_label: input.targetLabel || null,
    payload: safe,
    metadata: safe,
  })
}
