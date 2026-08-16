import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  AutomationJob,
  NormalizedOperationalEventInput,
  OperationalEvent,
  OperationalTimelineQuery,
} from '../../lib/foundation/contracts'
import { resolveFeatureFlag } from '../../lib/foundation/feature-flags'
import { hasFoundationPermission } from '../../lib/foundation/permissions'
import {
  buildIdempotencyKey,
  dispatchOperationalEvent,
  normalizeOperationalEventType,
  normalizeOperationalVisibility,
  queryOperationalTimeline,
  validateOperationalMetadata,
  type AutomationJobPersistenceResult,
  type EventPersistenceResult,
  type OperationalEventRepository,
} from '../../lib/foundation/operational-events'

class MemoryOperationalEventRepository implements OperationalEventRepository {
  private readonly events: OperationalEvent[] = []
  private readonly idempotency = new Map<string, OperationalEvent>()
  createdCount = 0

  async createOrGet(
    input: NormalizedOperationalEventInput,
  ): Promise<EventPersistenceResult> {
    await new Promise<void>((resolve) => setImmediate(resolve))

    const uniqueKey = input.idempotencyKey
      ? `${input.companyId}:${input.idempotencyKey}`
      : null
    const existing = uniqueKey ? this.idempotency.get(uniqueKey) : null

    if (existing) return { event: existing, created: false }

    const sequence = this.events.length + 1
    const event: OperationalEvent = {
      id: `event-${sequence}`,
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId,
      visibility: input.visibility,
      metadata: input.metadata,
      schemaVersion: input.schemaVersion,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      occurredAt: input.occurredAt,
      createdAt: new Date().toISOString(),
    }

    this.events.push(event)
    if (uniqueKey) this.idempotency.set(uniqueKey, event)
    this.createdCount += 1
    return { event, created: true }
  }

  async listTimeline(
    query: Required<OperationalTimelineQuery>,
  ): Promise<OperationalEvent[]> {
    return this.events
      .filter((event) => event.companyId === query.companyId)
      .filter((event) => event.entityType === query.entityType)
      .filter((event) => event.entityId === query.entityId)
      .filter((event) => event.visibility === query.visibility)
      .sort((left, right) => {
        const direction = query.ascending ? 1 : -1
        return left.occurredAt.localeCompare(right.occurredAt) * direction
      })
      .slice(0, query.limit)
  }

  async enqueueJob(): Promise<AutomationJobPersistenceResult> {
    throw new Error('not_implemented_in_memory')
  }
}

const baseEvent = {
  companyId: '00000000-0000-4000-8000-000000000001',
  entityType: 'order' as const,
  entityId: '00000000-0000-4000-8000-000000000101',
  eventType: 'order.status_changed' as const,
  actorType: 'user' as const,
  actorId: '00000000-0000-4000-8000-000000000201',
  visibility: 'internal' as const,
  metadata: { old_status: 'Recebido', new_status: 'Aprovado' },
  idempotencyKey: 'order:101:status:received:approved:v1',
  occurredAt: '2026-08-16T12:00:00.000Z',
}

test('feature flag resolves global, pilot and emergency override lock', () => {
  assert.deepEqual(
    resolveFeatureFlag({
      key: 'customer_portal',
      globallyEnabled: false,
      companyOverridesEnabled: true,
      companyOverride: true,
    }),
    { key: 'customer_portal', enabled: true, source: 'company' },
  )

  assert.equal(
    resolveFeatureFlag({
      key: 'customer_portal',
      globallyEnabled: true,
      companyOverridesEnabled: true,
      companyOverride: false,
    }).enabled,
    false,
  )

  assert.equal(
    resolveFeatureFlag({
      key: 'customer_portal',
      globallyEnabled: false,
      companyOverridesEnabled: false,
      companyOverride: true,
    }).enabled,
    false,
  )

  assert.equal(resolveFeatureFlag(null, 'customer_portal').enabled, false)
})

test('event contracts normalize allowed values and reject invalid ones', () => {
  assert.equal(normalizeOperationalEventType(' ORDER.STATUS_CHANGED '), 'order.status_changed')
  assert.equal(normalizeOperationalVisibility('Customer Visible'), 'customer_visible')
  assert.throws(() => normalizeOperationalEventType('http.request'))
  assert.throws(() => normalizeOperationalVisibility('public'))
})

