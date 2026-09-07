import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

type Context = {
  params: Promise<{ id: string }>
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
  const companyId = String(access.company?.id || '').trim()

  if (!isUuid(companyId)) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, access, companyId }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const rawBody: unknown = await request.json().catch(() => null)
    const body = asRecord(rawBody)
    if (!body) return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.ativo !== undefined) update.ativo = Boolean(body.ativo)
    if (body.descricao !== undefined) update.descricao = body.descricao || null
    if (body.tipo !== undefined || body.coupon_type !== undefined) {
      const tipoEntrada = String(body.tipo || body.coupon_type || '').toLowerCase()
      const cupomFreteGratis = ['frete_gratis', 'free_delivery', 'frete-gratis'].includes(tipoEntrada)
      update.tipo = cupomFreteGratis ? 'fixo' : body.tipo === 'fixo' ? 'fixo' : body.tipo === 'percentual' ? 'percentual' : update.tipo
      update.coupon_type = cupomFreteGratis ? 'free_delivery' : update.tipo === 'fixo' ? 'fixed' : 'percentage'
      update.free_delivery = cupomFreteGratis
      if (cupomFreteGratis) update.valor = 0
    }
    if (body.valor !== undefined) update.valor = update.free_delivery ? 0 : Number(body.valor || 0)
    if (body.valor_minimo_pedido !== undefined) update.valor_minimo_pedido = Number(body.valor_minimo_pedido || 0)
    if (body.valor_maximo_desconto !== undefined) update.valor_maximo_desconto = body.valor_maximo_desconto === '' || body.valor_maximo_desconto === null ? null : Number(body.valor_maximo_desconto || 0)
    if (body.starts_at !== undefined) update.starts_at = body.starts_at ? new Date(String(body.starts_at)).toISOString() : null
    if (body.ends_at !== undefined) update.ends_at = body.ends_at ? new Date(String(body.ends_at)).toISOString() : null
    if (body.usage_limit !== undefined) update.usage_limit = body.usage_limit === '' || body.usage_limit === null ? null : Math.max(1, Math.floor(Number(body.usage_limit || 1)))

    const { data, error } = await result.supabaseAdmin
      .from('marketplace_coupons')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.companyId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
