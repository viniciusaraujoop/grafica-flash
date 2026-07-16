/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PublicSiteCompany, PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import {
  getPrimaryProductImage,
  getProductPriceLabel,
  getProductPriceNumber,
  isProductAvailable,
  isProductConsultOnly,
} from '@/lib/product-media'

type FoodOption = {
  id: string
  name: string
  price: number
  raw?: unknown
}

type FoodCartItem = {
  localId: string
  productId: string
  productName: string
  category?: string
  quantity: number
  unitPrice: number
  variation: FoodOption | null
  addons: FoodOption[]
  notes: string
  subtotal: number
}

type CheckoutState = {
  deliveryType: 'delivery' | 'pickup'
  customerName: string
  customerPhone: string
  address: string
  neighborhood: string
  complement: string
  referencePoint: string
  deliveryZoneId: string
  paymentMethodId: string
  needsChange: boolean
  changeFor: string
  notes: string
}

type SubmitResult = {
  orderId: string
  total: number
  paymentLabel: string
  pixPayload?: string
  whatsapp?: string | null
  checkoutUrl?: string | null
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

type FoodProduct = PublicSiteProduct & {
  ativo?: boolean | null
  tipo?: string | null
  unidade?: string | null
  created_at?: string | null
  adicionais?: unknown
  variacoes?: unknown
  configuracoes?: Record<string, unknown> | null
}

type FoodDeliveryZone = {
  id: string
  name: string
  fee?: number | string | null
  minimum_order?: number | string | null
  estimated_time_min?: number | null
  estimated_time_max?: number | null
  is_active?: boolean | null
  notes?: string | null
}

type BusinessHour = {
  weekday: number
  is_open?: boolean | null
  open_time?: string | null
  close_time?: string | null
  break_start?: string | null
  break_end?: string | null
  closed_message?: string | null
}

type FoodMarketplaceCatalogProps = {
  company: PublicSiteCompany
  products: FoodProduct[]
  primaryColor: string
  accentColor: string
  fallbackTitle: string
  fallbackText: string
}

const emptyCheckout: CheckoutState = {
  deliveryType: 'delivery',
  customerName: '',
  customerPhone: '',
  address: '',
  neighborhood: '',
  complement: '',
  referencePoint: '',
  deliveryZoneId: '',
  paymentMethodId: '',
  needsChange: false,
  changeFor: '',
  notes: '',
}

const emptyCoupon: CouponState = {
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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function numberFrom(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? number : 0
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

function getOptionName(option: any) {
  return String(option?.name || option?.nome || option?.title || option?.titulo || option?.label || '').trim()
}

function getOptionId(option: any, fallback: string) {
  return String(option?.id || option?.value || option?.slug || getOptionName(option) || fallback)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function getOptionPrice(option: any) {
  return numberFrom(option?.price ?? option?.preco ?? option?.valor ?? option?.ajuste_valor ?? option?.price_delta ?? 0)
}

function normalizeOptions(value: unknown, prefix: string): FoodOption[] {
  return asArray<any>(value)
    .flatMap((item, index) => {
      if (Array.isArray(item?.valores)) {
        return item.valores.map((value: any, valueIndex: number) => ({
          id: `${getOptionId(item, `${prefix}_${index}`)}_${getOptionId(value, `${valueIndex}`)}`,
          name: `${getOptionName(item) || 'Opção'}: ${getOptionName(value) || `Item ${valueIndex + 1}`}`,
          price: getOptionPrice(value),
          raw: value,
        }))
      }

      return [{
        id: getOptionId(item, `${prefix}_${index}`),
        name: getOptionName(item) || `Opção ${index + 1}`,
        price: getOptionPrice(item),
        raw: item,
      }]
    })
    .filter((option) => option.name)
}

function getExtras(product: FoodProduct) {
  return product.extras && typeof product.extras === 'object' && !Array.isArray(product.extras)
    ? product.extras as Record<string, unknown>
    : {}
}

function getVariations(product: FoodProduct) {
  const extras = getExtras(product)
  const config = product.configuracoes && typeof product.configuracoes === 'object' ? product.configuracoes : {}

  return [
    ...normalizeOptions(product.variations, 'variation'),
    ...normalizeOptions(product.variacoes, 'variation'),
    ...normalizeOptions(extras.variations, 'variation'),
    ...normalizeOptions(extras.variacoes, 'variation'),
    ...normalizeOptions(config.variations, 'variation'),
    ...normalizeOptions(config.variacoes, 'variation'),
    ...normalizeOptions(config.opcoes, 'variation'),
  ].filter((option, index, list) => list.findIndex((item) => item.id === option.id && item.name === option.name) === index)
}

function getAddons(product: FoodProduct) {
  const extras = getExtras(product)
  const config = product.configuracoes && typeof product.configuracoes === 'object' ? product.configuracoes : {}

  return [
    ...normalizeOptions(product.addons, 'addon'),
    ...normalizeOptions(product.adicionais, 'addon'),
    ...normalizeOptions(extras.addons, 'addon'),
    ...normalizeOptions(extras.adicionais, 'addon'),
    ...normalizeOptions(config.addons, 'addon'),
    ...normalizeOptions(config.adicionais, 'addon'),
  ].filter((option, index, list) => list.findIndex((item) => item.id === option.id && item.name === option.name) === index)
}

function getCategory(product: FoodProduct) {
  return product.categoria?.trim() || 'Cardápio'
}

function calculateItem(product: FoodProduct, quantity: number, variation: FoodOption | null, addons: FoodOption[]) {
  const base = getProductPriceNumber(product)
  const unit = base + Number(variation?.price || 0) + addons.reduce((acc, addon) => acc + Number(addon.price || 0), 0)
  return Number((Math.max(1, quantity) * unit).toFixed(2))
}

function normalizeTime(value?: string | null) {
  return String(value || '').slice(0, 5)
}

function getOpenStatus(hours: BusinessHour[]) {
  const now = new Date()
  const weekday = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const today = hours.find((item) => Number(item.weekday) === weekday)

  if (today?.is_open && today.open_time && today.close_time) {
    const [oh, om] = normalizeTime(today.open_time).split(':').map(Number)
    const [ch, cm] = normalizeTime(today.close_time).split(':').map(Number)
    const openMinutes = oh * 60 + om
    const closeMinutes = ch * 60 + cm
    const insideBreak = today.break_start && today.break_end
      ? (() => {
          const [bh, bm] = normalizeTime(today.break_start).split(':').map(Number)
          const [eh, em] = normalizeTime(today.break_end).split(':').map(Number)
          return minutesNow >= bh * 60 + bm && minutesNow <= eh * 60 + em
        })()
      : false

    if (minutesNow >= openMinutes && minutesNow <= closeMinutes && !insideBreak) {
      return { open: true, label: `Aberto agora até ${normalizeTime(today.close_time)}` }
    }
  }

  for (let step = 0; step < 7; step += 1) {
    const target = (weekday + step) % 7
    const item = hours.find((hour) => Number(hour.weekday) === target && hour.is_open && hour.open_time)
    if (item) {
      const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
      return { open: false, label: step === 0 ? `Abre hoje às ${normalizeTime(item.open_time)}` : `Próxima abertura: ${days[target]} às ${normalizeTime(item.open_time)}` }
    }
  }

  return { open: false, label: today?.closed_message || 'Horários não configurados' }
}

function ProductConfigurator({
  product,
  primaryColor,
  onClose,
  onAdd,
}: {
  product: FoodProduct
  primaryColor: string
  onClose: () => void
  onAdd: (item: Omit<FoodCartItem, 'localId'>) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [variationId, setVariationId] = useState('')
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const variations = useMemo(() => getVariations(product), [product])
  const addons = useMemo(() => getAddons(product), [product])
  const selectedVariation = variations.find((option) => option.id === variationId) || null
  const selectedAddons = addons.filter((addon) => addonIds.includes(addon.id))
  const subtotal = calculateItem(product, quantity, selectedVariation, selectedAddons)

  function toggleAddon(id: string) {
    setAddonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function addToCart() {
    onAdd({
      productId: product.id,
      productName: product.nome || 'Item do cardápio',
      category: getCategory(product),
      quantity: Math.max(1, quantity),
      unitPrice: getProductPriceNumber(product),
      variation: selectedVariation,
      addons: selectedAddons,
      notes: notes.trim(),
      subtotal,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b3a]/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2.2rem] bg-white p-4 shadow-2xl shadow-blue-950/30 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Adicionar ao carrinho</p>
            <h3 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-4xl">{product.nome || 'Item'}</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Escolha quantidade, variação, adicionais e observação do item.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">Fechar</button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            {getPrimaryProductImage(product) ? (
              <img src={getPrimaryProductImage(product)} alt={product.nome || 'Item'} className="h-72 w-full rounded-[1.8rem] object-cover" />
            ) : (
              <div className="grid h-72 place-items-center rounded-[1.8rem] bg-slate-100 text-sm font-black text-slate-400">Sem foto</div>
            )}
            <p className="mt-4 whitespace-pre-line text-sm font-bold leading-7 text-slate-500">{product.descricao || product.descricao_curta || 'Item do cardápio.'}</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] bg-[#f5f8ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Preço base</p>
              <p className="mt-1 text-3xl font-black text-[#05245c]">{getProductPriceLabel(product)}</p>
            </div>

            <label className="grid gap-2 text-sm font-black text-slate-600">
              Quantidade
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]" />
            </label>

            {variations.length ? (
              <label className="grid gap-2 text-sm font-black text-slate-600">
                Variação
                <select value={variationId} onChange={(event) => setVariationId(event.target.value)} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]">
                  <option value="">Sem variação</option>
                  {variations.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}{option.price ? ` (+ ${money(option.price)})` : ''}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {addons.length ? (
              <div className="grid gap-2 text-sm font-black text-slate-600">
                <span>Adicionais</span>
                <div className="grid gap-2">
                  {addons.map((addon) => (
                    <label key={addon.id} className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} />
                        <span className="truncate">{addon.name}</span>
                      </span>
                      <span className="shrink-0 text-[#05245c]">+ {money(addon.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="grid gap-2 text-sm font-black text-slate-600">
              Observação do item
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: sem cebola, maionese à parte..." className="min-h-24 rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]" />
            </label>

            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-blue-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Subtotal</p>
                <p className="text-3xl font-black text-[#071b3a]">{money(subtotal)}</p>
              </div>
              <button type="button" onClick={addToCart} className="rounded-2xl px-5 py-4 font-black text-white" style={{ background: primaryColor }}>Adicionar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FoodMarketplaceCatalog({
  company,
  products,
  primaryColor,
  accentColor,
  fallbackTitle,
  fallbackText,
}: FoodMarketplaceCatalogProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null)
  const [cart, setCart] = useState<FoodCartItem[]>([])
  const [checkout, setCheckout] = useState<CheckoutState>(emptyCheckout)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [coupon, setCoupon] = useState<CouponState>(emptyCoupon)
  const cartIdRef = useRef(0)

  const deliveryZones = asArray<FoodDeliveryZone>((company as any).delivery_zones).filter((zone) => zone.is_active !== false)
  const mercadoPagoConnected = (company as any).marketplace_payment_online_enabled === true
  const businessHours = asArray<BusinessHour>((company as any).business_hours)
  const openStatus = useMemo(() => getOpenStatus(businessHours), [businessHours])

  const safeProducts = useMemo(() => products.filter((product) => product.ativo !== false), [products])
  const categories = useMemo(() => Array.from(new Set(safeProducts.map(getCategory).filter(Boolean))), [safeProducts])
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()

    return safeProducts.filter((product) => {
      if (category !== 'Todos' && getCategory(product) !== category) return false
      if (!term) return true
      return `${product.nome || ''} ${product.descricao || ''} ${product.categoria || ''}`.toLowerCase().includes(term)
    })
  }, [category, safeProducts, search])

  const cartSubtotal = useMemo(() => Number(cart.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)), [cart])
  const selectedZone = deliveryZones.find((zone) => zone.id === checkout.deliveryZoneId) || null
  const deliveryFeeBase = checkout.deliveryType === 'delivery' && selectedZone ? numberFrom(selectedZone.fee) : 0
  const couponProductDiscount = useMemo(() => {
    if (!coupon.appliedCode || coupon.type === 'free_delivery') return 0

    const rawDiscount = coupon.type === 'fixed'
      ? coupon.value
      : cartSubtotal * (coupon.value / 100)
    const cappedDiscount = coupon.maxDiscount && coupon.maxDiscount > 0 ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount

    return Math.min(cartSubtotal, Math.max(0, Number(cappedDiscount.toFixed(2))))
  }, [cartSubtotal, coupon.appliedCode, coupon.maxDiscount, coupon.type, coupon.value])
  const couponDeliveryDiscount = coupon.appliedCode && coupon.type === 'free_delivery' ? deliveryFeeBase : 0
  const deliveryFee = Math.max(0, Number((deliveryFeeBase - couponDeliveryDiscount).toFixed(2)))
  const totalDiscount = Number((couponProductDiscount + couponDeliveryDiscount).toFixed(2))
  const total = Number(Math.max(0, cartSubtotal + deliveryFeeBase - totalDiscount).toFixed(2))
  const minimumOrder = selectedZone ? numberFrom(selectedZone.minimum_order) : 0
  const minimumMissing = checkout.deliveryType === 'delivery' && minimumOrder > 0 && cartSubtotal < minimumOrder

  useEffect(() => {
    if (!cart.length && coupon.appliedCode) setCoupon(emptyCoupon)
  }, [cart.length, coupon.appliedCode])

  function clearAppliedCoupon(message = '') {
    setCoupon({ ...emptyCoupon, message })
  }

  function updateCheckout(field: keyof CheckoutState, value: string | boolean) {
    setCheckout((current) => ({ ...current, [field]: value }))

    if (field === 'deliveryType' || field === 'deliveryZoneId') {
      clearAppliedCoupon('Cupom removido porque a entrega foi alterada.')
    }
  }

  function addToCart(item: Omit<FoodCartItem, 'localId'>) {
    cartIdRef.current += 1
    setCart((current) => [...current, { ...item, localId: `${item.productId}-${cartIdRef.current}` }])
    clearAppliedCoupon('Cupom removido porque o carrinho mudou.')
    setResult(null)
    setError('')
  }

  function updateQuantity(localId: string, quantity: number) {
    setCart((current) => current.map((item) => {
      if (item.localId !== localId) return item
      const unit = item.unitPrice + Number(item.variation?.price || 0) + item.addons.reduce((acc, addon) => acc + Number(addon.price || 0), 0)
      return { ...item, quantity: Math.max(1, quantity), subtotal: Number((unit * Math.max(1, quantity)).toFixed(2)) }
    }))
    clearAppliedCoupon('Cupom removido porque o carrinho mudou.')
  }

  function removeItem(localId: string) {
    setCart((current) => current.filter((item) => item.localId !== localId))
    clearAppliedCoupon('Cupom removido porque o carrinho mudou.')
  }

  async function applyCoupon() {
    const code = coupon.code.trim()

    if (!company.id) {
      setCoupon((current) => ({ ...current, error: 'Empresa não carregada.' }))
      return
    }

    if (!cart.length) {
      setCoupon((current) => ({ ...current, error: 'Adicione itens antes de aplicar cupom.' }))
      return
    }

    if (!code) {
      setCoupon((current) => ({ ...current, error: 'Digite seu cupom.' }))
      return
    }

    setCoupon((current) => ({ ...current, applying: true, error: '', message: '' }))

    try {
      const response = await fetch('/api/marketplace/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: company.slug || company.subdomain_slug,
          code,
          subtotal: cartSubtotal,
          delivery_fee: deliveryFeeBase,
          items: cart.map((item) => ({ product_id: item.productId, categoria: item.category })),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Cupom inválido.')

      const normalizedType = payload.coupon?.tipo === 'free_delivery' ? 'free_delivery' : payload.coupon?.tipo === 'fixed' ? 'fixed' : 'percentage'

      setCoupon({
        code,
        appliedCode: payload.coupon?.codigo || code.toUpperCase(),
        applying: false,
        type: normalizedType,
        value: Number(payload.coupon?.valor || 0),
        maxDiscount: payload.coupon?.valor_maximo_desconto === null || payload.coupon?.valor_maximo_desconto === undefined ? null : Number(payload.coupon.valor_maximo_desconto || 0),
        discountAmount: Number(payload.discount_amount || 0),
        deliveryDiscount: Number(payload.delivery_discount || 0),
        message: payload.message || 'Cupom aplicado com sucesso.',
        error: '',
      })
    } catch (err) {
      setCoupon((current) => ({
        ...current,
        appliedCode: '',
        applying: false,
        discountAmount: 0,
        deliveryDiscount: 0,
        message: '',
        error: err instanceof Error ? err.message : 'Cupom inválido.',
      }))
    }
  }

  function validateCheckout() {
    if (!company.id) return 'Empresa não carregada.'
    if (!cart.length) return 'Adicione pelo menos um item ao carrinho.'
    if (!checkout.customerName.trim()) return 'Informe seu nome.'
    if (phoneOnly(checkout.customerPhone).length < 10) return 'Informe um WhatsApp válido.'

    if (checkout.deliveryType === 'delivery') {
      if (!deliveryZones.length) return 'Esta empresa ainda não configurou taxas de entrega. Escolha retirada ou finalize pelo WhatsApp.'
      if (!checkout.deliveryZoneId) return 'Escolha a região de entrega.'
      if (!checkout.address.trim()) return 'Informe o endereço de entrega.'
      if (minimumMissing) return `Pedido mínimo para ${selectedZone?.name || 'esta região'} é ${money(minimumOrder)}.`
    }

    if (!mercadoPagoConnected) return 'Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir o pedido.'

    return ''
  }

  async function submitOrder() {
    setError('')
    setResult(null)
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
          slug: company.slug || company.subdomain_slug,
          segment: 'food',
          business_type: 'food',
          delivery_type: checkout.deliveryType,
          delivery_zone_id: checkout.deliveryType === 'delivery' ? checkout.deliveryZoneId : null,
          payment_method_id: null,
          payment_provider: 'mercado_pago',
          force_mercado_pago: true,
          change_for: checkout.needsChange ? numberFrom(checkout.changeFor) : null,
          observacoes: checkout.notes,
          coupon_code: coupon.appliedCode || null,
          cliente: {
            nome: checkout.customerName,
            telefone: checkout.customerPhone,
            endereco: checkout.address,
            bairro: checkout.neighborhood || selectedZone?.name || '',
            complemento: checkout.complement,
            referencia: checkout.referencePoint,
          },
          items: cart.map((item) => ({
            product_id: item.productId,
            quantidade: item.quantity,
            selected_variation: item.variation,
            selected_addons: item.addons,
            observacoes: item.notes,
          })),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao finalizar pedido.')

      if (mercadoPagoConnected) {
        const paymentResponse = await fetch('/api/marketplace/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: company.slug || company.subdomain_slug,
            order_id: payload.order_id,
          }),
        })

        const paymentPayload = await paymentResponse.json().catch(() => ({}))
        if (!paymentResponse.ok) throw new Error(paymentPayload.error || 'Pedido criado, mas não foi possível abrir o pagamento online.')

        setResult({
          orderId: payload.order_id,
          total: Number(payload.total || total),
          paymentLabel: 'Mercado Pago Checkout Pro',
          pixPayload: '',
          whatsapp: payload.whatsapp || company.whatsapp || null,
          checkoutUrl: paymentPayload.checkout_url || paymentPayload.init_point || paymentPayload.sandbox_init_point || null,
        })

        const checkoutUrl = paymentPayload.checkout_url || paymentPayload.init_point || paymentPayload.sandbox_init_point
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
      }
      setCart([])
      setCheckout(emptyCheckout)
      setCoupon(emptyCoupon)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar pedido.')
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
                  <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: openStatus.open ? accentColor : '#64748b' }}>
                    {openStatus.label}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">Pedido estruturado</span>
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>{fallbackTitle || 'Cardápio'}</p>
                <h2 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.055em] text-[#071b3a] sm:text-6xl">Escolha, calcule e finalize sem depender do WhatsApp</h2>
                <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-500">{fallbackText || 'Monte seu pedido com itens, adicionais, taxa de entrega e forma de pagamento. WhatsApp fica como apoio.'}</p>
              </div>
              <a href={whatsappLink(company, `Olá, tenho uma dúvida sobre o cardápio de ${company.nome || 'vocês'}.`)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-center text-sm font-black" style={{ color: primaryColor }}>Tirar dúvida no WhatsApp</a>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar item, categoria ou descrição..." className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-bold outline-none focus:border-[#05245c]" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 text-sm font-black text-[#05245c] outline-none">
                <option value="Todos">Todas as categorias</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          {safeProducts.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const available = isProductAvailable(product) && !isProductConsultOnly(product)
                const image = getPrimaryProductImage(product)
                const variations = getVariations(product)
                const addons = getAddons(product)

                return (
                  <article key={product.id} className="group min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/12">
                    {image ? (
                      <img src={image} alt={product.nome || 'Item'} className="h-56 w-full rounded-[1.5rem] object-cover" />
                    ) : (
                      <div className="grid h-56 place-items-center rounded-[1.5rem] bg-slate-100 text-sm font-black text-slate-400">Sem foto</div>
                    )}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{getCategory(product)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{available ? 'Disponível' : 'Sob consulta'}</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-black tracking-[-0.045em] text-[#071b3a]">{product.nome || 'Item'}</h3>
                      <p className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-slate-500">{product.descricao_curta || product.descricao || 'Item do cardápio.'}</p>
                      {(variations.length || addons.length) ? (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-slate-500">
                          {variations.length ? <span className="rounded-full bg-slate-100 px-3 py-1">Variações</span> : null}
                          {addons.length ? <span className="rounded-full bg-slate-100 px-3 py-1">Adicionais</span> : null}
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-2xl font-black text-[#05245c]">{getProductPriceLabel(product)}</p>
                        <button type="button" onClick={() => available ? setSelectedProduct(product) : null} disabled={!available} className="rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" style={available ? { background: primaryColor } : undefined}>
                          Adicionar ao carrinho
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-[2.4rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.8rem] bg-blue-50 text-4xl">🍔</div>
              <h3 className="mt-5 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">Nenhum item cadastrado.</h3>
              <p className="mx-auto mt-3 max-w-2xl font-bold leading-8 text-slate-500">Cadastre produtos no painel para vender pelo marketplace.</p>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-[2.3rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/8 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Carrinho</p>
              <h3 className="text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Seu pedido</h3>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{cart.length} itens</span>
          </div>

          <div className="mt-4 max-h-[310px] space-y-3 overflow-y-auto pr-1">
            {cart.length ? cart.map((item) => (
              <article key={item.localId} className="rounded-[1.5rem] border border-blue-100 bg-[#f8fbff] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-[#071b3a]">{item.productName}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                      {item.variation ? `${item.variation.name}. ` : ''}
                      {item.addons.length ? `Adicionais: ${item.addons.map((addon) => addon.name).join(', ')}. ` : ''}
                      {item.notes ? `Obs: ${item.notes}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => removeItem(item.localId)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-600">Excluir</button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <input type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.localId, Number(event.target.value || 1))} className="w-20 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-black outline-none" />
                  <p className="font-black text-[#05245c]">{money(item.subtotal)}</p>
                </div>
              </article>
            )) : (
              <div className="rounded-[1.5rem] border border-dashed border-blue-100 bg-[#f8fbff] p-6 text-center">
                <p className="font-black text-[#071b3a]">Carrinho vazio.</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Adicione itens para liberar a finalização estruturada.</p>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-[1.5rem] bg-[#f5f8ff] p-2">
              <button type="button" onClick={() => updateCheckout('deliveryType', 'delivery')} className={`rounded-2xl px-3 py-3 text-sm font-black ${checkout.deliveryType === 'delivery' ? 'text-white' : 'text-[#05245c]'}`} style={checkout.deliveryType === 'delivery' ? { background: primaryColor } : undefined}>Entrega</button>
              <button type="button" onClick={() => updateCheckout('deliveryType', 'pickup')} className={`rounded-2xl px-3 py-3 text-sm font-black ${checkout.deliveryType === 'pickup' ? 'text-white' : 'text-[#05245c]'}`} style={checkout.deliveryType === 'pickup' ? { background: primaryColor } : undefined}>Retirada</button>
            </div>

            <div className="grid gap-3">
              <input value={checkout.customerName} onChange={(event) => updateCheckout('customerName', event.target.value)} placeholder="Nome" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />
              <input value={checkout.customerPhone} onChange={(event) => updateCheckout('customerPhone', event.target.value)} placeholder="WhatsApp" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />

              {checkout.deliveryType === 'delivery' ? (
                <>
                  {deliveryZones.length ? (
                    <select value={checkout.deliveryZoneId} onChange={(event) => updateCheckout('deliveryZoneId', event.target.value)} className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]">
                      <option value="">Escolha bairro/região</option>
                      {deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} • {money(zone.fee)}{numberFrom(zone.minimum_order) > 0 ? ` • mín. ${money(zone.minimum_order)}` : ''}</option>)}
                    </select>
                  ) : (
                    <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700">Esta empresa ainda não configurou taxas de entrega. Finalize pelo WhatsApp ou escolha retirada.</div>
                  )}
                  <input value={checkout.address} onChange={(event) => updateCheckout('address', event.target.value)} placeholder="Endereço: rua, número" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />
                  <input value={checkout.complement} onChange={(event) => updateCheckout('complement', event.target.value)} placeholder="Complemento" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />
                  <input value={checkout.referencePoint} onChange={(event) => updateCheckout('referencePoint', event.target.value)} placeholder="Referência" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />
                </>
              ) : (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-700">Retirada selecionada. Nenhuma taxa de entrega será aplicada.</div>
              )}

              <div className={`rounded-[1.4rem] border p-4 text-sm font-bold leading-6 ${mercadoPagoConnected ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                <p className="font-black">{mercadoPagoConnected ? 'Pagamento seguro via Mercado Pago' : 'Pagamentos online indisponíveis'}</p>
                <p className="mt-1">{mercadoPagoConnected ? 'Pague com Pix, cartão de crédito ou débito no Checkout Pro. O pedido fica pendente até a confirmação do Mercado Pago.' : 'Esta loja ainda não ativou pagamentos online. Fale com a loja pelo WhatsApp para combinar o atendimento.'}</p>
              </div>

              <textarea value={checkout.notes} onChange={(event) => updateCheckout('notes', event.target.value)} placeholder="Observações do pedido" className="min-h-20 rounded-2xl border border-blue-100 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c]" />
            </div>

            <div className="rounded-[1.5rem] border border-blue-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Cupom</p>
              <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
                <input value={coupon.code} onChange={(event) => setCoupon((current) => ({ ...current, code: event.target.value.toUpperCase(), error: '', message: '' }))} placeholder="Digite seu cupom" className="min-w-0 flex-1 rounded-2xl border border-blue-100 px-4 py-3 text-sm font-black uppercase outline-none focus:border-[#05245c]" />
                {coupon.appliedCode ? (
                  <button type="button" onClick={() => setCoupon(emptyCoupon)} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-red-600">Remover</button>
                ) : (
                  <button type="button" onClick={applyCoupon} disabled={coupon.applying || !cart.length} className="rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" style={!coupon.applying && cart.length ? { background: primaryColor } : undefined}>{coupon.applying ? 'Aplicando...' : 'Aplicar'}</button>
                )}
              </div>
              {coupon.appliedCode ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{coupon.message || `Cupom ${coupon.appliedCode} aplicado.`}</p> : null}
              {!coupon.appliedCode && coupon.message ? <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-[#05245c]">{coupon.message}</p> : null}
              {coupon.error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{coupon.error}</p> : null}
            </div>

            <div className="rounded-[1.5rem] border border-blue-100 bg-[#f8fbff] p-4 text-sm font-bold text-slate-600">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(cartSubtotal)}</span></div>
              <div className="mt-2 flex justify-between"><span>Taxa de entrega</span><span>{money(deliveryFeeBase)}</span></div>
              {couponDeliveryDiscount > 0 ? <div className="mt-2 flex justify-between text-slate-500"><span>Taxa cobrada</span><span>{money(deliveryFee)}</span></div> : null}
              {totalDiscount > 0 ? <div className="mt-2 flex justify-between text-emerald-700"><span>Cupom {coupon.appliedCode ? `(${coupon.appliedCode})` : ''}</span><span>-{money(totalDiscount)}</span></div> : null}
              {minimumMissing ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-amber-700">Pedido mínimo desta região: {money(minimumOrder)}.</p> : null}
              <div className="mt-4 flex justify-between border-t border-blue-100 pt-4 text-xl font-black text-[#071b3a]"><span>Total</span><span>{money(total)}</span></div>
            </div>

            {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">{error}</div> : null}
            {result ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-700">
                Pedido criado com sucesso. Total: {money(result.total)}. Pagamento: {result.paymentLabel}.
                {result.checkoutUrl ? <a href={result.checkoutUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-[#05245c] px-4 py-3 text-sm font-black text-white">Abrir pagamento online</a> : null}
                {result.pixPayload ? <textarea readOnly value={result.pixPayload} className="mt-3 min-h-20 w-full rounded-xl border border-emerald-100 bg-white p-3 text-xs text-slate-600" /> : null}
              </div>
            ) : null}

            <button type="button" onClick={submitOrder} disabled={submitting || !cart.length} className="w-full rounded-2xl px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" style={!submitting && cart.length ? { background: primaryColor } : undefined}>
              {submitting ? 'Redirecionando...' : mercadoPagoConnected ? 'Finalizar e pagar' : 'Pagamento online indisponível'}
            </button>
          </div>
        </aside>
      </div>

      {selectedProduct ? (
        <ProductConfigurator product={selectedProduct} primaryColor={primaryColor} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      ) : null}
    </section>
  )
}
