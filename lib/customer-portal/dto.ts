import { getBusinessTypeConfig } from '../business-types'
import { getOrderStatusVisual, normalizeOrderStatus } from '../order-status'
import type {
  CustomerPortalOrder,
  CustomerPortalOrderSource,
  CustomerPortalStatusTone,
  PortalOperationalEventSource,
  PortalTimelineEvent,
} from './contracts'

function cleanText(value: unknown, fallback = '', maxLength = 160) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return (normalized || fallback).slice(0, maxLength)
}

function safeDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function safeMoney(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function firstMoney(...values: unknown[]) {
  for (const value of values) {
    const number = safeMoney(value)
    if (number !== null) return number
  }
  return null
}

function safeColor(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function safeLogoUrl(value: unknown) {
  const url = String(value || '').trim()
  if (!url || url.length > 2048) return null
  if (url.startsWith('/')) return url

  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.supabase.co') &&
      parsed.pathname.startsWith('/storage/v1/object/public/') &&
      !parsed.pathname.toLowerCase().endsWith('.svg')
    )
      ? parsed.toString()
      : null
  } catch {
    return null
  }
}

function publicStatusLabel(status: unknown, businessType: unknown) {
  const raw = cleanText(status, 'Recebido', 80)
  const normalized = normalizeOrderStatus(raw)
  const config = getBusinessTypeConfig(businessType)

  const activeStatuses = new Set([
    'em_andamento',
    'andamento',
    'em_execucao',
    'execucao',
    'em_producao',
    'producao',
    'em_preparo',
    'preparo',
    'em_reparo',
    'reparo',
    'separando',
    'separacao',
    'em_preparacao',
  ])

  if (activeStatuses.has(normalized)) {
    if (config.id === 'graphic' || config.id === 'custom_products') {
      return 'Em produção'
    }
    if (config.id === 'food') return 'Em preparo'
    if (config.id === 'technical_assistance') return 'Em reparo'
    if (config.id === 'store') return 'Separando'
    if (config.id === 'events') return 'Em preparação'
    if (config.id === 'services' || config.id === 'auto') return 'Em execução'
  }

  const configured = config.statuses.find(
    (item) => normalizeOrderStatus(item) === normalized,
  )

  const knownStatuses = new Set([
    'recebido',
    'novo',
    'pendente',
    'aguardando',
    'em_analise',
    'analise',
    'aguardando_aprovacao',
    'aprovado',
    'pronto',
    'entregue',
    'concluido',
    'finalizado',
    'atendido',
    'cancelado',
    'canceled',
    'cancelled',
    'reprovado',
  ])

  return configured || (knownStatuses.has(normalized)
    ? getOrderStatusVisual(raw).label
    : 'Atualização em andamento')
}

function statusTone(label: string): CustomerPortalStatusTone {
  const status = normalizeOrderStatus(label)

  if (
    status.includes('cancel') ||
    status.includes('reprov') ||
    status.includes('recus')
  ) {
    return 'red'
  }

  if (
    status.includes('entreg') ||
    status.includes('conclu') ||
    status.includes('pronto') ||
    status.includes('aprov')
  ) {
    return 'green'
  }

  if (status.includes('aguard') || status.includes('pendente')) {
    return 'amber'
  }

  return status ? 'blue' : 'slate'
}

function statusDescription(label: string) {
  const status = normalizeOrderStatus(label)

  if (status.includes('receb') || status === 'novo') {
    return 'Recebemos sua solicitação e ela já está com a empresa.'
  }
  if (status.includes('analise') || status.includes('diagnostico')) {
    return 'A empresa está conferindo os detalhes do seu pedido.'
  }
  if (status.includes('aguardando_arte')) {
    return 'A empresa aguarda a definição ou o envio da arte.'
  }
  if (status.includes('aguardando_aprovacao')) {
    return 'O pedido aguarda uma aprovação para continuar.'
  }
  if (status.includes('aprov')) {
    return 'Seu pedido foi aprovado e seguirá para a próxima etapa.'
  }
  if (
    status.includes('produc') ||
    status.includes('preparo') ||
    status.includes('reparo') ||
    status.includes('execucao') ||
    status.includes('separando')
  ) {
    return 'A empresa está trabalhando no seu pedido.'
  }
  if (status.includes('pronto')) {
    return 'Seu pedido está pronto para a próxima etapa.'
  }
  if (status.includes('entreg') || status.includes('conclu')) {
    return 'Este pedido foi concluído.'
  }
  if (status.includes('cancel')) {
    return 'Este pedido foi cancelado. Fale com a empresa se precisar de ajuda.'
  }

  return 'Acompanhe aqui as próximas atualizações do seu pedido.'
}

