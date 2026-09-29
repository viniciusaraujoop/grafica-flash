import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  EventFabricContractError,
  type EventFabricRow,
  isUuid,
  RELAY_JOB_PAYLOAD_MAX_BYTES,
  serializedJsonBytes,
  validateEventRecord,
} from './contracts'
import {
  getHandler,
  handlerAcceptsEvent,
  type EventFabricJobRow,
} from './handlers'
import { sanitizeDiagnosticText } from '@/lib/observability/application-errors'

function nextRetry(attempts: number) {
  const seconds = Math.min(30 * 2 ** Math.max(0, attempts - 1), 900)
  return new Date(Date.now() + seconds * 1000).toISOString()
}

async function settleJob(
  db: SupabaseClient,
  job: EventFabricJobRow,
  workerId: string,
  status: 'completed' | 'retrying' | 'needs_attention',
  reason?: unknown,
  metadata: Record<string, unknown> = {},
) {
  const { data, error } = await db.rpc('settle_background_job', {
    p_job_id: job.id,
    p_worker: workerId,
    p_status: status,
    p_run_after: status === 'retrying' ? nextRetry(job.attempts) : null,
    p_error:
      status === 'completed'
        ? null
        : sanitizeDiagnosticText(reason instanceof Error ? reason.message : reason, 2000) ||
          'event_fabric_job_failed',
    p_metadata_patch: metadata,
  })

  if (error) throw error
  if (data !== true) throw new Error('event_fabric_job_settlement_rejected')
}

function sameTrustedContext(job: EventFabricJobRow, event: EventFabricRow) {
  return (
    job.company_id === event.company_id &&
    job.user_id === event.user_id &&
    job.correlation_id === event.correlation_id
  )
}

export async function runEventFabricWorker(db: SupabaseClient, workerId: string, limit = 10) {
  const normalizedWorker = String(workerId || '').trim().slice(0, 120)
  if (!normalizedWorker) throw new Error('Event Fabric worker id is required.')

  const { data, error } = await db.rpc('claim_event_fabric_jobs', {
    p_worker: normalizedWorker,
    p_limit: Math.max(1, Math.min(Number(limit) || 10, 50)),
  })

  if (error) throw error

  const summary = {
    claimed: (data || []).length,
    completed: 0,
    retrying: 0,
    needsAttention: 0,
    alreadyApplied: 0,
  }

  for (const raw of data || []) {
    const job = raw as EventFabricJobRow

    try {
      if (
        !isUuid(job.id) ||
        !isUuid(job.outbox_event_id) ||
        !isUuid(job.correlation_id) ||
        serializedJsonBytes(job.payload) > RELAY_JOB_PAYLOAD_MAX_BYTES
      ) {
        throw new EventFabricContractError(
          'invalid_job_envelope',
          'Event Fabric job envelope is invalid.',
        )
      }

      const handler = getHandler(job.job_type, job.job_version)
      if (!handler) {
        await settleJob(
          db,
          job,
          normalizedWorker,
          'needs_attention',
          'unknown_event_fabric_handler',
        )
        summary.needsAttention += 1
        continue
      }

      const { data: source, error: sourceError } = await db
        .from('transactional_outbox')
        .select(
          'id,company_id,user_id,producer,event_type,event_version,aggregate_type,aggregate_id,payload,correlation_id,causation_id',
        )
        .eq('id', job.outbox_event_id)
        .maybeSingle()

      if (sourceError) throw sourceError
      if (!source) {
        await settleJob(
          db,
          job,
          normalizedWorker,
          'needs_attention',
          'source_outbox_event_missing',
        )
        summary.needsAttention += 1
        continue
      }

      const event = source as EventFabricRow
      validateEventRecord(event)

      if (!sameTrustedContext(job, event)) {
        await settleJob(
          db,
          job,
          normalizedWorker,
          'needs_attention',
          'event_fabric_scope_or_correlation_mismatch',
        )
        summary.needsAttention += 1
        continue
      }

      if (!handlerAcceptsEvent(handler, event)) {
        await settleJob(
          db,
          job,
          normalizedWorker,
          'needs_attention',
          'handler_not_allowlisted_for_event',
        )
        summary.needsAttention += 1
        continue
      }

      const context = { db, job, event }
      const authorization = await handler.authorize(context)

      if (!authorization.ok) {
        const disposition = authorization.disposition || 'needs_attention'
        await settleJob(
          db,
          job,
          normalizedWorker,
          disposition,
          authorization.reason,
          { event_fabric_authorization_denied: true },
        )
        if (disposition === 'completed') summary.completed += 1
        else summary.needsAttention += 1
        continue
      }

      if (await handler.isAlreadyApplied(context)) {
        await settleJob(
          db,
          job,
          normalizedWorker,
          'completed',
          undefined,
          { event_fabric_domain_action_already_applied: true },
        )
        summary.completed += 1
        summary.alreadyApplied += 1
        continue
      }

      await handler.execute(context)
      await settleJob(db, job, normalizedWorker, 'completed')
      summary.completed += 1
    } catch (error) {
      const nonRetryable = error instanceof EventFabricContractError
      const exhausted = job.attempts >= job.max_attempts
      const retryable = !nonRetryable && !exhausted

      await settleJob(
        db,
        job,
        normalizedWorker,
        retryable ? 'retrying' : 'needs_attention',
        error,
      )

      if (retryable) summary.retrying += 1
      else summary.needsAttention += 1
    }
  }

  return summary
}
