// Event Contract Registry v1 — ONLY events proven to exist in production.
//
// Evidence (production, read-only): trigger function public.orcaly_record_business_event()
// inserts into public.transactional_outbox on orders/proposals writes. As of main d940deb there
// is NO consumer/dispatcher for the outbox; registration here is contract metadata only.
//
// Not registered on purpose: stock.low, customer.inactive, contract.expiring (do not exist),
// and timeline-only events (never written to the outbox; see TIMELINE_ONLY_EVENTS).

export type EventAggregateType = 'order' | 'proposal'

export type EventContractV1 = {
  eventType: string
  version: 1
  status: 'EXISTING'
  aggregateType: EventAggregateType
  channel: 'transactional_outbox'
  emittedBy: 'public.orcaly_record_business_event'
  emittedOn: string
  payloadFields: readonly string[]
  consumerRuntime: 'NONE'
}

export const DOMAIN_EVENTS: readonly EventContractV1[] = [
  {
    eventType: 'order.created',
    version: 1,
    status: 'EXISTING',
    aggregateType: 'order',
    channel: 'transactional_outbox',
    emittedBy: 'public.orcaly_record_business_event',
    emittedOn: 'INSERT on public.orders',
    payloadFields: ['order_id', 'source'],
    consumerRuntime: 'NONE',
  },
  {
    eventType: 'order.ready',
    version: 1,
    status: 'EXISTING',
    aggregateType: 'order',
    channel: 'transactional_outbox',
    emittedBy: 'public.orcaly_record_business_event',
    emittedOn: "UPDATE on public.orders when status changes to pronto|ready|pronto_para_entrega|'pronto para entrega'",
    payloadFields: ['order_id', 'status'],
    consumerRuntime: 'NONE',
  },
  {
    eventType: 'payment.confirmed',
    version: 1,
    status: 'EXISTING',
    aggregateType: 'order',
    channel: 'transactional_outbox',
    emittedBy: 'public.orcaly_record_business_event',
    emittedOn: 'UPDATE on public.orders when payment_status changes to paid|approved|pago|aprovado|authorized',
    payloadFields: ['order_id', 'payment_status'],
    consumerRuntime: 'NONE',
  },
  {
    eventType: 'proposal.accepted',
    version: 1,
    status: 'EXISTING',
    aggregateType: 'proposal',
    channel: 'transactional_outbox',
    emittedBy: 'public.orcaly_record_business_event',
    emittedOn: 'UPDATE on public.proposals when status changes to approved|aprovado|aprovada',
    payloadFields: ['proposal_id', 'status'],
    consumerRuntime: 'NONE',
  },
]

/** Written only to public.timeline_events. They are NOT domain events and cannot trigger recipes. */
export const TIMELINE_ONLY_EVENTS: readonly string[] = ['order.status_changed', 'proposal.created', 'proposal.status_changed']

export function getDomainEvent(eventType: string, version: number): EventContractV1 | null {
  return DOMAIN_EVENTS.find((event) => event.eventType === eventType && event.version === version) ?? null
}
