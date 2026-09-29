import { timingSafeEqual } from 'node:crypto'

export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'needs_attention'

export type BackgroundJob = {
  id: string
  companyId: string | null
  jobType: string
  payload: Record<string, unknown>
  status: BackgroundJobStatus
  attempts: number
  maxAttempts: number
  runAfter: string
  lockedAt: string | null
  lockedBy: string | null
  metadata: Record<string, unknown>
}

export type JobPayloadResult<T> = { ok: true; value: T } | { ok: false; error: string }

export type IntegrationSyncJobPayload = {
  connectionId: string
  provider: string
  requestedBy: string | null
  mode: 'incremental' | 'full' | 'manual'
  cursor: string | null
  entity: string | null
  metadata: Record<string, unknown>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function normalizeBackgroundJob(value: unknown): BackgroundJob | null {
  if (!isPlainRecord(value)) return null
  const status = value.status
  if (!isUuid(value.id)) return null
  if (value.company_id !== null && value.company_id !== undefined && !isUuid(value.company_id)) return null
  if (typeof value.job_type !== 'string' || !value.job_type.trim()) return null
  if (!isPlainRecord(value.payload)) return null
  if (!['queued', 'running', 'completed', 'failed', 'retrying', 'needs_attention'].includes(String(status))) return null
  if (!Number.isInteger(value.attempts) || Number(value.attempts) < 0) return null
  if (!Number.isInteger(value.max_attempts) || Number(value.max_attempts) < 1) return null
  if (typeof value.run_after !== 'string' || Number.isNaN(Date.parse(value.run_after))) return null
  if (value.locked_at !== null && value.locked_at !== undefined && (typeof value.locked_at !== 'string' || Number.isNaN(Date.parse(value.locked_at)))) return null
  if (value.locked_by !== null && value.locked_by !== undefined && typeof value.locked_by !== 'string') return null

  return {
    id: value.id,
    companyId: typeof value.company_id === 'string' ? value.company_id : null,
    jobType: value.job_type.trim(),
    payload: value.payload,
    status: String(status) as BackgroundJobStatus,
    attempts: Number(value.attempts),
    maxAttempts: Number(value.max_attempts),
    runAfter: value.run_after,
    lockedAt: typeof value.locked_at === 'string' ? value.locked_at : null,
    lockedBy: typeof value.locked_by === 'string' ? value.locked_by : null,
    metadata: isPlainRecord(value.metadata) ? value.metadata : {},
  }
}

export function parseIntegrationSyncPayload(payload: unknown, supportedProviders: readonly string[]): JobPayloadResult<IntegrationSyncJobPayload> {
  if (!isPlainRecord(payload)) return { ok: false, error: 'invalid_payload' }
  if (!isUuid(payload.connection_id)) return { ok: false, error: 'invalid_connection_id' }
  if (typeof payload.provider !== 'string' || !supportedProviders.includes(payload.provider)) return { ok: false, error: 'invalid_provider' }
  const mode = payload.mode === 'full' || payload.mode === 'manual' ? payload.mode : payload.mode === 'incremental' || payload.mode === undefined ? 'incremental' : null
  if (!mode) return { ok: false, error: 'invalid_sync_mode' }
  if (payload.requested_by !== null && payload.requested_by !== undefined && !isUuid(payload.requested_by)) return { ok: false, error: 'invalid_requester' }
  if (payload.cursor !== null && payload.cursor !== undefined && typeof payload.cursor !== 'string') return { ok: false, error: 'invalid_cursor' }
  if (payload.entity !== null && payload.entity !== undefined && typeof payload.entity !== 'string') return { ok: false, error: 'invalid_entity' }
  if (payload.metadata !== undefined && !isPlainRecord(payload.metadata)) return { ok: false, error: 'invalid_metadata' }

  return {
    ok: true,
    value: {
      connectionId: payload.connection_id,
      provider: payload.provider,
      requestedBy: typeof payload.requested_by === 'string' ? payload.requested_by : null,
      mode,
      cursor: typeof payload.cursor === 'string' ? payload.cursor : null,
      entity: typeof payload.entity === 'string' ? payload.entity : null,
      metadata: isPlainRecord(payload.metadata) ? payload.metadata : {},
    },
  }
}

export class JobNeedsAttentionError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'JobNeedsAttentionError'
    this.code = code
  }
}

export function secureBearerMatches(authorization: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret) return false
  const expected = `Bearer ${secret}`
  const received = typeof authorization === 'string' ? authorization : ''
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)
}

export function parseRetryAfterMs(value: string | null | undefined, nowMs = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  let delay: number
  if (Number.isFinite(numeric) && numeric >= 0) {
    delay = numeric * 1000
  } else {
    const timestamp = Date.parse(trimmed)
    if (Number.isNaN(timestamp)) return null
    delay = timestamp - nowMs
  }
  if (!Number.isFinite(delay) || delay < 0) return null
  return Math.min(Math.max(Math.round(delay), 1000), 86_400_000)
}

export function computeJobBackoffMs(attempts: number, retryAfterMs?: number | null): number {
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(Math.max(Math.round(retryAfterMs), 1000), 86_400_000)
  }
  const safeAttempt = Math.min(Math.max(Math.trunc(attempts), 1), 12)
  return Math.min(30_000 * 2 ** (safeAttempt - 1), 3_600_000)
}

export function classifyJobFailure(input: { retryable: boolean; attempts: number; maxAttempts: number; needsAttention?: boolean }): 'retrying' | 'failed' | 'needs_attention' {
  if (input.needsAttention || input.attempts >= input.maxAttempts) return 'needs_attention'
  return input.retryable ? 'retrying' : 'failed'
}

export function clampWorkerLimit(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 10
  return Math.min(Math.max(Math.trunc(numeric), 1), 25)
}

export function clampWorkerDurationMs(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 45_000
  return Math.min(Math.max(Math.trunc(numeric), 5_000), 55_000)
}
