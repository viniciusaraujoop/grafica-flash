export type RepurchaseOrder = {
  id: string
  nome?: string | null
  customer_name?: string | null
  telefone?: string | null
  customer_phone?: string | null
  produto?: string | null
  status?: string | null
  total?: number | null
  total_amount?: number | null
  valor_total?: number | null
  preco_estimado?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export type RepurchaseOpportunity = {
  id: string
  orderId: string
  customerName: string
  customerPhone: string
  product: string
  lastPurchaseAt: string | null
  daysSince: number
  previousPurchases: number
  previousValue: number
  score: number
  suggestion: string
}

export function normalizeRepurchasePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.startsWith('55') ? digits.slice(2) : digits
}

function normalizeProduct(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function isCompletedForRepurchase(status: unknown) {
  const value = String(status || '').toLowerCase()
  return ['entregue', 'concluido', 'concluído', 'finalizado', 'atendido'].some((term) => value.includes(term))
}

export function isOpenForRepurchase(status: unknown) {
  const value = String(status || '').toLowerCase()
  return !['entregue', 'concluido', 'concluído', 'finalizado', 'cancelado', 'canceled', 'cancelled', 'recusado'].some((term) => value.includes(term))
}

export function buildRepurchaseOpportunities(input: {
  orders: RepurchaseOrder[]
  blockedPhones?: Set<string>
  ignoredOrderIds?: Set<string>
  now?: number
}) {
  const now = input.now || Date.now()
  const blockedPhones = input.blockedPhones || new Set<string>()
  const ignoredOrderIds = input.ignoredOrderIds || new Set<string>()
  const openKeys = new Set<string>()
  const lastCompleted = new Map<string, RepurchaseOrder>()
  const counts = new Map<string, number>()

  for (const order of input.orders) {
    const phone = normalizeRepurchasePhone(order.telefone || order.customer_phone)
    const product = normalizeProduct(order.produto)
    if (!phone || !product) continue
    const key = `${phone}|${product}`

    if (isOpenForRepurchase(order.status)) openKeys.add(key)
    if (!isCompletedForRepurchase(order.status) || blockedPhones.has(phone)) continue

    counts.set(key, (counts.get(key) || 0) + 1)
    if (!lastCompleted.has(key)) lastCompleted.set(key, order)
  }

  return [...lastCompleted.entries()]
    .flatMap<RepurchaseOpportunity>(([key, order]) => {
      if (openKeys.has(key) || ignoredOrderIds.has(order.id)) return []

      const lastPurchaseAt = order.updated_at || order.created_at || null
      const purchaseTime = lastPurchaseAt ? new Date(lastPurchaseAt).getTime() : Number.NaN
      const daysSince = Math.floor((now - purchaseTime) / 86_400_000)
      if (!Number.isFinite(daysSince) || daysSince < 45 || daysSince > 365) return []

      const previousPurchases = counts.get(key) || 1
      const previousValue = Number(order.total_amount || order.total || order.valor_total || order.preco_estimado || 0)
      const score = Math.min(100, Math.round(35 + Math.min(daysSince, 180) / 4 + Math.min(previousPurchases * 8, 24)))

      return [{
        id: `repurchase:${order.id}`,
        orderId: order.id,
        customerName: order.nome || order.customer_name || 'Cliente',
        customerPhone: order.telefone || order.customer_phone || '',
        product: order.produto || 'Produto/serviço',
        lastPurchaseAt,
        daysSince,
        previousPurchases,
        previousValue,
        score,
        suggestion: previousPurchases > 1
          ? 'Este cliente já repetiu esse tipo de compra. Há sinal real de recorrência.'
          : `Já se passaram ${daysSince} dias desde a última compra. Pode ser uma boa hora para oferecer novamente.`,
      }]
    })
    .sort((a, b) => b.score - a.score || b.daysSince - a.daysSince)
}
