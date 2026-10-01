import 'server-only'

import { createHash } from 'node:crypto'

export const SHARED_AUDIT_CONTRACT_VERSION = 1 as const

export type SharedAuditResult =
  | 'ATTEMPTED'
  | 'REJECTED'
  | 'AUTHORIZED'
  | 'EXECUTED'
  | 'FAILED'
  | 'COMPLETED'
  | 'SKIPPED'

export type SharedAuditScopeKind = 'COMPANY' | 'PERSONAL' | 'PLATFORM'
export type SharedAuditActorKind = 'USER' | 'SERVICE' | 'SYSTEM' | 'AUTOMATION' | 'AI'

type MetadataRule =
  | { type: 'string'; maxLength: number }
  | { type: 'boolean' }
  | { type: 'number' }

export type SharedAuditActionContract = {
  key: string
  keyVersion: number
  actor: {
    kind: Exclude<SharedAuditActorKind, 'USER'>
    actorKey: string
  }
  scope: {
    kind: 'PLATFORM'
  }
  productId: string | null
  resourceType: string
  purposeKey: string
  source: string
  retentionClass: 'AUDIT_STANDARD' | 'AUDIT_EXTENDED'
  riskClass: string
  approvalRequired: boolean
  confirmationRequired: boolean
  assistanceMode: 'NONE' | 'AI_RECOMMENDATION' | 'AI_DRAFT' | 'AI_HUMAN_CONFIRMED'
  allowedResults: readonly SharedAuditResult[]
  metadata: Readonly<Record<string, MetadataRule>>
}

export type SharedAuditActionInput = {
  actionInstanceId: string
  result: SharedAuditResult
  resourceId: string
  requestId?: string | null
  correlationId?: string | null
  causationId?: string | null
  eventId?: string | null
  metadata?: Record<string, unknown> | null
}

export type CanonicalSharedAuditActionRow = {
  actor_id: null
  event_type: string
  entity_id: string
  audit_contract_version: 1
  audit_kind: 'ACTION'
  key_version: number
  actor_kind: Exclude<SharedAuditActorKind, 'USER'>
  actor_key: string
  scope_kind: 'PLATFORM'
  company_id: null
  scope_user_id: null
  subject_user_id: null
  product_id: string | null
  resource_type: string
  purpose_key: string
  source: string
  request_id: string | null
  correlation_id: string | null
  causation_id: string | null
  event_id: string | null
  action_instance_id: string
  result: SharedAuditResult
  risk_class: string
  approval_required: boolean
  confirmation_required: boolean
  assistance_mode: 'NONE' | 'AI_RECOMMENDATION' | 'AI_DRAFT' | 'AI_HUMAN_CONFIRMED'
  retention_class: 'AUDIT_STANDARD' | 'AUDIT_EXTENDED'
  row_table: null
  row_operation: null
  changed_fields: null
  before_snapshot: null
  after_snapshot: null
  metadata: Record<string, unknown>
  dedupe_key: string
}

export class SharedAuditContractError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SharedAuditContractError'
    this.code = code
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CANONICAL_KEY_RE =
  /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/
const SECRET_KEY_RE =
  /password|passwd|authorization|cookie|access[_-]?token|refresh[_-]?token|service[_-]?role|api[_-]?key|secret|credential|oauth[_-]?code|client[_-]?secret|cvv|card[_-]?(number|data)|raw_(payment|webhook|provider)/i

const ACTION_REGISTRY: Readonly<Record<string, SharedAuditActionContract>> = {
  'platform.shared_audit.verify': {
    key: 'platform.shared_audit.verify',
    keyVersion: 1,
    actor: {
      kind: 'SYSTEM',
      actorKey: 'system.shared_audit_verifier',
    },
    scope: {
      kind: 'PLATFORM',
    },
    productId: null,
    resourceType: 'platform.shared_audit_verification',
    purposeKey: 'shared_audit.verification',
    source: 'm1b.shared_audit',
    retentionClass: 'AUDIT_STANDARD',
    riskClass: 'LOW',
    approvalRequired: false,
    confirmationRequired: false,
    assistanceMode: 'NONE',
    allowedResults: ['COMPLETED', 'FAILED', 'SKIPPED'],
    metadata: {
      check: { type: 'string', maxLength: 120 },
      note: { type: 'string', maxLength: 256 },
      passed: { type: 'boolean' },
    },
  },
}

