export const FEATURE_KEYS = [
  'customer_portal',
  'graphic_workflow_v2',
  'operational_events',
  'stage_automations',
  'adaptive_panel',
  'smart_onboarding',
  'operational_intelligence',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const OPERATIONAL_EVENT_TYPES = [
  'order.created',
  'order.status_changed',
  'quote.created',
  'quote.sent',
  'quote.approved',
  'quote.rejected',
  'artwork.created',
  'artwork.revision_requested',
  'artwork.approved',
  'payment.pending',
  'payment.paid',
  'production.started',
  'production.completed',
  'delivery.started',
  'delivery.completed',
  'customer.message_created',
] as const

export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number]

export const OPERATIONAL_ENTITY_TYPES = [
  'order',
  'quote',
  'artwork',
  'customer',
  'payment',
  'service_order',
  'appointment',
  'delivery',
] as const

export type OperationalEntityType = (typeof OPERATIONAL_ENTITY_TYPES)[number]
export type EntityType = OperationalEntityType

export const OPERATIONAL_VISIBILITIES = [
  'internal',
  'customer_visible',
  'system',
] as const

export type OperationalVisibility = (typeof OPERATIONAL_VISIBILITIES)[number]
export type Visibility = OperationalVisibility

export const OPERATIONAL_ACTOR_TYPES = [
  'user',
  'customer',
  'system',
  'integration',
] as const

export type OperationalActorType = (typeof OPERATIONAL_ACTOR_TYPES)[number]
export type ActorType = OperationalActorType

export const AUTOMATION_JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const

export type AutomationJobStatus = (typeof AUTOMATION_JOB_STATUSES)[number]

export const FOUNDATION_PERMISSIONS = [
  'orders.read',
  'orders.update',
  'quotes.approve',
  'artwork.manage',
  'production.manage',
  'portal.manage',
  'automation.manage',
] as const

export type FoundationPermission = (typeof FOUNDATION_PERMISSIONS)[number]

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type OperationalMetadata = Record<string, JsonValue>

export type OperationalEvent = {
  id: string
  companyId: string
  entityType: OperationalEntityType
  entityId: string
  eventType: OperationalEventType
  actorType: OperationalActorType
  actorId: string | null
  visibility: OperationalVisibility
  metadata: OperationalMetadata
  schemaVersion: number
  idempotencyKey: string | null
  requestId: string | null
  occurredAt: string
  createdAt: string
}

export type CreateOperationalEventInput = {
  companyId: string
  entityType: OperationalEntityType
  entityId: string
  eventType: OperationalEventType | string
  actorType?: OperationalActorType
  actorId?: string | null
  visibility?: OperationalVisibility
  metadata?: OperationalMetadata
  schemaVersion?: number
  idempotencyKey?: string | null
  requestId?: string | null
  occurredAt?: string
}

export type NormalizedOperationalEventInput = {
  companyId: string
  entityType: OperationalEntityType
  entityId: string
  eventType: OperationalEventType
  actorType: OperationalActorType
  actorId: string | null
  visibility: OperationalVisibility
  metadata: OperationalMetadata
  schemaVersion: number
  idempotencyKey: string | null
  requestId: string | null
  occurredAt: string
}

export type OperationalTimelineQuery = {
  companyId: string
  entityType: OperationalEntityType
  entityId: string
  visibility?: OperationalVisibility
  ascending?: boolean
  limit?: number
}

export type AutomationJob = {
  id: string
  companyId: string
  operationalEventId: string
  actionType: string
  status: AutomationJobStatus
  payload: OperationalMetadata
  idempotencyKey: string
  scheduledAt: string
  attempts: number
  maxAttempts: number
  lastError: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export type EnqueueAutomationJobInput = {
  companyId: string
  operationalEventId: string
  actionType: string
  payload?: OperationalMetadata
  idempotencyKey: string
  scheduledAt?: string
  maxAttempts?: number
}
