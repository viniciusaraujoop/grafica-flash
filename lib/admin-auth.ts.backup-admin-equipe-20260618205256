import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export type AdminSession = {
  id: string
  email: string
  nome: string
  role: 'super_admin' | 'admin' | 'suporte'
  permissions: Record<string, any>
}

export async function getCurrentAdmin(request: NextRequest): Promise<AdminSession | null> {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user?.email) return null

  const email = data.user.email.toLowerCase()

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('email,nome,role,ativo,permissions')
    .eq('ativo', true)
    .ilike('email', email)
    .maybeSingle()

  if (!admin && email !== 'araujovinicius249@gmail.com') return null

  return {
    id: data.user.id,
    email,
    nome: admin?.nome || data.user.user_metadata?.nome || 'Admin',
    role: admin?.role || 'super_admin',
    permissions: admin?.permissions || { all: true },
  }
}

export function can(admin: AdminSession, permission: string) {
  if (admin.role === 'super_admin') return true
  if (admin.permissions?.all) return true
  return Boolean(admin.permissions?.[permission])
}

/**
 * Compatibilidade com rotas antigas do Admin Master.
 * Algumas rotas ainda importam requireAdmin de '@/lib/admin-auth'.
 * Mantemos esse export para o build não quebrar enquanto o admin novo usa getCurrentAdmin.
 */
export async function requireAdmin(request: NextRequest, permission?: string): Promise<any> {
  const admin = await getCurrentAdmin(request)

  if (!admin) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  if (permission && !can(admin, permission)) {
    return NextResponse.json({ error: 'Sem permissão para esta ação.' }, { status: 403 })
  }

  return admin
}

export async function auditLog(
  adminEmail: string,
  action: string,
  targetType?: string,
  targetId?: string,
  targetLabel?: string,
  payload?: any
) {
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    target_label: targetLabel || null,
    payload: payload || {},
  })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}
