import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function money(value: unknown) {
  return Math.max(0, Number(value || 0))
}

function validateCoupon(coupon: any, subtotal: number) {
  const now = new Date()

  if (!coupon || coupon.ativo === false) {
    return { valid: false, reason: 'Cupom inválido ou inativo.' }
  }

  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { valid: false, reason: 'Cupom ainda não está disponível.' }
  }

  if (coupon.ends_at && new Date(coupon.ends_at) < now) {
    return { valid: false, reason: 'Cupom expirado.' }
  }

  if (coupon.usage_limit && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) {
    return { valid: false, reason: 'Cupom atingiu o limite de uso.' }
  }

  const minOrder = money(coupon.valor_minimo_pedido)

  if (minOrder > 0 && subtotal < minOrder) {
    return {
      valid: false,
      reason: `Pedido mínimo de ${minOrder.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para usar este cupom.`,
    }
  }

  const value = money(coupon.valor)
  const maxDiscount = coupon.valor_maximo_desconto === null || coupon.valor_maximo_desconto === undefined
    ? null
    : money(coupon.valor_maximo_desconto)

  let discount = coupon.tipo === 'fixo'
    ? value
    : subtotal * (value / 100)

  if (maxDiscount !== null && maxDiscount > 0) {
    discount = Math.min(discount, maxDiscount)
  }

  discount = Math.min(subtotal, Math.max(0, Number(discount.toFixed(2))))

  if (discount <= 0) {
    return { valid: false, reason: 'Este cupom não gerou desconto para o pedido atual.' }
  }

  return {
    valid: true,
    discount,
    total: Math.max(0, Number((subtotal - discount).toFixed(2))),
    coupon: {
      id: coupon.id,
      codigo: coupon.codigo,
      tipo: coupon.tipo,
      valor: Number(coupon.valor || 0),
      valor_minimo_pedido: Number(coupon.valor_minimo_pedido || 0),
      valor_maximo_desconto: coupon.valor_maximo_desconto === null ? null : Number(coupon.valor_maximo_desconto || 0),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const companyId = String(body.company_id || body.companyId || '')
    const code = normalizeCode(body.codigo || body.code || body.coupon_code)
    const subtotal = money(body.subtotal)

    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json({ error: 'Informe o código do cupom.' }, { status: 400 })
    }

    const { data: coupon, error } = await supabaseAdmin
      .from('marketplace_coupons')
      .select('*')
      .eq('company_id', companyId)
      .eq('codigo_normalizado', code)
      .maybeSingle()

    if (error) throw error

    const result = validateCoupon(coupon, subtotal)

    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao validar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
