import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AdminSupabaseClient = any

export type AdminCheck =
  | {
      ok: true
      email: string
      role: string
      supabaseAdmin: AdminSupabaseClient
    }
  | {
      ok: false
      error: string
      status: number
      supabaseAdmin?: AdminSupabaseClient
    }

export function getSupabaseAdmin(): AdminSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis do Supabase não configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as AdminSupabaseClient
}

export async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  const supabaseAdmin = getSupabaseAdmin()
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return {
      ok: false,
      error: 'Token não enviado.',
      status: 401,
      supabaseAdmin,
    }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !userData.user?.email) {
    return {
      ok: false,
      error: 'Sessão inválida.',
      status: 401,
      supabaseAdmin,
    }
  }

  const email = String(userData.user.email).toLowerCase()

  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('email, role, ativo')
    .eq('email', email)
    .eq('ativo', true)
    .maybeSingle()

  if (adminError || !adminData) {
    return {
      ok: false,
      error: 'Acesso de administrador negado.',
      status: 403,
      supabaseAdmin,
    }
  }

  return {
    ok: true,
    email,
    role: adminData.role || 'admin',
    supabaseAdmin,
  }
}

export function isCronAuthorized(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim()
  const headerSecret = request.headers.get('x-admin-scan-secret') || ''
  const querySecret = request.nextUrl.searchParams.get('secret') || ''

  const secrets = [
    process.env.ADMIN_SCAN_SECRET,
    process.env.CRON_SECRET,
  ].filter(Boolean)

  return secrets.some((secret) => secret === bearer || secret === headerSecret || secret === querySecret)
}
