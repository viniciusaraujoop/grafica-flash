import assert from 'node:assert/strict'
process.env.INTEGRATION_OAUTH_STATE_SECRET = 'integration-google-oauth-test-secret'

const { createIntegrationOAuthState, verifyIntegrationOAuthState, hashIntegrationOAuthScopes } = await import('../lib/integrations/core/auth.ts')
const { buildGoogleAuthorizationUrl, googleScopesForProviderKey, isGoogleOAuthProviderKey } = await import('../lib/integrations/google/oauth-contract.ts')

const scopes = googleScopesForProviderKey('google_calendar')
assert.ok(scopes)
assert.ok(scopes.includes('https://www.googleapis.com/auth/calendar.events'))
assert.ok(scopes.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly'))
assert.equal(isGoogleOAuthProviderKey('google_calendar'), true)
assert.equal(isGoogleOAuthProviderKey('google_maps'), false)

const oauth = createIntegrationOAuthState({
  userId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
  provider: 'google_calendar',
  requestedScopes: scopes,
})
const verified = verifyIntegrationOAuthState(oauth.value)
assert.equal(verified?.scopeHash, hashIntegrationOAuthScopes(scopes))
assert.equal(verified?.companyId, oauth.state.companyId)

const authUrl = buildGoogleAuthorizationUrl({
  config: { clientId: 'client-id', redirectUri: 'https://example.test/api/integrations/google/callback' },
  state: oauth.value,
  scopes,
  pkceChallenge: 'pkce-challenge',
})
assert.equal(authUrl.protocol, 'https:')
assert.equal(authUrl.hostname, 'accounts.google.com')
assert.equal(authUrl.searchParams.get('access_type'), 'offline')
assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256')
assert.equal(authUrl.searchParams.get('state'), oauth.value)
assert.ok((authUrl.searchParams.get('scope') || '').includes('calendar.events'))
assert.equal(authUrl.searchParams.has('client_secret'), false)

const driveScopes = googleScopesForProviderKey('google_drive')
assert.ok(driveScopes)
assert.ok(driveScopes.includes('https://www.googleapis.com/auth/drive.file'))
assert.equal(driveScopes.some((scope) => scope === 'https://www.googleapis.com/auth/drive'), false)

console.log('Orçaly Google OAuth foundation checks: PASS')
