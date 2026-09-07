import { NextRequest, NextResponse } from 'next/server'
import {
  PLATFORM_PERMISSION_CATALOG,
  auditPlatformAction,
  canPlatform,
  requirePlatformAdmin,
  type PlatformAdmin,
  type PlatformPermission,
  type PlatformRole,
} from '@/lib/platform-admin'
import {
  buildPlatformAdminActivationUrl,
  createPlatformAdminInviteToken,
  findAuthUserByEmail,
  hashPlatformAdminInviteToken,
  normalizeTeamInviteEmail,
  platformAdminInviteExpiresAt,
  validTeamInviteEmail,
} from '@/lib/platform-admin-invites'
import { isMissingRelation } from '@/lib/admin/optional-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const inviteRoles: Exclude<PlatformRole, 'owner'>[] = ['platform_admin','finance','support','security','operations','viewer','prospector']
const areas: Record<string,string> = { platform_admin:'Plataforma', finance:'Financeiro', support:'Suporte', security:'Segurança', operations:'Operações', viewer:'Leitura', prospector:'Comercial' }

function text(value: unknown, max = 500) { return String(value || '').trim().slice(0, max) }

function rolePermissions(role: Exclude<PlatformRole,'owner'>, requested: unknown) {
  const input = requested && typeof requested === 'object' && !Array.isArray(requested) ? requested as Record<string,unknown> : {}
  const synthetic: PlatformAdmin = {
    id: 'invite-preview', user_id: 'invite-preview', email: 'invite@orcaly.invalid', nome: 'Invite', role,
    is_active: true, permissions: Object.fromEntries(Object.entries(input).filter(([,value]) => typeof value === 'boolean')) as Record<string,boolean>,
    area: areas[role] || 'Plataforma', observacoes: null, last_login_at: null, must_change_password: false,
  }
  return Object.fromEntries(PLATFORM_PERMISSION_CATALOG.map((item) => [item.key, canPlatform(synthetic, item.key as PlatformPermission)]))
}

