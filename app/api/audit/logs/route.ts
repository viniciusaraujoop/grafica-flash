import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode ver auditoria.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_audit_logs')
      .select('*')
      .eq('company_id', access.company.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ logs: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar auditoria.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
