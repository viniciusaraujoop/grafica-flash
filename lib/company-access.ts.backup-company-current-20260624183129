import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variáveis do Supabase não configuradas.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function isUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function getRequester(request: NextRequest, supabaseAdmin: any) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export function canManage(role: string | null, email?: string | null) {
  const r = String(role || '').toLowerCase()
  const e = String(email || '').toLowerCase()
  return ['dono', 'gerente', 'admin', 'super_admin'].includes(r) || e === 'araujovinicius249@gmail.com'
}

export async function getCompanyAccess(supabaseAdmin: any, userId: string, email?: string | null) {
  if (!isUuid(userId)) return { company: null, role: null, canManage: false }

  const { data: ownerCompany, error: ownerError } = await supabaseAdmin
    .from('companies').select('*')
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .limit(1).maybeSingle()

  if (ownerError) throw ownerError
  if (ownerCompany?.id) return { company: ownerCompany, role: 'dono', canManage: true }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('company_members').select('company_id,cargo,status')
    .eq('user_id', userId).eq('status', 'ativo').limit(1).maybeSingle()

  if (memberError) throw memberError

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies').select('*').eq('id', member.company_id).maybeSingle()
    if (companyError) throw companyError
    return { company, role: member.cargo || 'funcionario', canManage: canManage(member.cargo, email) }
  }

  if (String(email || '').toLowerCase() === 'araujovinicius249@gmail.com') {
    const { data: company } = await supabaseAdmin
      .from('companies').select('*').eq('slug', 'grafica-flash').maybeSingle()
    if (company?.id) return { company, role: 'super_admin', canManage: true }
  }

  return { company: null, role: null, canManage: false }
}