function operationalEventStatus(
  event: PortalOperationalEventSource,
  businessType: unknown,
) {
  if (event.visibility !== 'customer_visible') return null

  const metadata =
    event.metadata && typeof event.metadata === 'object'
      ? (event.metadata as Record<string, unknown>)
      : {}
  const eventType = cleanText(event.event_type, '', 80)

  if (eventType === 'order.status_changed') {
    return publicStatusLabel(metadata.new_status, businessType)
  }

  const labels: Record<string, string> = {
    'order.created': 'Solicitação recebida',
    'quote.created': 'Orçamento preparado',
    'quote.sent': 'Orçamento enviado',
    'quote.approved': 'Orçamento aprovado',
    'quote.rejected': 'Orçamento recusado',
    'artwork.created': 'Arte preparada',
    'artwork.revision_requested': 'Alteração solicitada',
    'artwork.approved': 'Arte aprovada',
    'payment.paid': 'Pagamento confirmado',
    'production.started': publicStatusLabel('Em produção', businessType),
    'production.completed': 'Pronto',
    'delivery.started': 'Saiu para entrega',
    'delivery.completed': 'Entregue',
  }

  return labels[eventType] || null
}

function timelineFromSource(source: CustomerPortalOrderSource) {
  const businessType =
    source.company.business_type ||
    source.company.segmento ||
    source.company.modelo_negocio
  const events: Array<PortalTimelineEvent & { sortAt: number }> = []

  for (const event of source.operationalEvents) {
    const title = operationalEventStatus(event, businessType)
    if (!title) continue
    const occurredAt = safeDate(event.occurred_at)
    events.push({
      title,
      description: statusDescription(title),
      occurredAt,
      sortAt: occurredAt ? new Date(occurredAt).getTime() : 0,
      current: false,
    })
  }

  const seen = new Set<string>()
  const timeline = events
    .sort((left, right) => left.sortAt - right.sortAt)
    .filter((event) => {
      const key = `${normalizeOrderStatus(event.title)}:${event.occurredAt || 'unknown'}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((event) => ({
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      current: event.current,
    }))

  if (timeline.length > 0) timeline[timeline.length - 1].current = true
  return timeline
}

export function buildCustomerPortalOrder(
  source: CustomerPortalOrderSource,
): CustomerPortalOrder {
  if (
    source.access.entity_type !== 'order' ||
    source.access.company_id !== source.company.id ||
    source.access.company_id !== source.order.company_id ||
    source.access.entity_id !== source.order.id
  ) {
    throw new Error('Isolamento do Portal inválido.')
  }

  const businessType =
    source.company.business_type ||
    source.company.segmento ||
    source.company.modelo_negocio
  const statusLabel = publicStatusLabel(source.order.status, businessType)
  const subtotal = firstMoney(source.order.subtotal) ?? 0
  const discount = firstMoney(source.order.discount_amount) ?? 0
  const deliveryFee = firstMoney(source.order.delivery_fee) ?? 0
  const total = firstMoney(
    source.order.total_amount,
    source.order.total,
    source.order.valor_total,
    source.order.preco_estimado,
  )

  const items = source.items.map((item) => ({
    name: cleanText(item.product_name || item.nome, 'Item do pedido', 160),
    quantity: firstMoney(item.quantity, item.quantidade) ?? 1,
    unitPrice: firstMoney(item.unit_price, item.preco_unitario),
    total: firstMoney(item.total, item.subtotal),
  }))

  const rawDeliveryType = normalizeOrderStatus(
    cleanText(source.order.delivery_type, '', 40),
  )
  const deliveryType = rawDeliveryType === 'delivery'
    ? 'delivery'
    : rawDeliveryType === 'pickup' || rawDeliveryType === 'retirada'
      ? 'pickup'
      : 'unspecified'
  const estimatedAt = safeDate(
    source.delivery?.estimated_delivery_at ||
      source.order.prazo_entrega ||
      source.order.prazo,
  )

  return {
    schemaVersion: 1,
    company: {
      name: cleanText(source.company.nome, 'Empresa', 120),
      logoUrl: safeLogoUrl(source.company.logo_url),
      primaryColor: safeColor(source.company.site_primary_color, '#05245c'),
      accentColor: safeColor(source.company.site_accent_color, '#22c55e'),
    },
    order: {
      publicOrderNumber: null,
      title: cleanText(
        source.order.produto || items[0]?.name,
        'Pedido',
        160,
      ),
      status: {
        label: statusLabel,
        description: statusDescription(statusLabel),
        tone: statusTone(statusLabel),
      },
      createdAt: safeDate(source.order.created_at),
      estimatedDeliveryAt: estimatedAt,
      deliveredAt: safeDate(
        source.delivery?.delivered_at || source.order.entregue_em,
      ),
      totals: total === null
        ? null
        : {
            subtotal,
            discount,
            deliveryFee,
            total,
          },
    },
    items,
    timeline: timelineFromSource(source),
    delivery: source.delivery || deliveryType !== 'unspecified'
      ? {
          type: deliveryType,
          label: deliveryType === 'delivery'
            ? 'Entrega'
            : deliveryType === 'pickup'
              ? 'Retirada'
              : 'A combinar',
          status: source.delivery?.status
            ? cleanText(source.delivery.status, '', 80)
            : null,
          estimatedAt,
        }
      : null,
  }
}
