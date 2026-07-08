/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
'use client'

import { useMemo, useRef, useState } from 'react'
import type { PublicSiteCompany, PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import {
  getCatalogLabels,
  getFallbackCatalogCategories,
  normalizeCatalogBusinessType,
  type CatalogBusinessType,
} from '@/lib/catalog-labels'
import {
  getPrimaryProductImage,
  getProductPriceLabel,
  getProductPriceNumber,
  isProductAvailable,
  isProductConsultOnly,
} from '@/lib/product-media'

type CartItem = {
  localId: string
  productId: string
  productName: string
  category: string
  quantity: number
  unitPrice: number
  notes: string
  answers: Record<string, string>
  subtotal: number
}

type CheckoutState = {
  customerName: string
  customerPhone: string
  customerEmail: string
  deliveryType: 'pickup' | 'delivery'
  address: string
  neighborhood: string
  complement: string
  referencePoint: string
  deliveryZoneId: string
  paymentMethodId: string
  notes: string
}

type CouponState = {
  code: string
  appliedCode: string
  applying: boolean
  type: 'percentage' | 'fixed' | 'free_delivery'
  value: number
  maxDiscount: number | null
  discountAmount: number
  deliveryDiscount: number
  message: string
  error: string
}

type DeliveryZone = {
  id: string
  name: string
  fee?: number | string | null
  minimum_order?: number | string | null
  estimated_time_min?: number | null
  estimated_time_max?: number | null
  is_active?: boolean | null
}

type SegmentMarketplaceCatalogProps = {
  company: PublicSiteCompany
  products: PublicSiteProduct[]
  businessType: string
  primaryColor: string
  accentColor: string
  fallbackTitle: string
  fallbackText: string
}

const initialCheckout: CheckoutState = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  deliveryType: 'pickup',
  address: '',
  neighborhood: '',
  complement: '',
  referencePoint: '',
  deliveryZoneId: '',
  paymentMethodId: '',
  notes: '',
}

const initialCoupon: CouponState = {
  code: '',
  appliedCode: '',
  applying: false,
  type: 'percentage',
  value: 0,
  maxDiscount: null,
  discountAmount: 0,
  deliveryDiscount: 0,
  message: '',
  error: '',
}

