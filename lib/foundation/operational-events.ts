import {
  OPERATIONAL_ACTOR_TYPES,
  OPERATIONAL_ENTITY_TYPES,
  OPERATIONAL_EVENT_TYPES,
  OPERATIONAL_VISIBILITIES,
  type AutomationJob,
  type CreateOperationalEventInput,
  type EnqueueAutomationJobInput,
  type JsonValue,
  type NormalizedOperationalEventInput,
  type OperationalActorType,
  type OperationalEntityType,
  type OperationalEvent,
  type OperationalEventType,
  type OperationalMetadata,
  type OperationalTimelineQuery,
  type OperationalVisibility,
} from './contracts'

export type EventFailureMode = 'critical' | 'best_effort'

export type EventPersistenceResult = {
  event: OperationalEvent
  created: boolean
}

export type AutomationJobPersistenceResult = {
  job: AutomationJob
  created: boolean
}

export type EventDispatchResult = {
  event: OperationalEvent | null
  created: boolean
  duplicate: boolean
  error?: string
}

export interface OperationalEventRepository {
  createOrGet(input: NormalizedOperationalEventInput): Promise<EventPersistenceResult>
  listTimeline(query: Required<OperationalTimelineQuery>): Promise<OperationalEvent[]>
  enqueueJob(input: Required<EnqueueAutomationJobInput>): Promise<AutomationJobPersistenceResult>
}

type EventLogger = (message: string, context: Record<string, unknown>) => void

const eventTypeSet = new Set<string>(OPERATIONAL_EVENT_TYPES)
const entityTypeSet = new Set<string>(OPERATIONAL_ENTITY_TYPES)
const actorTypeSet = new Set<string>(OPERATIONAL_ACTOR_TYPES)
const visibilitySet = new Set<string>(OPERATIONAL_VISIBILITIES)
const sensitiveMetadataKey = /(^|_)(authorization|password|senha|token|secret|segredo|card|cartao|cvv|cpf|cnpj|email|phone|telefone)($|_)/i

function normalizeIdentifier(value: unknown) {
  return String(value || '').trim()
}

