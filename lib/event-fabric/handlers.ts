import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { EventFabricRow } from './contracts'

export type EventFabricJobRow = {
  id: string
  company_id: string | null
  user_id: string | null
  job_type: string
  job_version: number
  payload: unknown
  status: string
  attempts: number
  max_attempts: number
  outbox_event_id: string | null
  correlation_id: string | null
}

export type HandlerContext = {
  db: SupabaseClient
  job: EventFabricJobRow
  event: EventFabricRow
}

export type AuthorizationDecision =
  | { ok: true }
  | { ok: false; disposition?: 'completed' | 'needs_attention'; reason: string }

export type EventFabricHandler = {
  jobType: string
  jobVersion: number
  owner: string
  acceptedEvents: readonly {
    producer: string
    eventType: string
    eventVersion: number
  }[]
  maxAttempts: number
  authorize: (context: HandlerContext) => Promise<AuthorizationDecision>
  isAlreadyApplied: (context: HandlerContext) => Promise<boolean>
  execute: (context: HandlerContext) => Promise<void>
}

const JOB_TYPE_RE = /^[a-z][a-z0-9_-]{0,39}\.[a-z][a-z0-9_.-]{0,79}$/

export function buildHandlerRegistry(definitions: readonly EventFabricHandler[]) {
  const registry = new Map<string, EventFabricHandler>()

  for (const definition of definitions) {
    if (!JOB_TYPE_RE.test(definition.jobType)) {
      throw new Error('Event Fabric job_type must be domain-qualified: ' + definition.jobType)
    }
    if (!Number.isInteger(definition.jobVersion) || definition.jobVersion < 1 || definition.jobVersion > 32767) {
      throw new Error('Invalid Event Fabric job version for ' + definition.jobType)
    }
    if (!Number.isInteger(definition.maxAttempts) || definition.maxAttempts < 1 || definition.maxAttempts > 25) {
      throw new Error('Invalid Event Fabric maxAttempts for ' + definition.jobType)
    }

    const key = definition.jobType + ':v' + definition.jobVersion
    if (registry.has(key)) {
      throw new Error('Duplicate Event Fabric handler ownership: ' + key)
    }
    registry.set(key, definition)
  }

  return registry
}

// M1A intentionally registers no production side-effect handler.
// Real consumers require their own explicit authorization.
const HANDLER_REGISTRY = buildHandlerRegistry([])

export function getHandler(jobType: string, jobVersion: number) {
  return HANDLER_REGISTRY.get(jobType + ':v' + jobVersion) || null
}

export function handlerAcceptsEvent(handler: EventFabricHandler, event: EventFabricRow) {
  return handler.acceptedEvents.some(
    (accepted) =>
      accepted.producer === event.producer &&
      accepted.eventType === event.event_type &&
      accepted.eventVersion === event.event_version,
  )
}

export function allHandlers() {
  return [...HANDLER_REGISTRY.values()]
}
