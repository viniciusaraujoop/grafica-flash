import 'server-only'

import { getSupabaseAdmin } from '@/lib/company-access'
import { isFeatureEnabled } from '@/lib/foundation/feature-flags.server'
import { buildCustomerPortalOrder } from './dto'
import type {
  CustomerPortalAccessRow,
  PortalCompanySource,
  PortalDeliverySource,
  PortalItemSource,
  PortalOperationalEventSource,
  PortalOrderSource,
} from './contracts'
import {
  getCustomerPortalAccessFailure,
  hashCustomerPortalToken,
  isCustomerPortalToken,
} from './tokens'

const accessColumns = [
  'id',
  'company_id',
  'entity_type',
  'entity_id',
  'token_hash',
  'status',
  'expires_at',
  'revoked_at',
  'last_accessed_at',
  'access_count',
  'created_at',
].join(',')

const companyColumns = [
  'id',
  'nome',
  'logo_url',
  'site_primary_color',
  'site_accent_color',
  'business_type',
  'segmento',
  'modelo_negocio',
  'ativo',
].join(',')

const orderColumns = [
  'id',
  'company_id',
  'produto',
  'status',
  'created_at',
  'prazo',
  'prazo_entrega',
  'subtotal',
  'discount_amount',
  'delivery_fee',
  'total',
  'total_amount',
  'valor_total',
  'preco_estimado',
  'delivery_type',
  'entregue_em',
].join(',')

const itemColumns = [
  'product_name',
  'nome',
  'quantity',
  'quantidade',
  'unit_price',
  'preco_unitario',
  'total',
  'subtotal',
  'created_at',
].join(',')

export type ResolvedCustomerPortalOrder = {
  dto: ReturnType<typeof buildCustomerPortalOrder>
  accessId: string
  tokenHash: string
}

function isMissingPortalTable(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST205' ||
    String(error.message || '').includes('customer_portal_access')
  )
}

export async function resolveCustomerPortalOrder(
  rawToken: unknown,
): Promise<ResolvedCustomerPortalOrder | null> {
  if (!isCustomerPortalToken(rawToken)) return null

  const tokenHash = hashCustomerPortalToken(rawToken)
  const supabase = getSupabaseAdmin()
  const { data: rawAccess, error: accessError } = await supabase
    .from('customer_portal_access')
    .select(accessColumns)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (accessError) {
    if (isMissingPortalTable(accessError)) return null
    throw accessError
  }

  const access = rawAccess as unknown as CustomerPortalAccessRow | null
  if (getCustomerPortalAccessFailure(access)) return null
  if (!access || access.entity_type !== 'order') return null

  const portalEnabled = await isFeatureEnabled('customer_portal', {
    companyId: access.company_id,
    supabase,
  })
  if (!portalEnabled) return null

  const [companyResult, orderResult, itemsResult, eventsResult, deliveryResult] =
    await Promise.all([
      supabase
        .from('companies')
        .select(companyColumns)
        .eq('id', access.company_id)
        .maybeSingle(),
      supabase
        .from('orders')
        .select(orderColumns)
        .eq('id', access.entity_id)
        .eq('company_id', access.company_id)
        .maybeSingle(),
      supabase
        .from('order_items')
        .select(itemColumns)
        .eq('order_id', access.entity_id)
        .eq('company_id', access.company_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('operational_events')
        .select('event_type,visibility,metadata,occurred_at')
        .eq('company_id', access.company_id)
        .eq('entity_type', 'order')
        .eq('entity_id', access.entity_id)
        .eq('visibility', 'customer_visible')
        .order('occurred_at', { ascending: true })
        .limit(100),
      supabase
        .from('deliveries')
        .select('status,estimated_delivery_at,delivered_at')
        .eq('company_id', access.company_id)
        .eq('order_id', access.entity_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  for (const result of [
    companyResult,
    orderResult,
    itemsResult,
    eventsResult,
    deliveryResult,
  ]) {
    if (result.error) throw result.error
  }

  const company = companyResult.data as unknown as PortalCompanySource | null
  const order = orderResult.data as unknown as PortalOrderSource | null

  if (!company || company.ativo === false || !order) return null

  const dto = buildCustomerPortalOrder({
    access,
    company,
    order,
    items: (itemsResult.data || []) as unknown as PortalItemSource[],
    operationalEvents: (eventsResult.data || []) as unknown as PortalOperationalEventSource[],
    delivery: deliveryResult.data as unknown as PortalDeliverySource | null,
  })

  return {
    dto,
    accessId: access.id,
    tokenHash,
  }
}

export async function recordCustomerPortalAccess(
  accessId: string,
  tokenHash: string,
) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.rpc(
    'orcaly_record_customer_portal_access',
    {
      p_access_id: accessId,
      p_token_hash: tokenHash,
    },
  )

  if (error) throw error
}
