export const CUSTOMER_PORTAL_ENTITY_TYPES = [
  'order',
  'quote',
  'service_order',
  'appointment',
] as const

export type CustomerPortalEntityType =
  (typeof CUSTOMER_PORTAL_ENTITY_TYPES)[number]

export type CustomerPortalAccessRow = {
  id: string
  company_id: string
  entity_type: CustomerPortalEntityType
  entity_id: string
  token_hash: string
  status: 'active' | 'revoked'
  expires_at: string | null
  revoked_at: string | null
  last_accessed_at: string | null
  access_count: number
  created_at: string
}

export type CustomerPortalAccessFailure =
  | 'invalid_token'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'unsupported_entity'

export type CustomerPortalStatusTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'slate'

export type PortalTimelineEvent = {
  title: string
  description: string
  occurredAt: string | null
  current: boolean
}

export type PortalItem = {
  name: string
  quantity: number
  unitPrice: number | null
  total: number | null
}

export type CustomerPortalOrder = {
  schemaVersion: 1
  company: {
    name: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
  }
  order: {
    publicOrderNumber: string | null
    title: string
    status: {
      label: string
      description: string
      tone: CustomerPortalStatusTone
    }
    createdAt: string | null
    estimatedDeliveryAt: string | null
    deliveredAt: string | null
    totals: {
      subtotal: number
      discount: number
      deliveryFee: number
      total: number
    } | null
  }
  items: PortalItem[]
  timeline: PortalTimelineEvent[]
  delivery: {
    type: 'delivery' | 'pickup' | 'unspecified'
    label: string
    status: string | null
    estimatedAt: string | null
  } | null
}

export type PortalCompanySource = {
  id: string
  nome?: unknown
  logo_url?: unknown
  site_primary_color?: unknown
  site_accent_color?: unknown
  business_type?: unknown
  segmento?: unknown
  modelo_negocio?: unknown
  ativo?: unknown
}

export type PortalOrderSource = {
  id: string
  company_id: string
  produto?: unknown
  status?: unknown
  created_at?: unknown
  prazo?: unknown
  prazo_entrega?: unknown
  subtotal?: unknown
  discount_amount?: unknown
  delivery_fee?: unknown
  total?: unknown
  total_amount?: unknown
  valor_total?: unknown
  preco_estimado?: unknown
  delivery_type?: unknown
  entregue_em?: unknown
}

export type PortalItemSource = Record<string, unknown>

export type PortalOperationalEventSource = {
  event_type?: unknown
  visibility?: unknown
  metadata?: unknown
  occurred_at?: unknown
}

export type PortalDeliverySource = {
  status?: unknown
  estimated_delivery_at?: unknown
  delivered_at?: unknown
}

export type CustomerPortalOrderSource = {
  access: Pick<
    CustomerPortalAccessRow,
    'company_id' | 'entity_type' | 'entity_id'
  >
  company: PortalCompanySource
  order: PortalOrderSource
  items: PortalItemSource[]
  operationalEvents: PortalOperationalEventSource[]
  delivery: PortalDeliverySource | null
}