function assertCanonicalKey(value: string, field: string, maxLength: number) {
  if (
    value.length < 1 ||
    value.length > maxLength ||
    !CANONICAL_KEY_RE.test(value)
  ) {
    throw new SharedAuditContractError(
      'invalid_identifier',
      field + ' violates the canonical Shared Audit identifier contract.',
    )
  }
}

function assertUuid(value: string | null | undefined, field: string) {
  if (value == null) return
  if (!UUID_RE.test(value)) {
    throw new SharedAuditContractError(
      'invalid_uuid',
      field + ' must be a UUID.',
    )
  }
}

function validateNestedMetadata(value: unknown, depth = 0): void {
  if (depth > 4) {
    throw new SharedAuditContractError(
      'metadata_depth',
      'Shared Audit metadata exceeds maximum depth.',
    )
  }

  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return
  }

  if (typeof value === 'string') {
    if (value.length > 512) {
      throw new SharedAuditContractError(
        'metadata_string_length',
        'Shared Audit metadata string is too long.',
      )
    }
    return
  }

  if (Array.isArray(value)) {
    if (value.length > 20) {
      throw new SharedAuditContractError(
        'metadata_array_length',
        'Shared Audit metadata array is too large.',
      )
    }
    for (const item of value) validateNestedMetadata(item, depth + 1)
    return
  }

  if (!value || typeof value !== 'object') {
    throw new SharedAuditContractError(
      'metadata_type',
      'Shared Audit metadata contains an unsupported value.',
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > 32) {
    throw new SharedAuditContractError(
      'metadata_key_count',
      'Shared Audit metadata contains too many keys.',
    )
  }

  for (const [key, item] of entries) {
    if (SECRET_KEY_RE.test(key)) {
      throw new SharedAuditContractError(
        'metadata_secret_key',
        'Shared Audit metadata contains a forbidden credential-class key.',
      )
    }
    if (key.length < 1 || key.length > 96) {
      throw new SharedAuditContractError(
        'metadata_key_length',
        'Shared Audit metadata key length is invalid.',
      )
    }
    validateNestedMetadata(item, depth + 1)
  }
}

function validateActionMetadata(
  contract: SharedAuditActionContract,
  metadata: Record<string, unknown> | null | undefined,
) {
  const value = metadata || {}
  validateNestedMetadata(value)

  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(contract.metadata, key)) {
      throw new SharedAuditContractError(
        'metadata_key_not_allowed',
        'Shared Audit metadata key is not allowlisted for this action.',
      )
    }
  }

  for (const [key, raw] of Object.entries(value)) {
    const rule = contract.metadata[key]
    if (!rule) continue

    if (rule.type === 'string') {
      if (typeof raw !== 'string' || raw.length > rule.maxLength) {
        throw new SharedAuditContractError(
          'metadata_value_invalid',
          'Shared Audit metadata value is invalid for ' + key + '.',
        )
      }
    } else if (rule.type === 'boolean') {
      if (typeof raw !== 'boolean') {
        throw new SharedAuditContractError(
          'metadata_value_invalid',
          'Shared Audit metadata value is invalid for ' + key + '.',
        )
      }
    } else if (rule.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new SharedAuditContractError(
          'metadata_value_invalid',
          'Shared Audit metadata value is invalid for ' + key + '.',
        )
      }
    }
  }

  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 8192) {
    throw new SharedAuditContractError(
      'metadata_too_large',
      'Shared Audit metadata exceeds 8 KiB.',
    )
  }

  return value
}

export function getSharedAuditActionContract(actionKey: string) {
  const contract = ACTION_REGISTRY[actionKey]
  if (!contract) {
    throw new SharedAuditContractError(
      'unknown_action',
      'Unknown canonical Shared Audit action.',
    )
  }
  return contract
}

