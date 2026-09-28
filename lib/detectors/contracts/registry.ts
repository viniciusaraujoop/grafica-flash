// Detector Contract Registry v1 — explicit EXISTING vs PLANNED.
//
// EXISTING detectors are implemented in lib/orcaly-smart-notifications.ts (event_type values),
// where they currently create notifications directly. They are NOT scheduled (vercel.json has no
// smart-notifications cron) and have no recipe runtime. PLANNED detectors do not exist in code
// and can never sustain a `runtime_candidate` recipe.

export type DetectorSubject = 'order' | 'proposal' | 'lead' | 'task' | 'product' | 'coupon' | 'company'

export type DetectorContractV1 = {
  key: string
  version: 1
  status: 'EXISTING' | 'PLANNED'
  subject: DetectorSubject
  source: 'lib/orcaly-smart-notifications.ts' | null
  existingDedupeKey: string | null
  scheduled: false
  note: string
}

export const DETECTORS: readonly DetectorContractV1[] = [
  {
    key: 'new_order',
    version: 1,
    status: 'EXISTING',
    subject: 'order',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'new_order:<order_id>',
    scheduled: false,
    note: 'Recently created order found by scan (duplicates order.created semantics; prefer the domain event).',
  },
  {
    key: 'order_stuck',
    version: 1,
    status: 'EXISTING',
    subject: 'order',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'order_stuck:<order_id>:<status>',
    scheduled: false,
    note: 'Order not final (entregue/cancel/finaliz) and not updated for N days (smart_notification_settings.order_stuck_days).',
  },
  {
    key: 'lead_idle',
    version: 1,
    status: 'EXISTING',
    subject: 'lead',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'lead_idle:<lead_id>:<etapa>',
    scheduled: false,
    note: 'Open lead whose proximo_contato_em/updated_at is older than N days.',
  },
  {
    key: 'proposal_idle',
    version: 1,
    status: 'EXISTING',
    subject: 'proposal',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'proposal_idle:<proposal_id>:<status>',
    scheduled: false,
    note: 'Open proposal without movement for N days.',
  },
  {
    key: 'task_due_today',
    version: 1,
    status: 'EXISTING',
    subject: 'task',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'task_due_today:<task_id>:<day>',
    scheduled: false,
    note: 'Internal task due today.',
  },
  {
    key: 'coupon_expiring',
    version: 1,
    status: 'EXISTING',
    subject: 'coupon',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'coupon_expiring:<coupon_id>:<ends_at_day>',
    scheduled: false,
    note: 'Marketplace coupon close to its end date.',
  },
  {
    key: 'product_no_image',
    version: 1,
    status: 'EXISTING',
    subject: 'product',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'product_no_image:<product_id>',
    scheduled: false,
    note: 'Active product without an image.',
  },
  {
    key: 'site_no_logo',
    version: 1,
    status: 'EXISTING',
    subject: 'company',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'site_no_logo:<company_id>',
    scheduled: false,
    note: 'Public site without logo.',
  },
  {
    key: 'subscription_expiring',
    version: 1,
    status: 'EXISTING',
    subject: 'company',
    source: 'lib/orcaly-smart-notifications.ts',
    existingDedupeKey: 'subscription_expiring:<company_id>:<expires_day>',
    scheduled: false,
    note: 'Orçaly subscription close to expiration (platform billing, not tenant finance).',
  },
  {
    key: 'stock_critical',
    version: 1,
    status: 'PLANNED',
    subject: 'product',
    source: null,
    existingDedupeKey: null,
    scheduled: false,
    note: 'Does not exist. Would compare products.estoque (nullable integer) with a threshold; no per-product threshold column exists.',
  },
]

export function getDetector(key: string, version: number): DetectorContractV1 | null {
  return DETECTORS.find((detector) => detector.key === key && detector.version === version) ?? null
}
