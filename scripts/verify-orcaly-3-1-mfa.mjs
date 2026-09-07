import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateMfaStepUp } from '../lib/security/mfa-core.ts'
import {
  normalizeSubscriptionMutationAction,
  requiresSettingsMfa,
  requiresSubscriptionMfa,
  requiresTeamMutationMfa,
} from '../lib/security/privileged-actions.ts'

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

assert.equal(requiresSettingsMfa({ pix_key: 'x' }), true)
assert.equal(requiresSettingsMfa({ aceita_cartao: true }), true)
assert.equal(requiresSettingsMfa({ nome: 'Empresa' }), false)

assert.equal(normalizeSubscriptionMutationAction(undefined), 'create')
for (const action of ['create', 'renew', 'cancel', 'create_pix']) {
  assert.equal(requiresSubscriptionMfa(action), true, `${action} must require subscription step-up`)
}
assert.equal(requiresSubscriptionMfa('history'), false)
assert.equal(requiresSubscriptionMfa('sync'), false)

assert.equal(requiresTeamMutationMfa({ operation: 'create', nextRole: 'gerente' }), true)
assert.equal(requiresTeamMutationMfa({ operation: 'create', nextRole: 'atendente' }), false)
assert.equal(requiresTeamMutationMfa({ operation: 'update', currentRole: 'gerente', nextRole: 'atendente' }), true)
assert.equal(requiresTeamMutationMfa({ operation: 'update', currentRole: 'atendente', nextRole: 'atendente' }), false)
assert.equal(requiresTeamMutationMfa({ operation: 'delete', currentRole: 'gerente' }), true)
assert.equal(requiresTeamMutationMfa({ operation: 'delete', currentRole: 'producao' }), false)

const settingsRoute = readFileSync(new URL('../app/api/company/settings/route.ts', import.meta.url), 'utf8')
const subscriptionRoute = readFileSync(new URL('../app/api/company/subscription/route.ts', import.meta.url), 'utf8')
const teamRoute = readFileSync(new URL('../app/api/company/team/route.ts', import.meta.url), 'utf8')
assert.match(settingsRoute, /requireMfaStepUpForRequest\(request, 'pix\.update'\)/)
assert.match(subscriptionRoute, /requireMfaStepUpForRequest\(request, "subscription\.manage"\)/)
assert.match(teamRoute, /requireMfaStepUpForRequest\(request, 'team\.elevated\.manage'\)/)

console.log('Orçaly 3.1 MFA policy and server-wiring checks: PASS')
