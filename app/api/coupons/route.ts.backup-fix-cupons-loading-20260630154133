import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function money(value: unknown) {
  return Math.max(0, Number(value || 0))
}

function payloadFromBody(body: any) {
  const codigo = normalizeCode(body.codigo || body.code)
  const tipo = body.tipo === 'fixo' ? 'fixo' : 'percentual'
  const valor = money(body.valor)
  const valorMinimoPedido = money(body.valor_minimo_pedido)
  const rawMax = body.valor_maximo_desconto === '' || body.valor_maximo_desconto === null || body.valor_maximo_desconto === undefined
    ? null
    : money(body.valor_maximo_desconto)
  const usageLimit = body.usage_limit === '' || body.usage_limit === null || body.usage_limit === undefined
    ? null
    : Math.max(1, Number(body.usage_limit || 1))

  if (!codigo) throw new Error('Informe o código do cupom.')
  if (valor <= 0) throw new Error('Informe um valor de desconto maior que zero.')
  if (tipo === 'percentual' && valor > 100) throw new Error('Cupom percentual não pode passar de 100%.')

  return {
    codigo,
    codigo_normalizado: codigo,
    descricao: String(body.descricao || '').trim() || null,
    tipo,
    valor,
    valor_minimo_pedido: valorMinimoPedido,
    valor_maximo_desconto: rawMax,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    usage_limit: usageLimit,
    ativo: body.ativo !== false,
    updated_at: new Date().toISOString(),
  }
}

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
      return NextResponse.json({ error: 'Seu perfil não pode gerenciar cupons.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('marketplace_coupons')
      .select('*')
      .eq('company_id', access.company.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ coupons: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar cupons.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Seu perfil não pode criar cupons.' }, { status: 403 })
    }

    const body = await request.json()
    const coupon = payloadFromBody(body)

    const { data, error } = await supabaseAdmin
      .from('marketplace_coupons')
      .insert({
        ...coupon,
        company_id: access.company.id,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
