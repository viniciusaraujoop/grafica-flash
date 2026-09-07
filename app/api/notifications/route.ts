import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

async function access(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  const companyAccess = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
  if (!companyAccess.company?.id) return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }

  return { supabaseAdmin, requester, companyAccess }
}

export async function GET(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const { data, error } = await result.supabaseAdmin
      .from('app_notifications')
      .select('id,tipo,titulo,mensagem,status,link_url,payload,created_at,read_at')
      .eq('company_id', result.companyAccess!.company.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    const unread = (data || []).filter((item) => item.status === 'unread').length
    return NextResponse.json({ notifications: data || [], unread })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar notificações.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : []
    const all = body.all === true
    let query = result.supabaseAdmin
      .from('app_notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('company_id', result.companyAccess!.company.id)

    if (!all) {
      if (!ids.length) return NextResponse.json({ ok: true })
      query = query.in('id', ids)
    }

    const { error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar notificações.' }, { status: 500 })
  }
}