function normalizeKeyPart(value: unknown) {
  return normalizeIdentifier(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export function normalizeOperationalEventType(value: unknown): OperationalEventType {
  const normalized = normalizeKeyPart(value).replace(/_/g, (match, offset, source) => {
    const before = source.slice(0, offset)
    return before.includes('.') ? match : '.'
  })

  if (!eventTypeSet.has(normalized)) {
    throw new Error(`Evento operacional nao suportado: ${normalized || 'empty'}`)
  }

  return normalized as OperationalEventType
}

export function normalizeOperationalVisibility(value: unknown): OperationalVisibility {
  const normalized = normalizeKeyPart(value || 'internal')
  if (!visibilitySet.has(normalized)) {
    throw new Error(`Visibilidade operacional invalida: ${normalized || 'empty'}`)
  }
  return normalized as OperationalVisibility
}

export function buildIdempotencyKey(...parts: unknown[]) {
  const key = parts.map(normalizeKeyPart).filter(Boolean).join(':')
  if (key.length < 8 || key.length > 200) {
    throw new Error('Chave de idempotencia deve ter entre 8 e 200 caracteres.')
  }
  return key
}

function validateJsonValue(value: JsonValue, path: string, depth: number): void {
  if (depth > 6) throw new Error(`Metadata excede profundidade permitida em ${path}.`)

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Numero invalido em ${path}.`)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, depth + 1))
    return
  }

  for (const [key, item] of Object.entries(value)) {
    if (sensitiveMetadataKey.test(key)) {
      throw new Error(`Metadata sensivel nao permitida em ${path}.${key}.`)
    }
    validateJsonValue(item, `${path}.${key}`, depth + 1)
  }
}

export function validateOperationalMetadata(metadata: OperationalMetadata) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new Error('Metadata deve ser um objeto JSON.')
  }

  validateJsonValue(metadata, 'metadata', 0)

  const encoded = JSON.stringify(metadata)
  if (new TextEncoder().encode(encoded).byteLength > 16_384) {
    throw new Error('Metadata excede o limite de 16 KiB.')
  }

  return metadata
}

function normalizeEntityType(value: unknown): OperationalEntityType {
  const normalized = normalizeKeyPart(value)
  if (!entityTypeSet.has(normalized)) {
    throw new Error(`Entidade operacional invalida: ${normalized || 'empty'}`)
  }
  return normalized as OperationalEntityType
}

function normalizeActorType(value: unknown): OperationalActorType {
  const normalized = normalizeKeyPart(value || 'system')
  if (!actorTypeSet.has(normalized)) {
    throw new Error(`Ator operacional invalido: ${normalized || 'empty'}`)
  }
  return normalized as OperationalActorType
}

function normalizedIsoDate(value: unknown, field: string) {
  const date = value ? new Date(String(value)) : new Date()
  if (Number.isNaN(date.getTime())) throw new Error(`${field} invalido.`)
  return date.toISOString()
}

export function normalizeOperationalEventInput(
  input: CreateOperationalEventInput,
): NormalizedOperationalEventInput {
  const companyId = normalizeIdentifier(input.companyId)
  const entityId = normalizeIdentifier(input.entityId)
  const actorId = input.actorId == null ? null : normalizeIdentifier(input.actorId)
  const requestId = input.requestId == null ? null : normalizeIdentifier(input.requestId)
  const idempotencyKey = input.idempotencyKey == null
    ? null
    : normalizeIdentifier(input.idempotencyKey)

  if (!companyId) throw new Error('companyId obrigatorio.')
  if (!entityId || entityId.length > 200) throw new Error('entityId invalido.')
  if (actorId !== null && (!actorId || actorId.length > 200)) throw new Error('actorId invalido.')
  if (requestId !== null && (!requestId || requestId.length > 128)) throw new Error('requestId invalido.')
  if (idempotencyKey !== null && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
    throw new Error('idempotencyKey invalida.')
  }

  const schemaVersion = input.schemaVersion ?? 1
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 32_767) {
    throw new Error('schemaVersion invalida.')
  }

  return {
    companyId,
    entityType: normalizeEntityType(input.entityType),
    entityId,
    eventType: normalizeOperationalEventType(input.eventType),
    actorType: normalizeActorType(input.actorType),
    actorId,
    visibility: normalizeOperationalVisibility(input.visibility),
    metadata: validateOperationalMetadata(input.metadata || {}),
    schemaVersion,
    idempotencyKey,
    requestId,
    occurredAt: normalizedIsoDate(input.occurredAt, 'occurredAt'),
  }
}

export async function dispatchOperationalEvent(
  repository: OperationalEventRepository,
  input: CreateOperationalEventInput,
  options: {
    failureMode?: EventFailureMode
    logger?: EventLogger
  } = {},
): Promise<EventDispatchResult> {
  const failureMode = options.failureMode || 'critical'

  try {
    const normalized = normalizeOperationalEventInput(input)
    const result = await repository.createOrGet(normalized)
    return {
      event: result.event,
      created: result.created,
      duplicate: !result.created,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'

    if (failureMode === 'critical') throw error

    const logger = options.logger || ((logMessage, context) => console.error(logMessage, context))
    logger('[Orcaly Operational Event] Emissao secundaria falhou.', {
      companyId: input.companyId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId || null,
      error: message,
    })

    return { event: null, created: false, duplicate: false, error: message }
  }
}

export function normalizeTimelineQuery(
  query: OperationalTimelineQuery,
): Required<OperationalTimelineQuery> {
  const companyId = normalizeIdentifier(query.companyId)
  const entityId = normalizeIdentifier(query.entityId)
  if (!companyId) throw new Error('companyId obrigatorio.')
  if (!entityId || entityId.length > 200) throw new Error('entityId invalido.')

  const limit = Math.min(200, Math.max(1, Math.trunc(query.limit || 100)))

  return {
    companyId,
    entityType: normalizeEntityType(query.entityType),
    entityId,
    visibility: normalizeOperationalVisibility(query.visibility),
    ascending: query.ascending ?? false,
    limit,
  }
}

export async function queryOperationalTimeline(
  repository: OperationalEventRepository,
  query: OperationalTimelineQuery,
) {
  return repository.listTimeline(normalizeTimelineQuery(query))
}

export function normalizeAutomationJobInput(
  input: EnqueueAutomationJobInput,
): Required<EnqueueAutomationJobInput> {
  const companyId = normalizeIdentifier(input.companyId)
  const operationalEventId = normalizeIdentifier(input.operationalEventId)
  const actionType = normalizeKeyPart(input.actionType)
  const idempotencyKey = normalizeIdentifier(input.idempotencyKey)
  const maxAttempts = input.maxAttempts ?? 5

  if (!companyId || !operationalEventId) throw new Error('Empresa e evento sao obrigatorios.')
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(actionType)) {
    throw new Error('actionType invalido.')
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new Error('idempotencyKey invalida.')
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) {
    throw new Error('maxAttempts invalido.')
  }

  return {
    companyId,
    operationalEventId,
    actionType,
    payload: validateOperationalMetadata(input.payload || {}),
    idempotencyKey,
    scheduledAt: normalizedIsoDate(input.scheduledAt, 'scheduledAt'),
    maxAttempts,
  }
}

export async function enqueueAutomationJob(
  repository: OperationalEventRepository,
  input: EnqueueAutomationJobInput,
) {
  return repository.enqueueJob(normalizeAutomationJobInput(input))
}
