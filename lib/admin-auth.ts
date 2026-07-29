import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'invalid-service-role'

export const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type AdminSession = {
  id: string
  email: string
  nome: string
  role: 'super_admin' | 'admin' | 'suporte'
  permissions: Record<string, unknown>
}

export type RequireAdminOk = AdminSession & {
  ok: true
  supabaseAdmin: typeof supabaseAdmin
}

export type RequireAdminError = {
  ok: false
  error: string
  status: number
}

export async function getCurrentAdmin(
  request: NextRequest,
): Promise<AdminSession | null> {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user?.email) return null

  const email = data.user.email.toLowerCase()
  const { data: admin, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('email,nome,role,ativo,permissions')
    .eq('ativo', true)
    .ilike('email', email)
    .maybeSingle()

  if (adminError || !admin) return null

  return {
    id: data.user.id,
    email,
    nome: admin.nome || 'Admin',
    role: admin.role,
    permissions:
      admin.permissions &&
      typeof admin.permissions === 'object' &&
      !Array.isArray(admin.permissions)
        ? admin.permissions
        : {},
  }
}

export function can(admin: AdminSession, permission: string) {
  if (admin.role === 'super_admin') return true
  if (admin.permissions?.all === true) return true
  return admin.permissions?.[permission] === true
}

export async function requireAdmin(
  request: NextRequest,
  permission?: string,
): Promise<RequireAdminOk | RequireAdminError> {
  const admin = await getCurrentAdmin(request)

  if (!admin) {
    return { ok: false, error: 'Acesso negado.', status: 403 }
  }

  if (permission && !can(admin, permission)) {
    return { ok: false, error: 'Sem permissao para esta acao.', status: 403 }
  }

  return { ...admin, ok: true, supabaseAdmin }
}

export async function auditLog(
  adminEmail: string,
  action: string,
  targetType?: string,
  targetId?: string,
  targetLabel?: string,
  payload?: unknown,
) {
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    target_label: targetLabel || null,
    payload:
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {},
  })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}
