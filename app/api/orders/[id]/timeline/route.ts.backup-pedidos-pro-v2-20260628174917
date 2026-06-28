import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('order_status_history')
      .select('*')
      .eq('order_id', id)
      .eq('company_id', access.company.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ timeline: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar timeline.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