export function deriveSharedAuditDedupeKey(
  actionKey: string,
  keyVersion: number,
  actionInstanceId: string,
  result: SharedAuditResult,
) {
  const canonicalTuple = JSON.stringify([
    actionKey,
    keyVersion,
    actionInstanceId,
    result,
  ])

  return (
    'a1:' +
    createHash('sha256').update(canonicalTuple, 'utf8').digest('hex')
  )
}

export function buildCanonicalSharedAuditAction(
  actionKey: string,
  input: SharedAuditActionInput,
): CanonicalSharedAuditActionRow {
  const contract = getSharedAuditActionContract(actionKey)

  assertCanonicalKey(contract.key, 'event_type', 160)
  assertCanonicalKey(contract.resourceType, 'resource_type', 96)
  assertCanonicalKey(contract.actor.actorKey, 'actor_key', 128)
  assertCanonicalKey(contract.source, 'source', 96)
  assertCanonicalKey(contract.purposeKey, 'purpose_key', 128)
  if (contract.productId) {
    assertCanonicalKey(contract.productId, 'product_id', 64)
  }

  assertUuid(input.actionInstanceId, 'action_instance_id')
  assertUuid(input.correlationId, 'correlation_id')
  assertUuid(input.causationId, 'causation_id')
  assertUuid(input.eventId, 'event_id')

  if (
    input.resourceId.length < 1 ||
    input.resourceId.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(input.resourceId)
  ) {
    throw new SharedAuditContractError(
      'invalid_resource_id',
      'Shared Audit resource id violates canonical bounds.',
    )
  }

  if (
    input.requestId != null &&
    (
      input.requestId.length < 1 ||
      input.requestId.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(input.requestId)
    )
  ) {
    throw new SharedAuditContractError(
      'invalid_request_id',
      'Shared Audit request id violates canonical bounds.',
    )
  }

  if (!contract.allowedResults.includes(input.result)) {
    throw new SharedAuditContractError(
      'invalid_result',
      'Shared Audit lifecycle result is not allowed for this action.',
    )
  }

  const metadata = validateActionMetadata(contract, input.metadata)
  const dedupeKey = deriveSharedAuditDedupeKey(
    contract.key,
    contract.keyVersion,
    input.actionInstanceId,
    input.result,
  )

  return {
    actor_id: null,
    event_type: contract.key,
    entity_id: input.resourceId,
    audit_contract_version: SHARED_AUDIT_CONTRACT_VERSION,
    audit_kind: 'ACTION',
    key_version: contract.keyVersion,
    actor_kind: contract.actor.kind,
    actor_key: contract.actor.actorKey,
    scope_kind: contract.scope.kind,
    company_id: null,
    scope_user_id: null,
    subject_user_id: null,
    product_id: contract.productId,
    resource_type: contract.resourceType,
    purpose_key: contract.purposeKey,
    source: contract.source,
    request_id: input.requestId || null,
    correlation_id: input.correlationId || null,
    causation_id: input.causationId || null,
    event_id: input.eventId || null,
    action_instance_id: input.actionInstanceId,
    result: input.result,
    risk_class: contract.riskClass,
    approval_required: contract.approvalRequired,
    confirmation_required: contract.confirmationRequired,
    assistance_mode: contract.assistanceMode,
    retention_class: contract.retentionClass,
    row_table: null,
    row_operation: null,
    changed_fields: null,
    before_snapshot: null,
    after_snapshot: null,
    metadata,
    dedupe_key: dedupeKey,
  }
}

export function sharedAuditActionRegistrySnapshot() {
  return Object.values(ACTION_REGISTRY).map((contract) => ({
    key: contract.key,
    keyVersion: contract.keyVersion,
    actorKind: contract.actor.kind,
    scopeKind: contract.scope.kind,
    productId: contract.productId,
    resourceType: contract.resourceType,
    purposeKey: contract.purposeKey,
    source: contract.source,
    allowedResults: [...contract.allowedResults],
  }))
}
