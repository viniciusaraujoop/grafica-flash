import assert from 'node:assert/strict'
import { normalizeIntegrationHttpStatus } from '../lib/integrations/core/http.ts'

assert.equal(normalizeIntegrationHttpStatus(202), 202)
assert.equal(normalizeIntegrationHttpStatus(undefined), 403)
assert.equal(normalizeIntegrationHttpStatus('429'), 403)
assert.equal(normalizeIntegrationHttpStatus(null), 403)
assert.equal(normalizeIntegrationHttpStatus({ status: 429 }), 403)
assert.equal(normalizeIntegrationHttpStatus(Number.NaN), 403)
assert.equal(normalizeIntegrationHttpStatus(-1), 403)
assert.equal(normalizeIntegrationHttpStatus(0), 403)
assert.equal(normalizeIntegrationHttpStatus(99), 403)
assert.equal(normalizeIntegrationHttpStatus(600), 403)
assert.equal(normalizeIntegrationHttpStatus(429.5), 403)
assert.equal(normalizeIntegrationHttpStatus(402, 500), 402)
assert.equal(normalizeIntegrationHttpStatus('unexpected', 500), 500)

console.log('Orçaly Integration Platform server-action boundary checks: PASS')
