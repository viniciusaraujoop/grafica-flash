import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

async function access(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const companyAccess = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!companyAccess.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, companyAccess }
}

export async function GET(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const { data, error } = await result.supabaseAdmin
      .from('app_notifications')
      .select('*')
      .eq('company_id', result.companyAccess!.company.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const unread = (data || []).filter((item: any) => item.status === 'unread').length

    return NextResponse.json({ notifications: data || [], unread })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar notificações.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids : []
    const all = body.all === true

    let query = result.supabaseAdmin
      .from('app_notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('company_id', result.companyAccess!.company.id)

    if (!all) {
      if (ids.length === 0) return NextResponse.json({ ok: true })
      query = query.in('id', ids)
    }

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar notificações.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
