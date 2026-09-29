import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  EventFabricContractError,
  type EventFabricRow,
  validateEventRecord,
} from './contracts'
import { sanitizeDiagnosticText } from '@/lib/observability/application-errors'

type OutboxCandidate = EventFabricRow & {
  status: string
  attempts: number
  max_attempts: number
  available_at: string
  created_at: string
}

function retryAt(attempts: number) {
  const seconds = Math.min(30 * 2 ** Math.max(0, attempts), 900)
  return new Date(Date.now() + seconds * 1000).toISOString()
}

async function settleFailure(
  db: SupabaseClient,
  event: OutboxCandidate,
  retryable: boolean,
  reason: unknown,
) {
  const message =
    sanitizeDiagnosticText(reason instanceof Error ? reason.message : reason, 2000) ||
    'outbox_dispatch_failed'

  const { error } = await db.rpc('orcaly_settle_outbox_failure', {
    p_outbox_event_id: event.id,
    p_retryable: retryable,
    p_run_after: retryable ? retryAt(event.attempts) : null,
    p_error: message,
  })

  if (error) throw error
}

export async function runEventFabricRelay(db: SupabaseClient, limit = 20) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 50))

  const { data, error } = await db
    .from('transactional_outbox')
    .select(
      'id,company_id,user_id,producer,event_type,event_version,aggregate_type,aggregate_id,payload,correlation_id,causation_id,status,attempts,max_attempts,available_at,created_at',
    )
    .in('status', ['queued', 'retrying'])
    .order('available_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(boundedLimit)

  if (error) throw error

  const summary = {
    candidates: (data || []).length,
    dispatched: 0,
    jobsEnsured: 0,
    retrying: 0,
    needsAttention: 0,
    duplicateDispatches: 0,
    notDue: 0,
  }

  for (const raw of data || []) {
    const event = raw as OutboxCandidate

    try {
      const contract = validateEventRecord(event)

      if (!contract.consumers.length) {
        await settleFailure(db, event, false, 'event_contract_has_no_authorized_consumer')
        summary.needsAttention += 1
        continue
      }

      const jobs = contract.consumers.map((consumer) => ({
        job_type: consumer.jobType,
        job_version: consumer.jobVersion,
        max_attempts: consumer.maxAttempts,
      }))

      const { data: result, error: dispatchError } = await db.rpc(
        'orcaly_dispatch_outbox_event',
        {
          p_outbox_event_id: event.id,
          p_expected_producer: event.producer,
          p_expected_event_type: event.event_type,
          p_expected_event_version: event.event_version,
          p_jobs: jobs,
        },
      )

      if (dispatchError) throw dispatchError

      if (result?.status === 'not_due') {
        summary.notDue += 1
        continue
      }

      summary.dispatched += 1
      summary.jobsEnsured += Number(result?.jobs_ensured || jobs.length || 0)
      if (result?.already_dispatched) summary.duplicateDispatches += 1
      if (result?.status === 'needs_attention') summary.needsAttention += 1
    } catch (error) {
      const nonRetryable = error instanceof EventFabricContractError

      try {
        await settleFailure(db, event, !nonRetryable, error)
        if (nonRetryable) summary.needsAttention += 1
        else summary.retrying += 1
      } catch (settlementError) {
        console.error(
          JSON.stringify({
            event: 'event_fabric_relay_settlement_failed',
            outboxEventId: event.id,
            eventType: event.event_type,
            reason: sanitizeDiagnosticText(settlementError, 300),
          }),
        )
        throw settlementError
      }
    }
  }

  return summary
}
