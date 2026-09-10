import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeIntegrationError, publicIntegrationError } from '@/lib/integrations/core/errors'
import {
  JobNeedsAttentionError,
  clampWorkerDurationMs,
  clampWorkerLimit,
  classifyJobFailure,
  computeJobBackoffMs,
  normalizeBackgroundJob,
} from '@/lib/jobs/core'
import { bootstrapJobHandlers } from '@/lib/jobs/bootstrap'
import { getJobHandler } from '@/lib/jobs/registry'

export type BackgroundJobWorkerSummary = {
  workerId: string
  claimed: number
  completed: number
  failed: number
  retrying: number
  needsAttention: number
  leaseLost: number
  staleRecovered: number
  stoppedByDeadline: boolean
}

async function settleJob(db: SupabaseClient, input: {
  jobId: string
  workerId: string
  status: 'completed' | 'failed' | 'retrying' | 'needs_attention'
  runAfter?: string | null
  error?: string | null
  metadata?: Record<string, unknown>
}) {
  const { data, error } = await db.rpc('settle_background_job', {
    p_job_id: input.jobId,
    p_worker: input.workerId,
    p_status: input.status,
    p_run_after: input.runAfter || null,
    p_error: input.error || null,
    p_metadata_patch: input.metadata || {},
  })
  if (error) throw error
  return data === true
}

function safeFailure(error: unknown) {
  if (error instanceof JobNeedsAttentionError) {
    return { retryable: false, needsAttention: true, code: error.code }
  }
  const normalized = normalizeIntegrationError(error)
  const publicError = publicIntegrationError(normalized)
  return {
    retryable: normalized.retryable,
    needsAttention: false,
    code: publicError.code.toLowerCase(),
    retryAfterMs: normalized.retryAfterMs || null,
  }
}

export async function runBackgroundJobWorker(db: SupabaseClient, options: {
  workerId?: string
  limit?: number
  maxDurationMs?: number
  staleSeconds?: number
} = {}): Promise<BackgroundJobWorkerSummary> {
  bootstrapJobHandlers()
  const workerId = String(options.workerId || `orcaly-${randomUUID()}`).slice(0, 120)
  const limit = clampWorkerLimit(options.limit)
  const maxDurationMs = clampWorkerDurationMs(options.maxDurationMs)
  const deadlineMs = Date.now() + maxDurationMs

  const summary: BackgroundJobWorkerSummary = {
    workerId,
    claimed: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    needsAttention: 0,
    leaseLost: 0,
    staleRecovered: 0,
    stoppedByDeadline: false,
  }

  const { data: recovered, error: recoverError } = await db.rpc('recover_stale_background_jobs', {
    p_stale_seconds: Math.min(Math.max(Math.trunc(options.staleSeconds || 300), 60), 3600),
    p_limit: Math.min(limit, 25),
  })
  if (recoverError) throw recoverError
  summary.staleRecovered = typeof recovered === 'number' ? recovered : Number(recovered || 0)

  for (let index = 0; index < limit; index += 1) {
    if (Date.now() >= deadlineMs - 1_500) {
      summary.stoppedByDeadline = true
      break
    }

    const { data, error } = await db.rpc('claim_background_jobs', { p_worker: workerId, p_limit: 1 })
    if (error) throw error
    const raw = Array.isArray(data) ? data[0] : null
    if (!raw) break
    const job = normalizeBackgroundJob(raw)
    if (!job) throw new Error('Background job row failed runtime validation.')
    summary.claimed += 1

    const handler = getJobHandler(job.jobType)
    if (!handler) {
      const settled = await settleJob(db, { jobId: job.id, workerId, status: 'needs_attention', error: 'unknown_job_handler' })
      if (settled) summary.needsAttention += 1
      else summary.leaseLost += 1
      continue
    }

    const parsed = handler.validate(job.payload)
    if (!parsed.ok) {
      const settled = await settleJob(db, { jobId: job.id, workerId, status: 'needs_attention', error: parsed.error })
      if (settled) summary.needsAttention += 1
      else summary.leaseLost += 1
      continue
    }

    try {
      const result = await handler.execute({ db, job, workerId, deadlineMs }, parsed.value)
      const settled = await settleJob(db, {
        jobId: job.id,
        workerId,
        status: 'completed',
        metadata: result ? { result } : {},
      })
      if (settled) summary.completed += 1
      else summary.leaseLost += 1
    } catch (error) {
      const failure = safeFailure(error)
      const status = classifyJobFailure({
        retryable: failure.retryable,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        needsAttention: failure.needsAttention,
      })
      const runAfter = status === 'retrying'
        ? new Date(Date.now() + computeJobBackoffMs(job.attempts, failure.retryAfterMs)).toISOString()
        : null
      const settled = await settleJob(db, {
        jobId: job.id,
        workerId,
        status,
        runAfter,
        error: failure.code,
        metadata: { failure_code: failure.code },
      })
      if (!settled) summary.leaseLost += 1
      else if (status === 'retrying') summary.retrying += 1
      else if (status === 'needs_attention') summary.needsAttention += 1
      else summary.failed += 1
    }
  }

  return summary
}
