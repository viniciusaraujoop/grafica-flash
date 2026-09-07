import assert from 'node:assert/strict'
import { evaluateMfaStepUp } from '../lib/security/mfa-core.ts'

const base = { action: 'subscription.manage' }

assert.deepEqual(
  evaluateMfaStepUp({ ...base, hasVerifiedFactor: false, currentLevel: 'aal1', nextLevel: 'aal1' }),
  { allowed: false, required: true, reason: 'mfa_enrollment_required' },
)

assert.deepEqual(
  evaluateMfaStepUp({ ...base, hasVerifiedFactor: true, currentLevel: 'aal1', nextLevel: 'aal2' }),
  { allowed: false, required: true, reason: 'mfa_challenge_required' },
)

assert.deepEqual(
  evaluateMfaStepUp({ ...base, hasVerifiedFactor: true, currentLevel: 'aal2', nextLevel: 'aal2' }),
  { allowed: true, required: true, reason: null },
)

for (const action of [
  'pix.update',
  'finance.write',
  'subscription.manage',
  'team.elevated.manage',
  'api_keys.manage',
  'data.export',
  'platform.impersonation.write',
]) {
  assert.equal(
    evaluateMfaStepUp({ action, hasVerifiedFactor: true, currentLevel: 'aal1', nextLevel: 'aal2' }).allowed,
    false,
    `${action} must require AAL2`,
  )
}

console.log('Orçaly 3.1 MFA policy checks: PASS')
