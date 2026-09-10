import assert from 'node:assert/strict'
import {
  clampWorkerDurationMs,
  clampWorkerLimit,
  classifyJobFailure,
  computeJobBackoffMs,
  normalizeBackgroundJob,
  parseIntegrationSyncPayload,
  parseRetryAfterMs,
  secureBearerMatches,
} from '../lib/jobs/core.ts'

const providers = ['google_calendar', 'resend']
const companyId = '11111111-1111-4111-8111-111111111111'
const connectionId = '22222222-2222-4222-8222-222222222222'

assert.equal(secureBearerMatches('Bearer secret-value', 'secret-value'), true)
assert.equal(secureBearerMatches('Bearer wrong', 'secret-value'), false)
assert.equal(secureBearerMatches(null, 'secret-value'), false)
assert.equal(secureBearerMatches('Bearer secret-value', ''), false)

const parsed = parseIntegrationSyncPayload({ connection_id: connectionId, provider: 'google_calendar', mode: 'incremental', metadata: {} }, providers)
assert.equal(parsed.ok, true)
assert.equal(parseIntegrationSyncPayload({ connection_id: 'bad', provider: 'google_calendar' }, providers).ok, false)
assert.equal(parseIntegrationSyncPayload({ connection_id: connectionId, provider: 'unknown' }, providers).ok, false)
assert.equal(parseIntegrationSyncPayload({ connection_id: connectionId, provider: 'google_calendar', mode: 'forever' }, providers).ok, false)

assert.equal(classifyJobFailure({ retryable: true, attempts: 1, maxAttempts: 5 }), 'retrying')
assert.equal(classifyJobFailure({ retryable: false, attempts: 1, maxAttempts: 5 }), 'failed')
assert.equal(classifyJobFailure({ retryable: true, attempts: 5, maxAttempts: 5 }), 'needs_attention')
assert.equal(classifyJobFailure({ retryable: false, attempts: 1, maxAttempts: 5, needsAttention: true }), 'needs_attention')
assert.equal(computeJobBackoffMs(1), 30_000)
assert.equal(computeJobBackoffMs(2), 60_000)
assert.equal(computeJobBackoffMs(12), 3_600_000)
assert.equal(computeJobBackoffMs(1, 12_345), 12_345)
assert.equal(parseRetryAfterMs('5', 0), 5_000)
assert.equal(parseRetryAfterMs('not-a-date', 0), null)
assert.equal(clampWorkerLimit(999), 25)
assert.equal(clampWorkerDurationMs(1), 5_000)

const job = normalizeBackgroundJob({
  id: '33333333-3333-4333-8333-333333333333',
  company_id: companyId,
  job_type: 'integration.sync',
  payload: { connection_id: connectionId, provider: 'google_calendar' },
  status: 'running',
  attempts: 1,
  max_attempts: 5,
  run_after: new Date(0).toISOString(),
  locked_at: new Date(0).toISOString(),
  locked_by: 'worker-a',
  metadata: {},
})
assert.ok(job)
assert.equal(job?.companyId, companyId)
assert.equal(normalizeBackgroundJob({ id: 'bad' }), null)

console.log('Orçaly background job worker core checks: PASS')
