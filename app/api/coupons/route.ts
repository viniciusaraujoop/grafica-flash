import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function normalizeCode(value: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toDateOrNull(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
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

export async function GET(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const { data, error } = await result.supabaseAdmin
      .from('marketplace_coupons')
      .select('*')
      .eq('company_id', result.access!.company.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ coupons: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar cupons. Rode o SQL do pacote no Supabase se ainda não rodou.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const codigo = normalizeCode(body.codigo || body.code || '')

    if (!codigo || codigo.length < 3) {
      return NextResponse.json({ error: 'O cupom precisa ter pelo menos 3 caracteres.' }, { status: 400 })
    }

    const tipoEntrada = String(body.tipo || body.coupon_type || '').toLowerCase()
    const cupomFreteGratis = ['frete_gratis', 'free_delivery', 'frete-gratis'].includes(tipoEntrada)
    const tipo = cupomFreteGratis ? 'fixo' : body.tipo === 'fixo' ? 'fixo' : 'percentual'
    const coupon_type = cupomFreteGratis ? 'free_delivery' : tipo === 'fixo' ? 'fixed' : 'percentage'
    const valor = cupomFreteGratis ? 0 : toNumber(body.valor, 0)

    if (!cupomFreteGratis && valor <= 0) {
      return NextResponse.json({ error: 'Informe um valor de desconto maior que zero.' }, { status: 400 })
    }

    if (!cupomFreteGratis && tipo === 'percentual' && valor > 100) {
      return NextResponse.json({ error: 'Cupom percentual não pode passar de 100%.' }, { status: 400 })
    }

    const payload = {
      company_id: result.access!.company.id,
      codigo,
      codigo_normalizado: codigo,
      descricao: body.descricao || null,
      tipo,
      coupon_type,
      free_delivery: cupomFreteGratis,
      valor,
      valor_minimo_pedido: toNumber(body.valor_minimo_pedido, 0),
      valor_maximo_desconto: body.valor_maximo_desconto === '' || body.valor_maximo_desconto === null || body.valor_maximo_desconto === undefined ? null : toNumber(body.valor_maximo_desconto, 0),
      starts_at: toDateOrNull(body.starts_at),
      ends_at: toDateOrNull(body.ends_at),
      usage_limit: body.usage_limit === '' || body.usage_limit === null || body.usage_limit === undefined ? null : Math.max(1, Math.floor(toNumber(body.usage_limit, 1))),
      ativo: body.ativo !== false,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await result.supabaseAdmin
      .from('marketplace_coupons')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Esse código de cupom já existe para esta empresa.' }, { status: 409 })
      }

      throw error
    }

    return NextResponse.json({ ok: true, coupon: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
