import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canProduction) return NextResponse.json({ error: 'Seu perfil não pode alterar produção.' }, { status: 403 })

    const body = await request.json()
    const id = String(body.id || '')

    if (!isUuid(id)) return NextResponse.json({ error: 'Ordem inválida.' }, { status: 400 })

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    for (const key of ['status', 'priority', 'responsible_name', 'internal_notes']) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    if (body.due_date !== undefined) update.due_date = body.due_date || null
    if (body.files !== undefined) update.files = Array.isArray(body.files) ? body.files : []

    const { data, error } = await supabaseAdmin
      .from('production_orders')
      .update(update)
      .eq('id', id)
      .eq('company_id', access.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, order: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar produção.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
