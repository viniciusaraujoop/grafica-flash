import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

type Context = {
  params: Promise<{ id: string }>
}

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, access }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const update: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.ativo !== undefined) update.ativo = Boolean(body.ativo)
    if (body.descricao !== undefined) update.descricao = body.descricao || null
    if (body.valor !== undefined) update.valor = Number(body.valor || 0)
    if (body.valor_minimo_pedido !== undefined) update.valor_minimo_pedido = Number(body.valor_minimo_pedido || 0)
    if (body.valor_maximo_desconto !== undefined) update.valor_maximo_desconto = body.valor_maximo_desconto === '' || body.valor_maximo_desconto === null ? null : Number(body.valor_maximo_desconto || 0)
    if (body.starts_at !== undefined) update.starts_at = body.starts_at ? new Date(String(body.starts_at)).toISOString() : null
    if (body.ends_at !== undefined) update.ends_at = body.ends_at ? new Date(String(body.ends_at)).toISOString() : null
    if (body.usage_limit !== undefined) update.usage_limit = body.usage_limit === '' || body.usage_limit === null ? null : Math.max(1, Math.floor(Number(body.usage_limit || 1)))

    const { data, error } = await result.supabaseAdmin
      .from('marketplace_coupons')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
