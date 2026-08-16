import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AutomationJob,
  CreateOperationalEventInput,
  EnqueueAutomationJobInput,
  NormalizedOperationalEventInput,
  OperationalEvent,
  OperationalMetadata,
  OperationalTimelineQuery,
} from './contracts'
import {
  dispatchOperationalEvent,
  enqueueAutomationJob as enqueueWithRepository,
  queryOperationalTimeline,
  type EventFailureMode,
  type OperationalEventRepository,
} from './operational-events'

const operationalEventColumns = [
  'id',
  'company_id',
  'entity_type',
  'entity_id',
  'event_type',
  'actor_type',
  'actor_id',
  'visibility',
  'metadata',
  'schema_version',
  'idempotency_key',
  'request_id',
  'occurred_at',
  'created_at',
].join(',')

const automationJobColumns = [
  'id',
  'company_id',
  'operational_event_id',
  'action_type',
  'status',
  'payload',
  'idempotency_key',
  'scheduled_at',
  'attempts',
  'max_attempts',
  'last_error',
  'processed_at',
  'created_at',
  'updated_at',
].join(',')

function operationalEventFromRow(row: Record<string, unknown>): OperationalEvent {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    entityType: row.entity_type as OperationalEvent['entityType'],
    entityId: String(row.entity_id),
    eventType: row.event_type as OperationalEvent['eventType'],
    actorType: row.actor_type as OperationalEvent['actorType'],
    actorId: row.actor_id == null ? null : String(row.actor_id),
    visibility: row.visibility as OperationalEvent['visibility'],
    metadata: (row.metadata || {}) as OperationalMetadata,
    schemaVersion: Number(row.schema_version),
    idempotencyKey: row.idempotency_key == null ? null : String(row.idempotency_key),
    requestId: row.request_id == null ? null : String(row.request_id),
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
  }
}

function automationJobFromRow(row: Record<string, unknown>): AutomationJob {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    operationalEventId: String(row.operational_event_id),
    actionType: String(row.action_type),
    status: row.status as AutomationJob['status'],
    payload: (row.payload || {}) as OperationalMetadata,
    idempotencyKey: String(row.idempotency_key),
    scheduledAt: String(row.scheduled_at),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    lastError: row.last_error == null ? null : String(row.last_error),
    processedAt: row.processed_at == null ? null : String(row.processed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function eventPayload(input: NormalizedOperationalEventInput) {
  return {
    company_id: input.companyId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    event_type: input.eventType,
    actor_type: input.actorType,
    actor_id: input.actorId,
    visibility: input.visibility,
    metadata: input.metadata,
    schema_version: input.schemaVersion,
    idempotency_key: input.idempotencyKey,
    request_id: input.requestId,
    occurred_at: input.occurredAt,
  }
}

export function createSupabaseOperationalEventRepository(
  supabase: SupabaseClient,
): OperationalEventRepository {
  return {
    async createOrGet(input) {
      if (!input.idempotencyKey) {
        const { data, error } = await supabase
          .from('operational_events')
          .insert(eventPayload(input))
          .select(operationalEventColumns)
          .single()

        if (error) throw error

        return {
          event: operationalEventFromRow(data as unknown as Record<string, unknown>),
          created: true,
        }
      }

      const { data, error } = await supabase
        .from('operational_events')
        .upsert(eventPayload(input), {
          onConflict: 'company_id,idempotency_key',
          ignoreDuplicates: true,
        })
        .select(operationalEventColumns)
        .maybeSingle()

      if (error) throw error

      if (data) {
        return {
          event: operationalEventFromRow(data as unknown as Record<string, unknown>),
          created: true,
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from('operational_events')
        .select(operationalEventColumns)
        .eq('company_id', input.companyId)
        .eq('idempotency_key', input.idempotencyKey)
        .single()

      if (existingError) throw existingError

      return {
        event: operationalEventFromRow(existing as unknown as Record<string, unknown>),
        created: false,
      }
    },

    async listTimeline(query) {
      const { data, error } = await supabase
        .from('operational_events')
        .select(operationalEventColumns)
        .eq('company_id', query.companyId)
        .eq('entity_type', query.entityType)
        .eq('entity_id', query.entityId)
        .eq('visibility', query.visibility)
        .order('occurred_at', { ascending: query.ascending })
        .order('id', { ascending: query.ascending })
        .limit(query.limit)

      if (error) throw error

      return (data || []).map((row) =>
        operationalEventFromRow(row as unknown as Record<string, unknown>),
      )
    },

    async enqueueJob(input) {
      const payload = {
        company_id: input.companyId,
        operational_event_id: input.operationalEventId,
        action_type: input.actionType,
        payload: input.payload,
        idempotency_key: input.idempotencyKey,
        scheduled_at: input.scheduledAt,
        max_attempts: input.maxAttempts,
      }

      const { data, error } = await supabase
        .from('automation_jobs')
        .upsert(payload, {
          onConflict: 'company_id,idempotency_key',
          ignoreDuplicates: true,
        })
        .select(automationJobColumns)
        .maybeSingle()

      if (error) throw error

      if (data) {
        return {
          job: automationJobFromRow(data as unknown as Record<string, unknown>),
          created: true,
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from('automation_jobs')
        .select(automationJobColumns)
        .eq('company_id', input.companyId)
        .eq('idempotency_key', input.idempotencyKey)
        .single()

      if (existingError) throw existingError

      return {
        job: automationJobFromRow(existing as unknown as Record<string, unknown>),
        created: false,
      }
    },
  }
}

export async function emitOperationalEvent(
  supabase: SupabaseClient,
  input: CreateOperationalEventInput,
  options: { failureMode?: EventFailureMode } = {},
) {
  return dispatchOperationalEvent(
    createSupabaseOperationalEventRepository(supabase),
    input,
    options,
  )
}

export async function getOperationalTimeline(
  supabase: SupabaseClient,
  query: OperationalTimelineQuery,
) {
  return queryOperationalTimeline(
    createSupabaseOperationalEventRepository(supabase),
    query,
  )
}

export async function scheduleAutomationJob(
  supabase: SupabaseClient,
  input: EnqueueAutomationJobInput,
) {
  return enqueueWithRepository(
    createSupabaseOperationalEventRepository(supabase),
    input,
  )
}