const segmentFields: Record<CatalogBusinessType, Array<{ key: string; label: string; placeholder: string; rows?: number }>> = {
  food: [],
  store: [
    { key: 'cor_tamanho_modelo', label: 'Cor, tamanho ou modelo', placeholder: 'Ex: azul, tamanho M, voltagem 220V' },
  ],
  graphic: [
    { key: 'medidas', label: 'Medidas', placeholder: 'Ex: 90x120cm, A4, 10x15cm' },
    { key: 'quantidade_desejada', label: 'Quantidade desejada', placeholder: 'Ex: 100 unidades' },
    { key: 'acabamento', label: 'Acabamento/material', placeholder: 'Ex: lona, brilho, laminação, corte especial' },
  ],
  custom_products: [
    { key: 'ideia', label: 'Ideia personalizada', placeholder: 'Descreva como deseja personalizar', rows: 3 },
    { key: 'prazo', label: 'Prazo desejado', placeholder: 'Ex: até sexta-feira' },
  ],
  beauty: [
    { key: 'data_horario', label: 'Data/horário desejado', placeholder: 'Ex: sábado pela manhã' },
    { key: 'preferencia_profissional', label: 'Profissional preferido', placeholder: 'Opcional' },
  ],
  barber: [
    { key: 'data_horario', label: 'Data/horário desejado', placeholder: 'Ex: hoje às 17h' },
    { key: 'preferencia_profissional', label: 'Barbeiro preferido', placeholder: 'Opcional' },
  ],
  technical_assistance: [
    { key: 'aparelho', label: 'Aparelho', placeholder: 'Ex: iPhone 11, notebook Dell, TV Samsung' },
    { key: 'defeito', label: 'Defeito relatado', placeholder: 'Explique o problema', rows: 3 },
  ],
  auto: [
    { key: 'veiculo', label: 'Veículo', placeholder: 'Ex: Onix 2020 1.0' },
    { key: 'problema', label: 'Problema ou serviço desejado', placeholder: 'Ex: revisão, freio fazendo barulho', rows: 3 },
  ],
  events: [
    { key: 'data_evento', label: 'Data desejada', placeholder: 'Ex: 20/08/2026' },
    { key: 'convidados', label: 'Quantidade de pessoas', placeholder: 'Ex: 80 convidados' },
    { key: 'detalhes_evento', label: 'Detalhes do evento', placeholder: 'Local, horário, estilo e observações', rows: 3 },
  ],
  services: [
    { key: 'prazo_local', label: 'Prazo/local desejado', placeholder: 'Ex: orçamento para esta semana em Maceió' },
    { key: 'necessidade', label: 'O que precisa?', placeholder: 'Descreva a necessidade principal', rows: 3 },
  ],
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function numberFrom(value: unknown) {
  const numeric = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : 0
}

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(company: PublicSiteCompany, message: string) {
  const phone = phoneOnly(company.whatsapp)
  if (!phone || phone.length < 10) return '#contato'
  const normalized = phone.startsWith('55') ? phone : `55${phone}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

function getCategory(product: PublicSiteProduct) {
  return product.categoria?.trim() || 'Sem categoria'
}

function getProductName(product: PublicSiteProduct) {
  return product.nome || 'Item'
}

function isStoreLike(type: CatalogBusinessType) {
  return type === 'store'
}

function shouldUseDelivery(type: CatalogBusinessType) {
  return type === 'store'
}

function getSegmentIcon(type: CatalogBusinessType) {
  const icons: Record<CatalogBusinessType, string> = {
    food: '🍔',
    store: '🛍️',
    graphic: '🎨',
    custom_products: '🎁',
    beauty: '💇',
    barber: '💈',
    technical_assistance: '🛠️',
    auto: '🚗',
    events: '🎉',
    services: '🧰',
  }

  return icons[type] || '✨'
}

function getSegmentCheckoutTitle(type: CatalogBusinessType) {
  const titles: Record<CatalogBusinessType, string> = {
    food: 'Finalizar pedido',
    store: 'Finalizar compra',
    graphic: 'Solicitar orçamento',
    custom_products: 'Solicitar personalizado',
    beauty: 'Solicitar/agendar atendimento',
    barber: 'Solicitar horário',
    technical_assistance: 'Solicitar análise técnica',
    auto: 'Solicitar diagnóstico',
    events: 'Solicitar proposta',
    services: 'Pedir proposta',
  }

  return titles[type] || 'Enviar solicitação'
}

export default function SegmentMarketplaceCatalog({
  company,
  products,
  businessType,
  primaryColor,
  accentColor,
  fallbackTitle,
  fallbackText,
}: SegmentMarketplaceCatalogProps) {
  const normalizedType = normalizeCatalogBusinessType(businessType || company.business_type || company.site_template)
  const labels = getCatalogLabels(normalizedType)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [selected, setSelected] = useState<PublicSiteProduct | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [checkout, setCheckout] = useState<CheckoutState>(initialCheckout)
  const [coupon, setCoupon] = useState<CouponState>(initialCoupon)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const localIdRef = useRef(0)

  const deliveryZones = asArray<DeliveryZone>((company as any).delivery_zones).filter((zone) => zone.is_active !== false)
  const mercadoPagoConnected = company.marketplace_payment_online_enabled === true

  const safeProducts = useMemo(() => products.filter((product) => product.ativo !== false), [products])
  const categories = useMemo(() => {
    const real = Array.from(new Set(safeProducts.map((product) => product.categoria?.trim()).filter(Boolean) as string[]))
    return real.length ? real : getFallbackCatalogCategories(normalizedType)
  }, [normalizedType, safeProducts])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return safeProducts.filter((product) => {
      if (category !== 'Todos' && getCategory(product) !== category && safeProducts.some((item) => getCategory(item) === category)) return false
      if (!term) return true
      return `${product.nome || ''} ${product.descricao || ''} ${product.descricao_curta || ''} ${product.categoria || ''}`.toLowerCase().includes(term)
    })
  }, [category, safeProducts, search])

  const selectedZone = deliveryZones.find((zone) => zone.id === checkout.deliveryZoneId) || null
  const subtotal = useMemo(() => Number(cart.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)), [cart])
  const deliveryFeeBase = checkout.deliveryType === 'delivery' && selectedZone ? numberFrom(selectedZone.fee) : 0
  const productDiscount = coupon.appliedCode && coupon.type !== 'free_delivery'
    ? Math.min(subtotal, coupon.maxDiscount && coupon.maxDiscount > 0 ? Math.min(coupon.value, coupon.maxDiscount) : coupon.type === 'fixed' ? coupon.value : subtotal * (coupon.value / 100))
    : 0
  const deliveryDiscount = coupon.appliedCode && coupon.type === 'free_delivery' ? deliveryFeeBase : 0
  const totalDiscount = Number((Math.max(0, productDiscount) + Math.max(0, deliveryDiscount)).toFixed(2))
  const deliveryFee = Number(Math.max(0, deliveryFeeBase - deliveryDiscount).toFixed(2))
  const total = Number(Math.max(0, subtotal + deliveryFeeBase - totalDiscount).toFixed(2))
  const checkoutTitle = getSegmentCheckoutTitle(normalizedType)
  const logisticsEnabled = shouldUseDelivery(normalizedType)
  const onlineEnabled = mercadoPagoConnected

  function updateCheckout(field: keyof CheckoutState, value: string) {
    setCheckout((current) => ({ ...current, [field]: value }))
    if (field === 'deliveryType' || field === 'deliveryZoneId') setCoupon(initialCoupon)
  }

  function addToCart(product: PublicSiteProduct, quantity: number, notes: string, answers: Record<string, string>) {
    const unitPrice = getProductPriceNumber(product)
    if (!isProductAvailable(product) || isProductConsultOnly(product) || unitPrice <= 0) return

    localIdRef.current += 1
    const next: CartItem = {
      localId: `${product.id}-${localIdRef.current}`,
      productId: product.id,
      productName: getProductName(product),
      category: getCategory(product),
      quantity,
      unitPrice,
      notes,
      answers,
      subtotal: Number((unitPrice * quantity).toFixed(2)),
    }

    setCart((current) => [...current, next])
    setSelected(null)
    setCoupon(initialCoupon)
    setError('')
    setSuccess('Item adicionado ao carrinho/solicitação.')
  }

  function removeItem(localId: string) {
    setCart((current) => current.filter((item) => item.localId !== localId))
    setCoupon(initialCoupon)
  }

  function updateQuantity(localId: string, quantity: number) {
    setCart((current) => current.map((item) => item.localId === localId
      ? { ...item, quantity: Math.max(1, quantity), subtotal: Number((item.unitPrice * Math.max(1, quantity)).toFixed(2)) }
      : item
    ))
    setCoupon(initialCoupon)
  }

  async function applyCoupon() {
    const code = coupon.code.trim()
    if (!code) {
      setCoupon((current) => ({ ...current, error: 'Digite seu cupom.' }))
      return
    }
    if (!cart.length) {
      setCoupon((current) => ({ ...current, error: 'Adicione um item antes de aplicar cupom.' }))
      return
    }

    setCoupon((current) => ({ ...current, applying: true, error: '', message: '' }))

    try {
      const response = await fetch('/api/marketplace/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          slug: company.slug || company.subdomain_slug,
          code,
          subtotal,
          delivery_fee: deliveryFeeBase,
          items: cart.map((item) => ({ product_id: item.productId, categoria: item.category })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Cupom inválido.')

      const tipo = payload.coupon?.tipo === 'free_delivery' ? 'free_delivery' : payload.coupon?.tipo === 'fixed' ? 'fixed' : 'percentage'
      setCoupon({
        code,
        appliedCode: payload.coupon?.codigo || code.toUpperCase(),
        applying: false,
        type: tipo,
        value: Number(payload.coupon?.valor || 0),
        maxDiscount: payload.coupon?.valor_maximo_desconto == null ? null : Number(payload.coupon.valor_maximo_desconto || 0),
        discountAmount: Number(payload.discount_amount || 0),
        deliveryDiscount: Number(payload.delivery_discount || 0),
        message: payload.message || 'Cupom aplicado.',
        error: '',
      })
    } catch (err) {
      setCoupon((current) => ({ ...current, applying: false, appliedCode: '', message: '', error: err instanceof Error ? err.message : 'Cupom inválido.' }))
    }
  }

  function validateCheckout() {
    if (!company.id) return 'Empresa não carregada.'
    if (!cart.length) return 'Adicione pelo menos um item.'
    if (!checkout.customerName.trim()) return 'Informe seu nome.'
    if (phoneOnly(checkout.customerPhone).length < 10) return 'Informe um WhatsApp válido.'

    if (logisticsEnabled && checkout.deliveryType === 'delivery') {
      if (!deliveryZones.length) return 'Esta empresa ainda não configurou taxas de entrega. Escolha retirada ou fale pelo WhatsApp.'
      if (!checkout.deliveryZoneId) return 'Escolha a região de entrega.'
      if (!checkout.address.trim()) return 'Informe o endereço de entrega.'
      const minimum = numberFrom(selectedZone?.minimum_order)
      if (minimum > 0 && subtotal < minimum) return `Pedido mínimo para ${selectedZone?.name || 'esta região'} é ${money(minimum)}.`
    }

    if (isStoreLike(normalizedType) && !mercadoPagoConnected) return 'Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir.'
    return ''
  }

  async function submitOrder() {
    setError('')
    setSuccess('')
    const validation = validateCheckout()
    if (validation) {
      setError(validation)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/marketplace/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          slug: company.slug || company.subdomain_slug,
          segment: normalizedType,
          business_type: normalizedType,
          delivery_type: logisticsEnabled ? checkout.deliveryType : 'pickup',
          delivery_zone_id: logisticsEnabled && checkout.deliveryType === 'delivery' ? checkout.deliveryZoneId : null,
          payment_method_id: null,
          payment_provider: mercadoPagoConnected ? 'mercado_pago' : 'manual_request',
          force_mercado_pago: mercadoPagoConnected,
          coupon_code: coupon.appliedCode || null,
          observacoes: checkout.notes,
          cliente: {
            nome: checkout.customerName,
            telefone: checkout.customerPhone,
            email: checkout.customerEmail,
            endereco: checkout.address,
            bairro: checkout.neighborhood || selectedZone?.name || '',
            complemento: checkout.complement,
            referencia: checkout.referencePoint,
          },
          respostas_gerais: {
            segmento: normalizedType,
            origem: 'site_segmentado_orcaly',
          },
          items: cart.map((item) => ({
            product_id: item.productId,
            quantidade: item.quantity,
            observacoes: item.notes,
            respostas: item.answers,
          })),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao enviar solicitação.')

      if (mercadoPagoConnected && isStoreLike(normalizedType)) {
        const paymentResponse = await fetch('/api/marketplace/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: company.id, order_id: payload.order_id }),
        })
        const paymentPayload = await paymentResponse.json().catch(() => ({}))
        if (!paymentResponse.ok) throw new Error(paymentPayload.error || 'Solicitação criada, mas o pagamento online não abriu.')
        const checkoutUrl = paymentPayload.checkout_url || paymentPayload.init_point || paymentPayload.sandbox_init_point
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
      }

      setSuccess(`Solicitação enviada com sucesso. Pedido ${String(payload.order_id || '').slice(0, 8)} registrado no painel.`)
      setCart([])
      setCheckout(initialCheckout)
      setCoupon(initialCoupon)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar solicitação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="catalogo" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="min-w-0">
          <div className="rounded-[2.3rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/8 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: accentColor }}>{getSegmentIcon(normalizedType)} {labels.catalogTitle}</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">Cupom no checkout</span>
                  {onlineEnabled ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Pix/cartão online</span> : null}
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>{fallbackTitle || labels.catalogTitle}</p>
                <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.055em] text-[#071b3a] sm:text-6xl">
                  {isStoreLike(normalizedType) ? 'Escolha produtos e envie seu pedido pelo site' : 'Solicitação estruturada para responder melhor'}
                </h2>
                <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-500">
                  {fallbackText || 'Escolha itens, aplique cupom quando disponível, informe dados importantes e envie uma solicitação registrada no painel da empresa.'}
                </p>
              </div>
              <a href={whatsappLink(company, `Olá, tenho uma dúvida sobre ${company.nome || 'a empresa'}.`)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-center text-sm font-black" style={{ color: primaryColor }}>
                Tirar dúvida no WhatsApp
              </a>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar ${labels.itemLabel.toLowerCase()}...`} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-bold outline-none focus:border-[#05245c]" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-black text-[#05245c] outline-none">
                <option value="Todos">Todas as categorias</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          {filteredProducts.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const available = isProductAvailable(product) && !isProductConsultOnly(product) && getProductPriceNumber(product) > 0
                const image = getPrimaryProductImage(product)

                return (
                  <article key={product.id} className="group min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/12">
                    {image ? <img src={image} alt={getProductName(product)} className="h-56 w-full rounded-[1.5rem] object-cover" /> : <div className="grid h-56 place-items-center rounded-[1.5rem] bg-slate-100 text-sm font-black text-slate-400">Sem foto</div>}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{getCategory(product)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{available ? 'Disponível' : 'Sob consulta'}</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-black tracking-[-0.045em] text-[#071b3a]">{getProductName(product)}</h3>
                      <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-slate-500">{product.descricao_curta || product.descricao || 'Confira detalhes e envie uma solicitação.'}</p>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-2xl font-black text-[#05245c]">{getProductPriceLabel(product)}</p>
                        <button type="button" onClick={() => available ? setSelected(product) : null} disabled={!available} className="rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" style={available ? { background: primaryColor } : undefined}>
                          {isStoreLike(normalizedType) ? 'Adicionar' : labels.actionLabel}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-[2.4rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.8rem] bg-blue-50 text-4xl">{getSegmentIcon(normalizedType)}</div>
              <h3 className="mt-5 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{labels.emptyTitle}</h3>
              <p className="mx-auto mt-3 max-w-2xl font-bold leading-8 text-slate-500">{labels.emptyText}</p>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-[2.3rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/8 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Checkout</p>
              <h3 className="text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{checkoutTitle}</h3>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{cart.length} itens</span>
          </div>

          <div className="mt-4 grid gap-3">
            {cart.length ? cart.map((item) => (
              <div key={item.localId} className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#071b3a]">{item.productName}</p>
                    <p className="text-xs font-bold text-slate-500">{money(item.unitPrice)} unidade</p>
                    {item.notes ? <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">{item.notes}</p> : null}
                  </div>
                  <button type="button" onClick={() => removeItem(item.localId)} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-red-600">remover</button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <input type="number" min={1} value={item.quantity} onChange={(event) => updateQuantity(item.localId, Number(event.target.value || 1))} className="w-20 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-black outline-none" />
                  <p className="font-black text-[#05245c]">{money(item.subtotal)}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl bg-[#f8fbff] p-5 text-center text-sm font-bold leading-6 text-slate-500">
                Escolha itens para montar o pedido, orçamento ou solicitação.
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 rounded-[1.7rem] bg-[#f8fbff] p-4">
            <div className="grid grid-cols-[1fr_auto] gap-3 text-sm font-bold text-slate-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {logisticsEnabled ? <div className="grid grid-cols-[1fr_auto] gap-3 text-sm font-bold text-slate-500"><span>Taxa de entrega</span><span>{money(deliveryFee)}</span></div> : null}
            {coupon.appliedCode ? <div className="grid grid-cols-[1fr_auto] gap-3 text-sm font-bold text-emerald-700"><span>Cupom {coupon.appliedCode}</span><span>-{money(totalDiscount)}</span></div> : null}
            <div className="border-t border-blue-100 pt-3 grid grid-cols-[1fr_auto] gap-3 text-xl font-black text-[#071b3a]"><span>Total estimado</span><span>{money(total)}</span></div>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="flex gap-2">
              <input value={coupon.code} onChange={(event) => setCoupon((current) => ({ ...current, code: event.target.value, error: '', message: '' }))} placeholder="Digite seu cupom" className="min-w-0 flex-1 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none" />
              {coupon.appliedCode ? (
                <button type="button" onClick={() => setCoupon(initialCoupon)} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600">Remover</button>
              ) : (
                <button type="button" onClick={applyCoupon} disabled={coupon.applying} className="rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: primaryColor }}>{coupon.applying ? '...' : 'Aplicar'}</button>
              )}
            </div>
            {coupon.message ? <p className="text-xs font-black text-emerald-700">{coupon.message}</p> : null}
            {coupon.error ? <p className="text-xs font-black text-red-700">{coupon.error}</p> : null}
          </div>

          <div className="mt-5 grid gap-3">
            <input value={checkout.customerName} onChange={(event) => updateCheckout('customerName', event.target.value)} placeholder="Seu nome" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none" />
            <input value={checkout.customerPhone} onChange={(event) => updateCheckout('customerPhone', event.target.value)} placeholder="WhatsApp" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none" />
            <input value={checkout.customerEmail} onChange={(event) => updateCheckout('customerEmail', event.target.value)} placeholder="E-mail opcional" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none" />

            {logisticsEnabled ? (
              <div className="grid gap-3 rounded-[1.5rem] border border-blue-100 bg-white p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => updateCheckout('deliveryType', 'pickup')} className={`rounded-2xl px-3 py-3 text-sm font-black ${checkout.deliveryType === 'pickup' ? 'text-white' : 'bg-[#f8fbff] text-[#05245c]'}`} style={checkout.deliveryType === 'pickup' ? { background: primaryColor } : undefined}>Retirada</button>
                  <button type="button" onClick={() => updateCheckout('deliveryType', 'delivery')} className={`rounded-2xl px-3 py-3 text-sm font-black ${checkout.deliveryType === 'delivery' ? 'text-white' : 'bg-[#f8fbff] text-[#05245c]'}`} style={checkout.deliveryType === 'delivery' ? { background: primaryColor } : undefined}>Entrega</button>
                </div>
                {checkout.deliveryType === 'delivery' ? (
                  <>
                    <select value={checkout.deliveryZoneId} onChange={(event) => updateCheckout('deliveryZoneId', event.target.value)} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#05245c] outline-none">
                      <option value="">Escolha bairro/região</option>
                      {deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} • {money(zone.fee)}</option>)}
                    </select>
                    <input value={checkout.address} onChange={(event) => updateCheckout('address', event.target.value)} placeholder="Endereço" className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-bold outline-none" />
                    <input value={checkout.complement} onChange={(event) => updateCheckout('complement', event.target.value)} placeholder="Complemento/referência" className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-sm font-bold outline-none" />
                  </>
                ) : null}
              </div>
            ) : null}

            {isStoreLike(normalizedType) ? (
              <div className={`rounded-[1.4rem] border p-4 text-sm font-bold leading-6 ${mercadoPagoConnected ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                <p className="font-black">{mercadoPagoConnected ? 'Pagamento seguro via Mercado Pago' : 'Pagamentos online indisponíveis'}</p>
                <p className="mt-1">{mercadoPagoConnected ? 'Finalize com Pix, cartão de crédito ou débito pelo Checkout Pro.' : 'Esta loja ainda não ativou pagamentos online. Use o WhatsApp como apoio para combinar o pedido.'}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-[#05245c]">Esta solicitação será registrada no painel da empresa. O WhatsApp fica apenas como apoio para dúvidas.</div>
            )}

            <textarea value={checkout.notes} onChange={(event) => updateCheckout('notes', event.target.value)} placeholder="Observações gerais" className="min-h-24 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none" />
          </div>

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {success ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{success}</div> : null}

          <button type="button" onClick={submitOrder} disabled={submitting || !cart.length} className="mt-5 w-full rounded-2xl px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" style={!submitting && cart.length ? { background: primaryColor } : undefined}>
            {submitting ? 'Enviando...' : mercadoPagoConnected && isStoreLike(normalizedType) ? 'Finalizar e pagar' : checkoutTitle}
          </button>

          <a href={whatsappLink(company, `Olá, tenho uma dúvida sobre ${company.nome || 'a empresa'}.`)} target="_blank" rel="noreferrer" className="mt-3 block rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-center text-sm font-black text-emerald-700">
            Tirar dúvida no WhatsApp
          </a>
        </aside>
      </div>

      {selected ? (
        <ProductRequestModal
          product={selected}
          businessType={normalizedType}
          primaryColor={primaryColor}
          accentColor={accentColor}
          onClose={() => setSelected(null)}
          onAdd={addToCart}
        />
      ) : null}
    </section>
  )
}

function ProductRequestModal({
  product,
  businessType,
  primaryColor,
  accentColor,
  onClose,
  onAdd,
}: {
  product: PublicSiteProduct
  businessType: CatalogBusinessType
  primaryColor: string
  accentColor: string
  onClose: () => void
  onAdd: (product: PublicSiteProduct, quantity: number, notes: string, answers: Record<string, string>) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const fields = segmentFields[businessType] || segmentFields.services
  const price = getProductPriceNumber(product)
  const subtotal = Number((price * Math.max(1, quantity)).toFixed(2))
  const image = getPrimaryProductImage(product)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b3a]/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2.4rem] bg-white p-4 shadow-2xl shadow-blue-950/30">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="min-w-0">
            {image ? <img src={image} alt={getProductName(product)} className="h-80 w-full rounded-[1.9rem] object-cover" /> : <div className="grid h-80 place-items-center rounded-[1.9rem] bg-slate-100 text-sm font-black text-slate-400">Sem foto</div>}
            <div className="mt-4 rounded-[1.5rem] p-4 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">{getCategory(product)}</p>
              <h3 className="mt-1 text-3xl font-black tracking-[-0.05em]">{getProductName(product)}</h3>
              <p className="mt-3 text-sm font-bold leading-6 text-white/70">{product.descricao || product.descricao_curta || 'Informe detalhes para a empresa responder melhor.'}</p>
            </div>
          </div>

          <div className="min-w-0 p-2 sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Configurar solicitação</p>
                <h3 className="mt-2 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#071b3a]">{getProductPriceLabel(product)}</h3>
              </div>
              <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">Fechar</button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-600">
                Quantidade
                <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none" />
              </label>

              {fields.map((field) => (
                <label key={field.key} className="grid gap-2 text-sm font-black text-slate-600">
                  {field.label}
                  {field.rows ? (
                    <textarea value={answers[field.key] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} rows={field.rows} className="resize-none rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none" />
                  ) : (
                    <input value={answers[field.key] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none" />
                  )}
                </label>
              ))}

              <label className="grid gap-2 text-sm font-black text-slate-600">
                Observações
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalhes adicionais, prazo, preferências ou dúvidas." rows={4} className="resize-none rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 font-bold outline-none" />
              </label>

              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-blue-100 bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Subtotal estimado</p>
                  <p className="text-3xl font-black text-[#071b3a]">{money(subtotal)}</p>
                </div>
                <button type="button" onClick={() => onAdd(product, quantity, notes, answers)} className="rounded-2xl px-5 py-4 font-black text-white" style={{ background: primaryColor }}>
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
