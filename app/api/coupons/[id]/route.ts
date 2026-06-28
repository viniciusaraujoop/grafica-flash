import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

type RouteContext = {
  params: Promise<{ id: string }>
}

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function money(value: unknown) {
  return Math.max(0, Number(value || 0))
}

function cleanUpdate(body: any) {
  const update: Record<string, any> = {}

  if (body.codigo !== undefined || body.code !== undefined) {
    const codigo = normalizeCode(body.codigo || body.code)
    if (!codigo) throw new Error('Informe o código do cupom.')
    update.codigo = codigo
    update.codigo_normalizado = codigo
  }

  if (body.descricao !== undefined) update.descricao = String(body.descricao || '').trim() || null

  if (body.tipo !== undefined) {
    update.tipo = body.tipo === 'fixo' ? 'fixo' : 'percentual'
  }

  if (body.valor !== undefined) {
    const valor = money(body.valor)
    if (valor <= 0) throw new Error('Informe um valor de desconto maior que zero.')
    update.valor = valor
  }

  if (body.valor_minimo_pedido !== undefined) {
    update.valor_minimo_pedido = money(body.valor_minimo_pedido)
  }

  if (body.valor_maximo_desconto !== undefined) {
    update.valor_maximo_desconto = body.valor_maximo_desconto === '' || body.valor_maximo_desconto === null
      ? null
      : money(body.valor_maximo_desconto)
  }

  if (body.starts_at !== undefined) update.starts_at = body.starts_at || null
  if (body.ends_at !== undefined) update.ends_at = body.ends_at || null
  if (body.usage_limit !== undefined) {
    update.usage_limit = body.usage_limit === '' || body.usage_limit === null
      ? null
      : Math.max(1, Number(body.usage_limit || 1))
  }
  if (body.ativo !== undefined) update.ativo = Boolean(body.ativo)

  update.updated_at = new Date().toISOString()
  return update
}

async function ensureAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  if (!access.canManage) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Seu perfil não pode gerenciar cupons.' }, { status: 403 }) }
  }

  return { supabaseAdmin, access }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const accessResult = await ensureAccess(request)

    if ('error' in accessResult && accessResult.error) return accessResult.error

    const body = await request.json()
    const update = cleanUpdate(body)

    const { data, error } = await accessResult.supabaseAdmin
      .from('marketplace_coupons')
      .update(update)
      .eq('id', id)
      .eq('company_id', accessResult.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const accessResult = await ensureAccess(request)

    if ('error' in accessResult && accessResult.error) return accessResult.error

    const { data, error } = await accessResult.supabaseAdmin
      .from('marketplace_coupons')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', accessResult.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao desativar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
