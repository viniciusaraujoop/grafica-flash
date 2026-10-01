import 'server-only'

export const EVENT_PAYLOAD_MAX_BYTES = 32 * 1024
export const RELAY_JOB_PAYLOAD_MAX_BYTES = 8 * 1024

export type EventScopeKind = 'company' | 'personal' | 'platform'

export type EventConsumerSpec = {
  jobType: string
  jobVersion: number
  maxAttempts: number
}

export type EventFabricRow = {
  id: string
  company_id: string | null
  user_id: string | null
  producer: string
  event_type: string
  event_version: number
  aggregate_type: string
  aggregate_id: string | null
  payload: unknown
  correlation_id: string
  causation_id?: string | null
}

export type EventAggregateContract = {
  type: 'order' | 'proposal'
  payloadResourceId: (payload: unknown) => unknown
}

export type EventContract = {
  producer: string
  eventType: string
  eventVersion: number
  scopeKinds: readonly EventScopeKind[]
  aggregate: EventAggregateContract
  consumers: readonly EventConsumerSpec[]
  validatePayload: (payload: unknown) => void
}

export class EventFabricContractError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EventFabricContractError'
    this.code = code
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRODUCER_RE = /^[a-z][a-z0-9_.-]{0,79}$/
const JOB_TYPE_RE = /^[a-z][a-z0-9_-]{0,39}\.[a-z][a-z0-9_.-]{0,79}$/

const FORBIDDEN_SECRET_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'servicerole',
  'refreshtoken',
  'accesstoken',
  'credential',
  'credentials',
  'oauthcode',
])

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null
  return value as Record<string, unknown>
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function serializedJsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isDomainQualifiedJobType(value: unknown): value is string {
  return typeof value === 'string' && JOB_TYPE_RE.test(value)
}

export function scopeKind(row: Pick<EventFabricRow, 'company_id' | 'user_id'>): EventScopeKind {
  if (row.company_id && row.user_id) {
    throw new EventFabricContractError('invalid_scope', 'Event Fabric scope cannot contain company_id and user_id together.')
  }
  if (row.company_id) return 'company'
  if (row.user_id) return 'personal'
  return 'platform'
}

export function payloadHasForbiddenSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(payloadHasForbiddenSecret)
  const record = plainRecord(value)
  if (!record) return false

  for (const [key, item] of Object.entries(record)) {
    if (FORBIDDEN_SECRET_KEYS.has(normalizedKey(key))) return true
    if (payloadHasForbiddenSecret(item)) return true
  }
  return false
}

function assertExactKeys(record: Record<string, unknown>, allowed: readonly string[]) {
  const allow = new Set(allowed)
  for (const key of Object.keys(record)) {
    if (!allow.has(key)) {
      throw new EventFabricContractError('unexpected_payload_field', 'Unexpected Event Fabric payload field: ' + key)
    }
  }
}

function boundedString(value: unknown, field: string, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new EventFabricContractError('invalid_payload', field + ' must be a non-empty bounded string.')
  }
}

function uuidField(value: unknown, field: string) {
  if (!isUuid(value)) {
    throw new EventFabricContractError('invalid_payload', field + ' must be a UUID.')
  }
}

function payloadResourceId(payload: unknown, field: 'order_id' | 'proposal_id') {
  const row = plainRecord(payload)
  return row?.[field] ?? null
}

function validateOrderCreated(payload: unknown) {
  const row = plainRecord(payload)
  if (!row) throw new EventFabricContractError('invalid_payload', 'order.created payload must be an object.')
  assertExactKeys(row, ['order_id', 'source'])
  uuidField(row.order_id, 'order_id')
  boundedString(row.source, 'source', 80)
}

function validateOrderReady(payload: unknown) {
  const row = plainRecord(payload)
  if (!row) throw new EventFabricContractError('invalid_payload', 'order.ready payload must be an object.')
  assertExactKeys(row, ['order_id', 'status'])
  uuidField(row.order_id, 'order_id')
  boundedString(row.status, 'status', 120)
}

function validatePaymentConfirmed(payload: unknown) {
  const row = plainRecord(payload)
  if (!row) throw new EventFabricContractError('invalid_payload', 'payment.confirmed payload must be an object.')
  assertExactKeys(row, ['order_id', 'payment_status'])
  uuidField(row.order_id, 'order_id')
  boundedString(row.payment_status, 'payment_status', 120)
}

