/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

type CouponValidationItem = {
  product_id?: string
  categoria?: string
  category?: string
}

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function money(value: unknown) {
  return Math.max(0, Number(String(value ?? '').replace(',', '.')) || 0)
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeCouponType(coupon: any) {
  const raw = String(coupon?.coupon_type || coupon?.discount_type || coupon?.tipo_desconto || coupon?.tipo || '')
    .trim()
    .toLowerCase()

  if (coupon?.free_delivery === true) return 'free_delivery'
  if (['free_delivery', 'frete_gratis', 'frete-gratis', 'free-delivery'].includes(raw)) return 'free_delivery'
  if (['fixed', 'fixo', 'valor_fixo', 'valor-fixo'].includes(raw)) return 'fixed'
  return 'percentage'
}

function couponArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
    } catch {}

    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  return []
}

function validateRestrictions(coupon: any, items: CouponValidationItem[]) {
  const allowedProducts = couponArray(coupon?.allowed_product_ids || coupon?.product_ids || coupon?.produtos_ids)
  const allowedCategories = couponArray(coupon?.allowed_categories || coupon?.category_names || coupon?.categorias)

  if (allowedProducts.length) {
    const ids = new Set(items.map((item) => String(item.product_id || '').trim()).filter(Boolean))
    if (!allowedProducts.some((id) => ids.has(id))) return 'Cupom não permitido para os itens deste carrinho.'
  }

  if (allowedCategories.length) {
    const categories = new Set(items.map((item) => String(item.categoria || item.category || '').trim().toLowerCase()).filter(Boolean))
    if (!allowedCategories.some((category) => categories.has(category.toLowerCase()))) return 'Cupom não permitido para as categorias deste carrinho.'
  }

  return ''
}

function validateCoupon(coupon: any, subtotal: number, deliveryFee: number, items: CouponValidationItem[]) {
  const now = new Date()

  if (!coupon || coupon.ativo === false || coupon.is_active === false) {
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

  const restrictionError = validateRestrictions(coupon, items)
  if (restrictionError) return { valid: false, reason: restrictionError }

  const minOrder = money(coupon.valor_minimo_pedido || coupon.minimum_order)
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      valid: false,
      reason: `Pedido mínimo de ${minOrder.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para usar este cupom.`,
    }
  }

  const type = normalizeCouponType(coupon)
  const value = money(coupon.valor || coupon.value)
  const maxDiscount = coupon.valor_maximo_desconto === null || coupon.valor_maximo_desconto === undefined
    ? null
    : money(coupon.valor_maximo_desconto)

  let discountAmount = 0
  let deliveryDiscount = 0

  if (type === 'free_delivery') {
    if (deliveryFee <= 0) return { valid: false, reason: 'Cupom de frete grátis exige uma entrega com taxa.' }
    deliveryDiscount = deliveryFee
  } else if (type === 'fixed') {
    discountAmount = Math.min(subtotal, value)
  } else {
    discountAmount = subtotal * (value / 100)
  }

  if (maxDiscount !== null && maxDiscount > 0 && type !== 'free_delivery') {
    discountAmount = Math.min(discountAmount, maxDiscount)
  }

  discountAmount = Math.min(subtotal, Math.max(0, Number(discountAmount.toFixed(2))))
  deliveryDiscount = Math.min(deliveryFee, Math.max(0, Number(deliveryDiscount.toFixed(2))))
  const totalDiscount = Number((discountAmount + deliveryDiscount).toFixed(2))

  if (totalDiscount <= 0) {
    return { valid: false, reason: 'Este cupom não gerou desconto para o pedido atual.' }
  }

  return {
    valid: true,
    discount_amount: discountAmount,
    delivery_discount: deliveryDiscount,
    total_discount: totalDiscount,
    total: Math.max(0, Number((subtotal + deliveryFee - totalDiscount).toFixed(2))),
    message: type === 'free_delivery' ? 'Cupom aplicado: frete grátis.' : 'Cupom aplicado com sucesso.',
    coupon: {
      id: coupon.id,
      codigo: coupon.codigo || coupon.code,
      tipo: type,
      valor: Number(coupon.valor || 0),
      valor_minimo_pedido: Number(coupon.valor_minimo_pedido || 0),
      valor_maximo_desconto: coupon.valor_maximo_desconto === null ? null : Number(coupon.valor_maximo_desconto || 0),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const slug = String(body.slug || '').trim()
    const code = normalizeCode(body.codigo || body.code || body.coupon_code)
    const subtotal = money(body.subtotal)
    const deliveryFee = money(body.delivery_fee)
    const items = asArray<CouponValidationItem>(body.items)

    if (!slug) {
      return NextResponse.json({ error: 'Loja não informada.' }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json({ error: 'Informe o código do cupom.' }, { status: 400 })
    }

    let companyQuery = supabaseAdmin
      .from('companies')
      .select('id')

    companyQuery = companyQuery.or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)

    const { data: company, error: companyError } = await companyQuery.maybeSingle()
    if (companyError) throw companyError
    if (!company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { data: coupon, error } = await supabaseAdmin
      .from('marketplace_coupons')
      .select('*')
      .eq('company_id', company.id)
      .eq('codigo_normalizado', code)
      .maybeSingle()

    if (error) throw error

    const result = validateCoupon(coupon, subtotal, deliveryFee, items)

    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao validar cupom.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