test('idempotency key is stable and normalized', () => {
  assert.equal(
    buildIdempotencyKey('Quote', 'ABC-123', 'Follow-up', '24h'),
    'quote:abc-123:follow-up:24h',
  )
  assert.throws(() => buildIdempotencyKey('short'))
})

test('metadata accepts business facts and blocks secrets and PII', () => {
  assert.deepEqual(
    validateOperationalMetadata({ old_status: 'Em analise', new_status: 'Aprovado' }),
    { old_status: 'Em analise', new_status: 'Aprovado' },
  )
  assert.throws(() => validateOperationalMetadata({ access_token: 'secret-value' }))
  assert.throws(() => validateOperationalMetadata({ customer_email: 'cliente@example.com' }))
})

test('permission helper expands current roles without replacing explicit permissions', () => {
  assert.equal(hasFoundationPermission({ role: 'dono' }, 'automation.manage'), true)
  assert.equal(hasFoundationPermission({ role: 'gerente' }, 'orders.update'), true)
  assert.equal(hasFoundationPermission({ role: 'atendente' }, 'automation.manage'), false)
  assert.equal(
    hasFoundationPermission(
      { role: 'gerente', permissions: { 'orders.update': false } },
      'orders.update',
    ),
    false,
  )
  assert.equal(
    hasFoundationPermission(
      { role: 'atendente', permissions: { production: true } },
      'production.manage',
    ),
    true,
  )
})

test('dispatcher is idempotent under concurrent calls', async () => {
  const repository = new MemoryOperationalEventRepository()

  const results = await Promise.all([
    dispatchOperationalEvent(repository, baseEvent),
    dispatchOperationalEvent(repository, baseEvent),
  ])

  assert.equal(repository.createdCount, 1)
  assert.equal(results.filter((result) => result.created).length, 1)
  assert.equal(results.filter((result) => result.duplicate).length, 1)
  assert.equal(results[0].event?.id, results[1].event?.id)
})

test('same idempotency key is isolated by company', async () => {
  const repository = new MemoryOperationalEventRepository()

  const results = await Promise.all([
    dispatchOperationalEvent(repository, baseEvent),
    dispatchOperationalEvent(repository, {
      ...baseEvent,
      companyId: '00000000-0000-4000-8000-000000000002',
    }),
  ])

  assert.equal(repository.createdCount, 2)
  assert.equal(results.every((result) => result.created), true)
})

test('timeline never returns another company and respects visibility', async () => {
  const repository = new MemoryOperationalEventRepository()

  await dispatchOperationalEvent(repository, baseEvent)
  await dispatchOperationalEvent(repository, {
    ...baseEvent,
    companyId: '00000000-0000-4000-8000-000000000002',
  })
  await dispatchOperationalEvent(repository, {
    ...baseEvent,
    visibility: 'customer_visible',
    idempotencyKey: 'order:101:customer-visible:v1',
  })

  const timeline = await queryOperationalTimeline(repository, {
    companyId: baseEvent.companyId,
    entityType: 'order',
    entityId: baseEvent.entityId,
    visibility: 'internal',
  })

  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].companyId, baseEvent.companyId)
  assert.equal(timeline[0].visibility, 'internal')
})

test('secondary event failure logs context and preserves current flow', async () => {
  const repository: OperationalEventRepository = {
    async createOrGet(): Promise<EventPersistenceResult> {
      throw new Error('database_unavailable')
    },
    async listTimeline(): Promise<OperationalEvent[]> {
      return []
    },
    async enqueueJob(): Promise<{ job: AutomationJob; created: boolean }> {
      throw new Error('not_implemented')
    },
  }
  const logs: Array<Record<string, unknown>> = []

  const result = await dispatchOperationalEvent(repository, baseEvent, {
    failureMode: 'best_effort',
    logger: (_message, context) => logs.push(context),
  })

  assert.equal(result.event, null)
  assert.equal(result.error, 'database_unavailable')
  assert.equal(logs.length, 1)
  assert.equal(logs[0].companyId, baseEvent.companyId)

  await assert.rejects(() => dispatchOperationalEvent(repository, baseEvent))
})
