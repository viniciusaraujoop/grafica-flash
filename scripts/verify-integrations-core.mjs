import assert from 'node:assert/strict'

process.env.INTEGRATION_OAUTH_STATE_SECRET = 'integration-test-secret-that-is-long-enough'

const { createIntegrationOAuthState, verifyIntegrationOAuthState, safeIntegrationRedirect, createPkcePair, hashIntegrationOAuthNonce } = await import('../lib/integrations/core/auth.ts')
const { integrationProviders, getIntegrationProvider } = await import('../lib/integrations/core/registry.ts')
const { errorCodeFromHttpStatus, IntegrationError, publicIntegrationError } = await import('../lib/integrations/core/errors.ts')
const { redactIntegrationSecrets } = await import('../lib/integrations/core/credentials.ts')
const { companyPermissionAllowed } = await import('../lib/access-control-core.ts')

const keys = integrationProviders.map((provider) => provider.key)
assert.equal(new Set(keys).size, keys.length, 'provider registry must not contain duplicates')
assert.ok(getIntegrationProvider('google_calendar'))
assert.ok(getIntegrationProvider('mercado_livre'))
assert.ok(getIntegrationProvider('open_finance'))
assert.equal(getIntegrationProvider('whatsapp'), null, 'WhatsApp must remain outside this expansion registry')

for (const provider of integrationProviders) {
  assert.ok(provider.featureFlag.startsWith('integration_'))
  assert.ok(provider.capabilities.length > 0)
  assert.ok(['NOT_CONFIGURED', 'ACCESS_REQUIRED'].includes(provider.unavailableStatus))
}

const oauth = createIntegrationOAuthState({
  userId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
  provider: 'google_calendar',
  next: '/painel/integracoes?provider=google_calendar',
})
const verified = verifyIntegrationOAuthState(oauth.value)
assert.equal(verified?.companyId, oauth.state.companyId)
assert.equal(verified?.userId, oauth.state.userId)
assert.equal(verified?.provider, 'google_calendar')
assert.equal(hashIntegrationOAuthNonce(verified?.nonce || '').length, 64)
assert.equal(verifyIntegrationOAuthState(`${oauth.value}tampered`), null)
assert.equal(safeIntegrationRedirect('https://evil.example'), '/painel/integracoes')
assert.equal(safeIntegrationRedirect('//evil.example'), '/painel/integracoes')
assert.equal(safeIntegrationRedirect('/painel/integracoes'), '/painel/integracoes')

const pkce = createPkcePair()
assert.equal(pkce.method, 'S256')
assert.ok(pkce.verifier.length >= 43)
assert.ok(pkce.challenge.length >= 43)
assert.notEqual(pkce.verifier, pkce.challenge)

assert.equal(errorCodeFromHttpStatus(401), 'INVALID_CREDENTIAL')
assert.equal(errorCodeFromHttpStatus(403), 'INSUFFICIENT_SCOPE')
assert.equal(errorCodeFromHttpStatus(429), 'RATE_LIMITED')
assert.equal(errorCodeFromHttpStatus(503), 'PROVIDER_DOWN')
assert.equal(new IntegrationError('TIMEOUT', 'timeout').retryable, true)
assert.equal(new IntegrationError('INVALID_CREDENTIAL', 'bad').retryable, false)
assert.equal(publicIntegrationError(new IntegrationError('INVALID_CREDENTIAL', 'raw-provider-detail')).message.includes('raw-provider-detail'), false)

const redacted = redactIntegrationSecrets({ access_token: 'abc', nested: { clientSecret: 'def', safe: 'ok' }, code_verifier: 'ghi' })
assert.deepEqual(redacted, { access_token: '[REDACTED]', nested: { clientSecret: '[REDACTED]', safe: 'ok' }, code_verifier: '[REDACTED]' })

const employee = { role: 'atendente', isAdminMaster: false, canManage: false, canFinance: false, canConfig: false, canProducts: false, canProposal: true, canSubscription: false, canProduction: false }
const manager = { ...employee, role: 'gerente', canManage: true, canFinance: true, canProducts: true, canSubscription: true, canProduction: true }
const owner = { ...manager, role: 'dono', canConfig: true }
assert.equal(companyPermissionAllowed(employee, 'integrations.read'), true)
assert.equal(companyPermissionAllowed(employee, 'integrations.sync'), false)
assert.equal(companyPermissionAllowed(manager, 'integrations.sync'), true)
assert.equal(companyPermissionAllowed(manager, 'integrations.credentials.manage'), false)
assert.equal(companyPermissionAllowed(owner, 'integrations.credentials.manage'), true)
assert.equal(companyPermissionAllowed(employee, 'esign.send'), true)
assert.equal(companyPermissionAllowed(manager, 'fiscal.issue'), true)

console.log('Orçaly Integration Platform core checks: PASS')
