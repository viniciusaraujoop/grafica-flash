/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generatePixPayload, sanitizeTxid } from '@/lib/pix'
import { notifyNewOrder } from '@/lib/whatsapp-notifications'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

type CartItemInput = {
  product_id: string
  quantidade: number
  largura?: number
  altura?: number
  comprimento?: number
  respostas?: Record<string, any>
  opcoes_selecionadas?: Record<string, string>
  observacoes?: string
  selected_variation?: any
  variation?: any
  selected_addons?: any[]
  addons?: any[]
}

type OrderItemCalc = {
  product: any
  input: CartItemInput
  calc: {
    quantidade: number
    preco: number
    subtotalBase: number
    ajustes: number
    subtotal: number
    largura: number
    altura: number
    comprimento: number
    areaM2: number
    detalhes: string
    opcoes: any[]
    variation: FoodOption | null
    addons: FoodOption[]
    unitPrice: number
  }
}

type FoodOption = {
  id: string
  name: string
  price: number
  raw?: unknown
}

function cleanPhone(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function money(value: any) {
  return Math.max(0, Number(value || 0))
}

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function isFoodOrder(body: any, company: any) {
  const raw = String(body.segment || body.business_type || company?.business_type || company?.modelo_negocio || '').toLowerCase()
  return ['food', 'alimenticio', 'restaurante', 'lanchonete', 'delivery'].includes(raw)
}

function isLogisticsOrder(body: any, company: any) {
  const raw = String(body.segment || body.business_type || company?.business_type || company?.modelo_negocio || '').toLowerCase()
  return ['food', 'alimenticio', 'restaurante', 'lanchonete', 'delivery', 'store', 'loja', 'comercio', 'comércio'].includes(raw)
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function numberFrom(value: unknown) {
  const numeric = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : 0
}

function optionName(option: any) {
  return String(option?.name || option?.nome || option?.title || option?.titulo || option?.label || '').trim()
}

function optionId(option: any, fallback: string) {
  return String(option?.id || option?.value || option?.slug || optionName(option) || fallback)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function optionPrice(option: any) {
  return numberFrom(option?.price ?? option?.preco ?? option?.valor ?? option?.ajuste_valor ?? option?.price_delta ?? 0)
}

function normalizeOptions(value: unknown, prefix: string): FoodOption[] {
  return asArray<any>(value)
    .flatMap((item, index) => {
      if (Array.isArray(item?.valores)) {
        return item.valores.map((value: any, valueIndex: number) => ({
          id: `${optionId(item, `${prefix}_${index}`)}_${optionId(value, `${valueIndex}`)}`,
          name: `${optionName(item) || 'Opção'}: ${optionName(value) || `Item ${valueIndex + 1}`}`,
          price: optionPrice(value),
          raw: value,
        }))
      }

      return [{
        id: optionId(item, `${prefix}_${index}`),
        name: optionName(item) || `Opção ${index + 1}`,
        price: optionPrice(item),
        raw: item,
      }]
    })
    .filter((option) => option.name)
}

function getExtras(product: any) {
  return product?.extras && typeof product.extras === 'object' && !Array.isArray(product.extras) ? product.extras : {}
}

function getConfig(product: any) {
  return product?.configuracoes && typeof product.configuracoes === 'object' && !Array.isArray(product.configuracoes) ? product.configuracoes : {}
}

function getProductVariations(product: any) {
  const extras = getExtras(product)
  const config = getConfig(product)

  return [
    ...normalizeOptions(product?.variations, 'variation'),
    ...normalizeOptions(product?.variacoes, 'variation'),
    ...normalizeOptions(extras.variations, 'variation'),
    ...normalizeOptions(extras.variacoes, 'variation'),
    ...normalizeOptions(config.variations, 'variation'),
    ...normalizeOptions(config.variacoes, 'variation'),
    ...normalizeOptions(config.opcoes, 'variation'),
  ].filter((option, index, list) => list.findIndex((item) => item.id === option.id && item.name === option.name) === index)
}

function getProductAddons(product: any) {
  const extras = getExtras(product)
  const config = getConfig(product)

  return [
    ...normalizeOptions(product?.addons, 'addon'),
    ...normalizeOptions(product?.adicionais, 'addon'),
    ...normalizeOptions(extras.addons, 'addon'),
    ...normalizeOptions(extras.adicionais, 'addon'),
    ...normalizeOptions(config.addons, 'addon'),
    ...normalizeOptions(config.adicionais, 'addon'),
  ].filter((option, index, list) => list.findIndex((item) => item.id === option.id && item.name === option.name) === index)
}

function findOption(options: FoodOption[], input: any) {
  if (!input) return null
  const wantedId = String(input.id || input.value || '').trim().toLowerCase()
  const wantedName = optionName(input).toLowerCase()

  return options.find((option) => {
    return (wantedId && option.id.toLowerCase() === wantedId) || (wantedName && option.name.toLowerCase() === wantedName)
  }) || null
}

function selectedOptions(product: any, selections: Record<string, string> = {}) {
  const groups = Array.isArray(product.configuracoes?.opcoes) ? product.configuracoes.opcoes : []
  const selected: any[] = []

  groups.forEach((group: any) => {
    const selectedId = selections[group.id]
    const value = Array.isArray(group.valores)
      ? group.valores.find((option: any) => option.id === selectedId)
      : null

    if (value) {
      selected.push({
        group_id: group.id,
        group_nome: group.nome,
        value_id: value.id,
        value_nome: value.nome,
        ajuste_tipo: value.ajuste_tipo || 'fixo',
        ajuste_valor: Number(value.ajuste_valor || 0),
      })
    }
  })

  return selected
}

function calculateItem(product: any, item: CartItemInput) {
  const quantidade = Math.max(1, Number(item.quantidade || 1))
  const preco = money(product.preco)
  const largura = Number(item.largura || 0)
  const altura = Number(item.altura || 0)
  const comprimento = Number(item.comprimento || 0)
  const precificacao = product.precificacao || 'unidade'
  const valorMinimo = money(product.valor_minimo)

  let subtotalBase = preco * quantidade
  let areaM2 = 0
  let detalhes = `${quantidade} x ${preco.toFixed(2)}`

  if (precificacao === 'm2' || precificacao === 'metro_quadrado') {
    areaM2 = Math.max(0, largura) * Math.max(0, altura)
    subtotalBase = areaM2 * preco * quantidade
    detalhes = `${largura}m x ${altura}m = ${areaM2.toFixed(2)}m² x ${quantidade}`
  }

  if (precificacao === 'metro_linear') {
    const medida = Math.max(largura, altura, comprimento, 0)
    subtotalBase = medida * preco * quantidade
    detalhes = `${medida}m x ${quantidade}`
  }

  const opcoes = selectedOptions(product, item.opcoes_selecionadas)
  let ajustes = 0

  opcoes.forEach((opcao) => {
    if (opcao.ajuste_tipo === 'percentual') {
      ajustes += subtotalBase * (Number(opcao.ajuste_valor || 0) / 100)
    } else {
      ajustes += Number(opcao.ajuste_valor || 0) * quantidade
    }
  })

  const variations = getProductVariations(product)
  const addons = getProductAddons(product)
  const variationInput = item.selected_variation || item.variation
  const selectedVariation = findOption(variations, variationInput)
  const addonInputs = asArray<any>(item.selected_addons || item.addons)
  const selectedAddons = addonInputs.map((addon) => findOption(addons, addon)).filter(Boolean) as FoodOption[]

  if (variationInput && !selectedVariation) {
    throw new Error(`Variação inválida para ${product.nome || 'produto'}.`)
  }

  if (addonInputs.length !== selectedAddons.length) {
    throw new Error(`Adicional inválido para ${product.nome || 'produto'}.`)
  }

  const variationPrice = Number(selectedVariation?.price || 0) * quantidade
  const addonsPrice = selectedAddons.reduce((acc, addon) => acc + Number(addon.price || 0), 0) * quantidade
  ajustes += variationPrice + addonsPrice

  let subtotal = Number((subtotalBase + ajustes).toFixed(2))

  if (valorMinimo > 0 && subtotal < valorMinimo) {
    subtotal = valorMinimo
    detalhes += ' • mínimo aplicado'
  }

  if (opcoes.length > 0) {
    detalhes += ` • opções: ${opcoes.map((o) => `${o.group_nome}: ${o.value_nome}`).join(', ')}`
  }

  if (selectedVariation) detalhes += ` • variação: ${selectedVariation.name}`
  if (selectedAddons.length) detalhes += ` • adicionais: ${selectedAddons.map((addon) => addon.name).join(', ')}`

  return {
    quantidade,
    preco,
    subtotalBase,
    ajustes,
    subtotal,
    largura,
    altura,
    comprimento,
    areaM2,
    detalhes,
    opcoes,
    variation: selectedVariation,
    addons: selectedAddons,
    unitPrice: Number(((subtotalBase + ajustes) / quantidade).toFixed(2)),
  }
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

function validateCouponRestrictions(coupon: any, orderItems: OrderItemCalc[]) {
  const allowedProducts = couponArray(coupon?.allowed_product_ids || coupon?.product_ids || coupon?.produtos_ids)
  const allowedCategories = couponArray(coupon?.allowed_categories || coupon?.category_names || coupon?.categorias)

  if (allowedProducts.length) {
    const ids = new Set(orderItems.map((item) => String(item.product.id || '').trim()).filter(Boolean))
    if (!allowedProducts.some((id) => ids.has(id))) return 'Cupom não permitido para os itens deste carrinho.'
  }

  if (allowedCategories.length) {
    const categories = new Set(orderItems.map((item) => String(item.product.categoria || item.product.category || '').trim().toLowerCase()).filter(Boolean))
    if (!allowedCategories.some((category) => categories.has(category.toLowerCase()))) return 'Cupom não permitido para as categorias deste carrinho.'
  }

  return ''
}

function validateCoupon(coupon: any, subtotal: number, deliveryFee: number, orderItems: OrderItemCalc[]) {
  const now = new Date()

  if (!coupon || coupon.ativo === false || coupon.is_active === false) return { valid: false, reason: 'Cupom inválido ou inativo.' }
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { valid: false, reason: 'Cupom ainda não está disponível.' }
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return { valid: false, reason: 'Cupom expirado.' }
  if (coupon.usage_limit && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) return { valid: false, reason: 'Cupom atingiu o limite de uso.' }

  const restrictionError = validateCouponRestrictions(coupon, orderItems)
  if (restrictionError) return { valid: false, reason: restrictionError }

  const minOrder = money(coupon.valor_minimo_pedido || coupon.minimum_order)
  if (minOrder > 0 && subtotal < minOrder) {
    return { valid: false, reason: 'Pedido abaixo do valor mínimo do cupom.' }
  }

  const type = normalizeCouponType(coupon)
  const value = money(coupon.valor || coupon.value)
  const maxDiscount = coupon.valor_maximo_desconto === null || coupon.valor_maximo_desconto === undefined
    ? null
    : money(coupon.valor_maximo_desconto)

  let discount = 0
  let deliveryDiscount = 0

  if (type === 'free_delivery') {
    if (deliveryFee <= 0) return { valid: false, reason: 'Cupom de frete grátis exige uma entrega com taxa.' }
    deliveryDiscount = deliveryFee
  } else if (type === 'fixed') {
    discount = value
  } else {
    discount = subtotal * (value / 100)
  }

  if (maxDiscount !== null && maxDiscount > 0 && type !== 'free_delivery') {
    discount = Math.min(discount, maxDiscount)
  }

  discount = Math.min(subtotal, Math.max(0, Number(discount.toFixed(2))))
  deliveryDiscount = Math.min(deliveryFee, Math.max(0, Number(deliveryDiscount.toFixed(2))))
  const totalDiscount = Number((discount + deliveryDiscount).toFixed(2))

  return {
    valid: totalDiscount > 0,
    reason: totalDiscount > 0 ? '' : 'Cupom não gerou desconto.',
    discount,
    deliveryDiscount,
    totalDiscount,
    type,
  }
}

async function getCouponDiscount(companyId: string, code: string, subtotal: number, deliveryFee: number, orderItems: OrderItemCalc[]) {
  const normalized = normalizeCode(code)

  if (!normalized) return { coupon: null, discount: 0, deliveryDiscount: 0, totalDiscount: 0, error: '', type: '' }

  const { data: coupon, error } = await supabaseAdmin
    .from('marketplace_coupons')
    .select('*')
    .eq('company_id', companyId)
    .eq('codigo_normalizado', normalized)
    .maybeSingle()

  if (error) throw error

  const validation = validateCoupon(coupon, subtotal, deliveryFee, orderItems)

  if (!validation.valid) {
    return { coupon: null, discount: 0, deliveryDiscount: 0, totalDiscount: 0, error: validation.reason || 'Cupom inválido.', type: '' }
  }

  return {
    coupon,
    discount: Number(validation.discount || 0),
    deliveryDiscount: Number(validation.deliveryDiscount || 0),
    totalDiscount: Number(validation.totalDiscount || 0),
    error: '',
    type: validation.type || normalizeCouponType(coupon),
  }
}

function paymentStatusFromMethod(method: any) {
  const type = String(method?.type || '').toLowerCase()
  if (type === 'pix') return 'waiting_confirmation'
  if (type === 'online') return 'pending'
  if (type === 'cash' || type === 'delivery_card' || type === 'debit_card' || type === 'credit_card') return 'pending'
  return 'pending'
}

function paymentLabel(method: any) {
  const labels: Record<string, string> = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    delivery_card: 'Cartão na entrega',
    online: 'Link de pagamento',
    other: 'Outro',
  }

  if (!method) return 'Combinar pelo WhatsApp'
  return method.name || labels[String(method.type || '').toLowerCase()] || 'A combinar'
}

async function rollbackOrder(companyId: string, orderId: string | null) {
  if (!orderId) return

  await supabaseAdmin.from('deliveries').delete().eq('order_id', orderId).eq('company_id', companyId)
  await supabaseAdmin.from('order_payments').delete().eq('order_id', orderId).eq('company_id', companyId)
  await supabaseAdmin.from('order_items').delete().eq('order_id', orderId).eq('company_id', companyId)
  await supabaseAdmin.from('orders').delete().eq('id', orderId).eq('company_id', companyId)
}

export async function POST(request: NextRequest) {
  let createdOrderId: string | null = null
  let companyIdForRollback = ''

  try {
    const body = await request.json()

    const requestedCompanyId = String(body.company_id || '')
    const slug = String(body.slug || '').trim()
    const cliente = body.cliente || {}
    const items = Array.isArray(body.items) ? itemsSanitize(body.items) : []
    const couponCode = normalizeCode(body.coupon_code || body.cupom_codigo || body.codigo_cupom)

    if (!requestedCompanyId && !slug) {
      return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 })
    }

    if (!cliente.nome || cleanPhone(cliente.telefone).length < 10) {
      return NextResponse.json({ error: 'Informe nome e WhatsApp válido.' }, { status: 400 })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    }

    let companyQuery = supabaseAdmin
      .from('companies')
      .select(`
        id,
        nome,
        slug,
        subdomain_slug,
        whatsapp,
        pix_key,
        pix_nome,
        pix_cidade,
        aceita_pix,
        cobrar_sinal,
        percentual_sinal,
        business_type,
        modelo_negocio,
        modelo_perguntas
      `)

    companyQuery = requestedCompanyId
      ? companyQuery.eq('id', requestedCompanyId)
      : companyQuery.or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)

    const { data: company, error: companyError } = await companyQuery.maybeSingle()

    if (companyError) throw companyError

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const companyId = company.id
    companyIdForRollback = companyId
    const foodOrder = isFoodOrder(body, company)
    const logisticsOrder = isLogisticsOrder(body, company)
    const ids = Array.from(new Set(items.map((item: CartItemInput) => item.product_id)))

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .in('id', ids)

    if (productsError) throw productsError

    const productMap = new Map((products || []).map((product: any) => [product.id, product]))
    const orderItems: OrderItemCalc[] = []

    for (const item of items) {
      const product = productMap.get(item.product_id)

      if (!product || product.ativo === false || product.available === false) {
        return NextResponse.json({ error: 'Produto inválido ou indisponível no carrinho.' }, { status: 400 })
      }

      if (foodOrder && (product.preco_sob_consulta || money(product.preco) <= 0)) {
        return NextResponse.json({ error: `${product.nome || 'Produto'} está sob consulta e não pode ir para checkout Food.` }, { status: 400 })
      }

      const calc = calculateItem(product, item)
      orderItems.push({ product, input: item, calc })
    }

    const subtotal = Number(orderItems.reduce((acc, item) => acc + item.calc.subtotal, 0).toFixed(2))
    const deliveryType = logisticsOrder ? (body.delivery_type === 'delivery' ? 'delivery' : 'pickup') : String(body.delivery_type || 'pickup')

    let deliveryZone: any = null
    let deliveryFee = 0

    if (logisticsOrder && deliveryType === 'delivery') {
      const deliveryZoneId = String(body.delivery_zone_id || '')

      if (!deliveryZoneId) {
        return NextResponse.json({ error: 'Escolha a região de entrega.' }, { status: 400 })
      }

      const { data: zone, error: zoneError } = await supabaseAdmin
        .from('delivery_zones')
        .select('id, name, fee, minimum_order, estimated_time_min, estimated_time_max, is_active')
        .eq('id', deliveryZoneId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()

      if (zoneError) throw zoneError
      if (!zone) return NextResponse.json({ error: 'Região de entrega inválida para esta empresa.' }, { status: 400 })

      const minimumOrder = money(zone.minimum_order)
      if (minimumOrder > 0 && subtotal < minimumOrder) {
        return NextResponse.json({ error: `Pedido mínimo para ${zone.name} é ${minimumOrder.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` }, { status: 400 })
      }

      deliveryZone = zone
      deliveryFee = money(zone.fee)
    }

    let selectedPaymentMethod: any = null
    const paymentMethodId = String(body.payment_method_id || '')

    if (paymentMethodId) {
      const { data: method, error: methodError } = await supabaseAdmin
        .from('payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()

      if (methodError) throw methodError
      if (!method) return NextResponse.json({ error: 'Forma de pagamento inválida para esta empresa.' }, { status: 400 })
      selectedPaymentMethod = method
    } else if (logisticsOrder) {
      const { data: anyMethod, error: anyMethodError } = await supabaseAdmin
        .from('payment_methods')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .limit(1)

      if (anyMethodError) throw anyMethodError
      if (Array.isArray(anyMethod) && anyMethod.length > 0) {
        return NextResponse.json({ error: 'Escolha a forma de pagamento.' }, { status: 400 })
      }
    }

    const couponResult = await getCouponDiscount(companyId, couponCode, subtotal, deliveryFee, orderItems)

    if (couponCode && couponResult.error) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 })
    }

    const valorDescontoProdutos = Number((couponResult.discount || 0).toFixed(2))
    const valorDescontoEntrega = Number((couponResult.deliveryDiscount || 0).toFixed(2))
    const valorDesconto = Number((valorDescontoProdutos + valorDescontoEntrega).toFixed(2))
    const subtotalAfterDiscount = Number(Math.max(0, subtotal - valorDescontoProdutos).toFixed(2))
    const deliveryFeeOriginal = deliveryFee
    const deliveryFeeCharged = Number(Math.max(0, deliveryFeeOriginal - valorDescontoEntrega).toFixed(2))
    const total = Number(Math.max(0, subtotalAfterDiscount + deliveryFeeCharged).toFixed(2))
    const percentualSinal = company.cobrar_sinal ? Math.max(0, Number(company.percentual_sinal || 0)) : 0
    const valorSinal = percentualSinal > 0 ? Number((total * percentualSinal / 100).toFixed(2)) : 0
    const valorPix = valorSinal > 0 ? valorSinal : total
    const telefone = cleanPhone(cliente.telefone)
    const resumo = orderItems.map((item) => `${item.calc.quantidade}x ${item.product.nome}`).join(', ')
    const paymentName = paymentLabel(selectedPaymentMethod)
    const paymentStatus = paymentStatusFromMethod(selectedPaymentMethod)
    const txid = sanitizeTxid(`ORC${Date.now().toString().slice(-10)}`)

    const pixPayload = selectedPaymentMethod?.type === 'pix' && company.aceita_pix !== false && company.pix_key
      ? generatePixPayload({
          key: company.pix_key,
          merchantName: company.pix_nome || company.nome || 'ORCALY',
          merchantCity: company.pix_cidade || 'MACEIO',
          amount: valorPix,
          txid,
          description: `Pedido ${company.nome}`.slice(0, 60),
        })
      : ''

    const address = String(cliente.endereco || body.address || '').trim()
    const neighborhood = String(cliente.bairro || cliente.neighborhood || deliveryZone?.name || '').trim()
    const complement = String(cliente.complemento || body.complement || '').trim()
    const referencePoint = String(cliente.referencia || body.reference_point || '').trim()
    const changeFor = body.change_for !== null && body.change_for !== undefined ? numberFrom(body.change_for) : null
    const itemsSnapshot = orderItems.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.nome,
      quantity: item.calc.quantidade,
      unit_price: item.calc.unitPrice,
      base_price: item.calc.preco,
      variation: item.calc.variation,
      addons: item.calc.addons,
      notes: item.input.observacoes || '',
      subtotal: item.calc.subtotal,
    }))

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        company_id: companyId,
        nome: String(cliente.nome).trim(),
        telefone,
        produto: resumo,
        quantidade: orderItems.reduce((acc, item) => acc + item.calc.quantidade, 0),
        observacoes: body.observacoes || cliente.observacoes || null,
        status: 'Recebido',
        preco_estimado: total,
        valor_total_original: subtotal,
        valor_desconto: valorDesconto,
        valor_total: total,
        subtotal,
        total_amount: total,
        delivery_type: deliveryType,
        delivery_fee: deliveryFeeCharged,
        delivery_zone_id: deliveryZone?.id || null,
        payment_method_id: selectedPaymentMethod?.id || null,
        payment_status: paymentStatus,
        valor_sinal: valorSinal,
        percentual_sinal: percentualSinal,
        cupom_id: couponResult.coupon?.id || null,
        cupom_codigo: couponResult.coupon?.codigo || null,
        forma_pagamento: pixPayload ? 'PIX' : paymentName,
        address: address || null,
        endereco_entrega: address || null,
        neighborhood: neighborhood || null,
        complement: complement || null,
        reference_point: referencePoint || null,
        change_for: changeFor,
        items_snapshot: itemsSnapshot,
        itens_resumo: resumo,
        cliente_empresa: cliente.empresa || null,
        marketplace_origem: foodOrder ? 'marketplace_food' : logisticsOrder ? 'marketplace_store' : 'marketplace',
        dados_inteligentes: {
          origem: foodOrder ? 'marketplace_food_checkout' : logisticsOrder ? 'marketplace_store_checkout' : 'marketplace_segment_request',
          cliente,
          subtotal,
          valor_desconto: valorDesconto,
          valor_desconto_produtos: valorDescontoProdutos,
          valor_desconto_entrega: valorDescontoEntrega,
          delivery_type: deliveryType,
          delivery_fee: deliveryFeeCharged,
          delivery_fee_original: deliveryFeeOriginal,
          delivery_discount: valorDescontoEntrega,
          total_final: total,
          payment_method: selectedPaymentMethod ? {
            id: selectedPaymentMethod.id,
            name: selectedPaymentMethod.name,
            type: selectedPaymentMethod.type,
          } : null,
          delivery_zone: deliveryZone ? {
            id: deliveryZone.id,
            name: deliveryZone.name,
            fee: deliveryFeeCharged,
          } : null,
          cupom: couponResult.coupon
            ? {
                id: couponResult.coupon.id,
                codigo: couponResult.coupon.codigo,
                tipo: couponResult.type || couponResult.coupon.coupon_type || couponResult.coupon.tipo,
                valor: couponResult.coupon.valor,
                desconto_produtos: valorDescontoProdutos,
                desconto_entrega: valorDescontoEntrega,
              }
            : null,
          pix: pixPayload
            ? {
                txid,
                valor_pix: valorPix,
                copia_cola: pixPayload,
              }
            : null,
          perguntas_gerais: body.respostas_gerais || {},
          items: itemsSnapshot,
        },
      })
      .select('id')
      .single()

    if (orderError) throw orderError
    createdOrderId = order.id

    const itemsToInsert = orderItems.map((item) => ({
      order_id: order.id,
      company_id: companyId,
      product_id: item.product.id,
      nome: item.product.nome,
      product_name: item.product.nome,
      tipo: item.product.tipo || 'produto',
      unidade: item.product.unidade || 'unidade',
      quantidade: item.calc.quantidade,
      quantity: item.calc.quantidade,
      preco_unitario: item.calc.unitPrice,
      unit_price: item.calc.unitPrice,
      subtotal: item.calc.subtotal,
      largura: item.calc.largura || null,
      altura: item.calc.altura || null,
      comprimento: item.calc.comprimento || null,
      area_m2: item.calc.areaM2 || null,
      precificacao: item.product.precificacao || 'unidade',
      detalhes_calculo: item.calc.detalhes,
      variation: item.calc.variation || {},
      addons: item.calc.addons || [],
      notes: item.input.observacoes || null,
      respostas: {
        ...(item.input.respostas || {}),
        observacoes: item.input.observacoes || null,
        opcoes: item.calc.opcoes,
        variation: item.calc.variation,
        addons: item.calc.addons,
        ajustes: item.calc.ajustes,
      },
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    const paymentAmount = valorSinal > 0 ? valorSinal : total
    const { error: paymentError } = await supabaseAdmin
      .from('order_payments')
      .insert({
        company_id: companyId,
        order_id: order.id,
        payment_method_id: selectedPaymentMethod?.id || null,
        type: valorSinal > 0 ? 'signal' : 'full',
        status: paymentStatus,
        amount: paymentAmount,
        paid_amount: 0,
        remaining_amount: total,
        provider: selectedPaymentMethod?.type === 'online' ? 'manual_online' : selectedPaymentMethod?.type || 'manual',
        provider_payment_id: pixPayload ? txid : null,
        notes: paymentName,
      })

    if (paymentError) throw paymentError

    if (logisticsOrder && deliveryType === 'delivery') {
      const estimatedDeliveryAt = deliveryZone?.estimated_time_max
        ? new Date(Date.now() + Number(deliveryZone.estimated_time_max) * 60000).toISOString()
        : null

      const { error: deliveryError } = await supabaseAdmin
        .from('deliveries')
        .insert({
          company_id: companyId,
          order_id: order.id,
          customer_name: String(cliente.nome).trim(),
          customer_phone: telefone,
          address,
          neighborhood: neighborhood || deliveryZone?.name || null,
          delivery_zone_id: deliveryZone?.id || null,
          delivery_fee: deliveryFeeCharged,
          payment_method_id: selectedPaymentMethod?.id || null,
          status: 'waiting_preparation',
          notes: body.observacoes || cliente.observacoes || null,
          estimated_delivery_at: estimatedDeliveryAt,
        })

      if (deliveryError) throw deliveryError
    }

    if (couponResult.coupon?.id) {
      await supabaseAdmin
        .from('marketplace_coupons')
        .update({
          used_count: Number(couponResult.coupon.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', couponResult.coupon.id)
        .eq('company_id', companyId)
    }

    try {
      await notifyNewOrder(supabaseAdmin, {
        company,
        order: {
          id: order.id,
          company_id: companyId,
          nome: String(cliente.nome).trim(),
          telefone,
          produto: resumo,
          itens_resumo: resumo,
          valor_total: total,
          preco_estimado: total,
        },
        cliente,
        total,
        resumo,
      })
    } catch (notifyError) {
      console.error('[Orçaly WhatsApp] Falha ao notificar novo pedido:', notifyError)
    }

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      total_original: subtotal,
      valor_desconto: valorDesconto,
      valor_desconto_produtos: valorDescontoProdutos,
      valor_desconto_entrega: valorDescontoEntrega,
      subtotal: subtotalAfterDiscount,
      delivery_fee_original: deliveryFeeOriginal,
      delivery_fee: deliveryFeeCharged,
      total,
      valor_sinal: valorSinal,
      valor_pix: valorPix,
      cupom_codigo: couponResult.coupon?.codigo || null,
      forma_pagamento: pixPayload ? 'PIX' : paymentName,
      payment_status: paymentStatus,
      pix_payload: pixPayload,
      txid,
      resumo,
      whatsapp: company.whatsapp || null,
    })
  } catch (error) {
    await rollbackOrder(companyIdForRollback, createdOrderId)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar pedido.' },
      { status: 500 }
    )
  }
}

function itemsSanitize(items: any[]): CartItemInput[] {
  return items.map((item) => ({
    product_id: String(item.product_id || ''),
    quantidade: Number(item.quantidade || item.quantity || 1),
    largura: item.largura ? Number(item.largura) : undefined,
    altura: item.altura ? Number(item.altura) : undefined,
    comprimento: item.comprimento ? Number(item.comprimento) : undefined,
    respostas: item.respostas || {},
    opcoes_selecionadas: item.opcoes_selecionadas || {},
    observacoes: item.observacoes || item.notes || '',
    selected_variation: item.selected_variation || item.variation || null,
    selected_addons: Array.isArray(item.selected_addons) ? item.selected_addons : Array.isArray(item.addons) ? item.addons : [],
  })).filter((item) => item.product_id)
}
