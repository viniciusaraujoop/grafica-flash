import { NextRequest } from 'next/server'
import { getRequester, getSupabaseAdmin } from '@/lib/company-access'

export type PlatformAdmin = {
  id: string
  user_id: string | null
  email: string
  role: string
  is_active: boolean
}

const allowedRoles = new Set(['owner', 'admin', 'finance', 'support', 'super_admin'])

export async function getCurrentPlatformAdminFromRequest(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester?.email) return null

  const email = requester.email.toLowerCase()

  const { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select('id,user_id,email,role,is_active')
    .or(`user_id.eq.${requester.id},email.ilike.${email}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !admin) return null

  const role = String(admin.role || '').toLowerCase()
  if (!allowedRoles.has(role)) return null

  if (!admin.user_id) {
    await supabaseAdmin
      .from('platform_admins')
      .update({ user_id: requester.id, updated_at: new Date().toISOString() })
      .eq('id', admin.id)
  }

  return {
    ...admin,
    user_id: admin.user_id || requester.id,
    email,
  } as PlatformAdmin
}

export async function requirePlatformAdmin(request: NextRequest) {
  const admin = await getCurrentPlatformAdminFromRequest(request)
  if (!admin) return { ok: false as const, error: 'Acesso não encontrado.', status: 404 }
  return { ok: true as const, admin, supabaseAdmin: getSupabaseAdmin() }
}