function validateProposalAccepted(payload: unknown) {
  const row = plainRecord(payload)
  if (!row) throw new EventFabricContractError('invalid_payload', 'proposal.accepted payload must be an object.')
  assertExactKeys(row, ['proposal_id', 'status'])
  uuidField(row.proposal_id, 'proposal_id')
  boundedString(row.status, 'status', 120)
}

const EVENT_CONTRACTS: readonly EventContract[] = [
  {
    producer: 'business',
    eventType: 'order.created',
    eventVersion: 1,
    scopeKinds: ['company'],
    aggregate: {
      type: 'order',
      payloadResourceId: (payload) => payloadResourceId(payload, 'order_id'),
    },
    consumers: [],
    validatePayload: validateOrderCreated,
  },
  {
    producer: 'business',
    eventType: 'order.ready',
    eventVersion: 1,
    scopeKinds: ['company'],
    aggregate: {
      type: 'order',
      payloadResourceId: (payload) => payloadResourceId(payload, 'order_id'),
    },
    consumers: [],
    validatePayload: validateOrderReady,
  },
  {
    producer: 'business',
    eventType: 'payment.confirmed',
    eventVersion: 1,
    scopeKinds: ['company'],
    aggregate: {
      type: 'order',
      payloadResourceId: (payload) => payloadResourceId(payload, 'order_id'),
    },
    consumers: [],
    validatePayload: validatePaymentConfirmed,
  },
  {
    producer: 'business',
    eventType: 'proposal.accepted',
    eventVersion: 1,
    scopeKinds: ['company'],
    aggregate: {
      type: 'proposal',
      payloadResourceId: (payload) => payloadResourceId(payload, 'proposal_id'),
    },
    consumers: [],
    validatePayload: validateProposalAccepted,
  },
]

const EVENT_REGISTRY = new Map(
  EVENT_CONTRACTS.map((contract) => [
    contract.producer + ':' + contract.eventType + ':v' + contract.eventVersion,
    contract,
  ]),
)

export function getEventContract(producer: string, eventType: string, eventVersion: number) {
  return EVENT_REGISTRY.get(producer + ':' + eventType + ':v' + eventVersion) || null
}

export function validateEventRecord(row: EventFabricRow) {
  if (!PRODUCER_RE.test(row.producer)) {
    throw new EventFabricContractError('invalid_producer', 'Event producer identifier is invalid.')
  }
  if (!Number.isInteger(row.event_version) || row.event_version < 1 || row.event_version > 32767) {
    throw new EventFabricContractError('invalid_event_version', 'Event version is invalid.')
  }
  if (!isUuid(row.id) || !isUuid(row.correlation_id)) {
    throw new EventFabricContractError('invalid_event_identity', 'Event identity or correlation is invalid.')
  }
  if (serializedJsonBytes(row.payload) > EVENT_PAYLOAD_MAX_BYTES) {
    throw new EventFabricContractError('payload_too_large', 'Event payload exceeds 32 KiB.')
  }
  if (payloadHasForbiddenSecret(row.payload)) {
    throw new EventFabricContractError('secret_bearing_payload', 'Event payload contains a forbidden credential-class field.')
  }

  const contract = getEventContract(row.producer, row.event_type, row.event_version)
  if (!contract) {
    throw new EventFabricContractError('unknown_event_contract', 'Event contract is not allowlisted.')
  }

  const scope = scopeKind(row)
  if (!contract.scopeKinds.includes(scope)) {
    throw new EventFabricContractError('scope_not_allowed', 'Event scope is not allowed by this contract.')
  }

  contract.validatePayload(row.payload)

  if (row.aggregate_type !== contract.aggregate.type) {
    throw new EventFabricContractError(
      'invalid_aggregate_type',
      'Event aggregate_type does not match the allowlisted contract.',
    )
  }

  if (!isUuid(row.aggregate_id)) {
    throw new EventFabricContractError(
      'invalid_aggregate_id',
      'Event aggregate_id must be a UUID required by the allowlisted contract.',
    )
  }

  const resourceId = contract.aggregate.payloadResourceId(row.payload)
  if (!isUuid(resourceId)) {
    throw new EventFabricContractError(
      'invalid_payload',
      'Event payload resource identity is invalid.',
    )
  }

  if (resourceId !== row.aggregate_id) {
    throw new EventFabricContractError(
      'aggregate_resource_mismatch',
      'Event aggregate_id does not match the payload resource identity.',
    )
  }

  return contract
}

export function allEventContracts() {
  return [...EVENT_CONTRACTS]
}
