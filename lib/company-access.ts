import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export type CurrentRole =
  | 'dono'
  | 'gerente'
  | 'atendente'
  | 'producao'
  | 'super_admin'
  | 'funcionario'

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variaveis do Supabase nao configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function isUuid(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export async function getRequester(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) return null
  return data.user
}

export function assinaturaEstaAtiva(company: Record<string, unknown> | null) {
  if (!company) return false

  const status = String(company.assinatura_status || '').toLowerCase()

  if (status === 'trialing') {
    const trialEnd =
      company.trial_ends_at ||
      company.founder_trial_ends_at ||
      company.assinatura_expira_em

    if (!trialEnd) return false

    const expiresAt = new Date(String(trialEnd))
    return (
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt > new Date()
    )
  }

  if (status !== 'ativa') return false
  if (!company.assinatura_expira_em) return true

  const expiresAt = new Date(
    String(company.assinatura_expira_em),
  )

  return (
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt > new Date()
  )
}

export function permissionsByRole(
  role: CurrentRole | null,
  isAdminMaster = false,
) {
  const value = String(role || '').toLowerCase()
  const isOwner = value === 'dono'
  const isManager = value === 'gerente'
  const isAttendant = value === 'atendente'
  const isProduction = value === 'producao'

  return {
    isOwner,
    isAdminMaster,
    canManage: isAdminMaster || isOwner || isManager,
    canFinance: isAdminMaster || isOwner || isManager,
    canConfig: isAdminMaster || isOwner,
    canProducts: isAdminMaster || isOwner || isManager || isProduction,
    canProposal: isAdminMaster || isOwner || isManager || isAttendant,
    canSubscription: isAdminMaster || isOwner || isManager,
    canProduction: isAdminMaster || isOwner || isManager || isProduction,
  }
}

async function getAdminRole(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email?: string | null,
) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabaseAdmin
    .from('platform_admins')
    .select('role,is_active')
    .eq('is_active', true)
    .ilike('email', normalized)
    .maybeSingle()

  if (error) throw error

  return data?.role
    ? String(data.role).trim().toLowerCase()
    : null
}

export async function getCompanyAccess(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email?: string | null,
) {
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster =
    adminRole === 'owner' ||
    adminRole === 'super_admin'

  if (!isUuid(userId)) {
    return {
      company: null,
      role: null,
      ...permissionsByRole(null, isAdminMaster),
    }
  }

  const { data: ownerCompany, error: ownerError } = await supabaseAdmin
    .from('companies')
    .select('*')
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .limit(1)
    .maybeSingle()

  if (ownerError) throw ownerError

  if (ownerCompany?.id) {
    const role: CurrentRole = isAdminMaster ? 'super_admin' : 'dono'
    return {
      company: ownerCompany,
      role,
      ...permissionsByRole(role, isAdminMaster),
    }
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('company_members')
    .select('company_id,cargo,status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle()

  if (memberError) throw memberError

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError

    const role = (member.cargo || 'funcionario') as CurrentRole
    return {
      company,
      role: isAdminMaster ? 'super_admin' : role,
      ...permissionsByRole(role, isAdminMaster),
    }
  }

  if (isAdminMaster) {
    const { data: adminCompany, error: adminCompanyError } =
      await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('slug', 'grafica-flash')
        .maybeSingle()

    if (adminCompanyError) throw adminCompanyError

    if (adminCompany?.id) {
      return {
        company: adminCompany,
        role: 'super_admin' as CurrentRole,
        ...permissionsByRole('dono', true),
      }
    }
  }

  return {
    company: null,
    role: null,
    ...permissionsByRole(null, isAdminMaster),
  }
}