async function extendedSchemaReady(db: PlatformAdmin extends never ? never : ReturnType<typeof import('@/lib/company-access').getSupabaseAdmin>) {
  const result = await db.from('platform_feature_flags').select('id', { head: true, count: 'exact' })
  if (result.error && isMissingRelation(result.error, 'platform_feature_flags')) return false
  if (result.error) throw result.error
  return true
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'admins.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  try {
    const schemaReady = await extendedSchemaReady(session.supabaseAdmin)
    const [team, invites] = await Promise.all([
      session.supabaseAdmin.from('platform_admins').select('id,user_id,email,nome,role,is_active,permissions,area,observacoes,last_login_at,must_change_password,created_at,updated_at').order('created_at', { ascending: true }),
      session.supabaseAdmin.from('platform_admin_invites').select('id,email,nome,role,area,status,expires_at,invited_at,activated_at,revoked_at,created_by_email').order('created_at', { ascending: false }).limit(100),
    ])
    if (team.error) throw team.error
    if (invites.error) throw invites.error
    return NextResponse.json({
      schemaReady,
      migration: schemaReady ? null : '20260819230000_admin_control_center_v2.sql',
      team: team.data || [],
      invites: invites.data || [],
      canManage: canPlatform(session.admin, 'admins.manage'),
      roleOptions: schemaReady ? inviteRoles : [],
      permissionCatalog: PLATFORM_PERMISSION_CATALOG.map((item) => ({ key: item.key, label: item.label, description: item.description })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar a equipe administrativa.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'admins.manage')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  try {
    const body = await request.json().catch(() => ({})) as Record<string,unknown>
    const action = text(body.action, 40)
    const reason = text(body.reason, 500)
    if (reason.length < 8) return NextResponse.json({ error: 'Informe um motivo com pelo menos 8 caracteres.' }, { status: 400 })

    if (action === 'create_invite') {
      const schemaReady = await extendedSchemaReady(session.supabaseAdmin)
      if (!schemaReady) return NextResponse.json({ error: 'Papéis estendidos dependem da migration do Control Center, que ainda não está aplicada neste ambiente.', schemaReady: false }, { status: 503 })
      const email = normalizeTeamInviteEmail(body.email)
      const nome = text(body.nome, 160)
      const role = text(body.role, 40) as Exclude<PlatformRole,'owner'>
      const area = text(body.area, 80) || areas[role] || 'Plataforma'
      const observacoes = text(body.observacoes, 500) || null
      if (!validTeamInviteEmail(email) || nome.length < 2 || !inviteRoles.includes(role)) return NextResponse.json({ error: 'Nome, e-mail e papel válidos são obrigatórios.' }, { status: 400 })

      const [existingAdmin, existingAuth, liveInvite] = await Promise.all([
        session.supabaseAdmin.from('platform_admins').select('id').ilike('email', email).limit(1).maybeSingle(),
        findAuthUserByEmail(session.supabaseAdmin, email),
        session.supabaseAdmin.from('platform_admin_invites').select('id,status').eq('email_normalized', email).in('status', ['pending','activating']).limit(1).maybeSingle(),
      ])
      if (existingAdmin.error) throw existingAdmin.error
      if (liveInvite.error) throw liveInvite.error
      if (existingAdmin.data?.id || existingAuth?.id || liveInvite.data?.id) return NextResponse.json({ error: 'Esse e-mail já possui acesso, conta ou convite ativo.' }, { status: 409 })

      const token = createPlatformAdminInviteToken()
      const tokenHash = hashPlatformAdminInviteToken(token)
      if (!tokenHash) throw new Error('Não foi possível gerar o token do convite.')
      const permissions = rolePermissions(role, body.permissions)
      const { data: invite, error } = await session.supabaseAdmin.from('platform_admin_invites').insert({
        email, email_normalized: email, nome, role, area, permissions, observacoes, token_hash: tokenHash,
        status: 'pending', expires_at: platformAdminInviteExpiresAt(), created_by_admin_id: session.admin.id, created_by_email: session.admin.email,
      }).select('id,email,nome,role,area,status,expires_at,invited_at').single()
      if (error) throw error
      const activationUrl = buildPlatformAdminActivationUrl(request, token)
      await auditPlatformAction(session.admin.email, 'platform_admin_invite_created', { targetType: 'platform_admin_invite', targetId: String(invite.id), targetLabel: email, payload: { reason, role, area, expires_at: invite.expires_at } })
      return NextResponse.json({ ok: true, invite, activationUrl, message: 'Convite criado. O token em claro é exibido apenas nesta resposta e não é armazenado.' })
    }

    if (action === 'set_active') {
      const id = text(body.id, 80)
      const active = body.active === true
      const { data: target, error } = await session.supabaseAdmin.from('platform_admins').select('id,user_id,email,nome,role,is_active').eq('id', id).maybeSingle()
      if (error) throw error
      if (!target) return NextResponse.json({ error: 'Administrador não encontrado.' }, { status: 404 })
      if (String(target.role).toLowerCase() === 'owner') return NextResponse.json({ error: 'A conta do Owner não pode ser alterada por esta operação.' }, { status: 403 })
      if (Boolean(target.is_active) === active) return NextResponse.json({ ok: true, idempotentReplay: true })
      const update = await session.supabaseAdmin.from('platform_admins').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
      if (update.error) throw update.error
      if (target.user_id) {
        const auth = await session.supabaseAdmin.auth.admin.getUserById(String(target.user_id))
        if (auth.data.user?.id) await session.supabaseAdmin.auth.admin.updateUserById(String(target.user_id), { app_metadata: { ...(auth.data.user.app_metadata || {}), orcaly_role: active ? target.role : `disabled_${target.role}` } })
      }
      await auditPlatformAction(session.admin.email, active ? 'platform_admin_activated' : 'platform_admin_deactivated', { targetType: 'platform_admin', targetId: id, targetLabel: String(target.email), payload: { reason, role: target.role } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }, { status: 500 })
  }
}
