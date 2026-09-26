import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { integrationProviders } = await import('../lib/integrations/core/registry.ts')
const { getProviderConfigurationSpec, validateProviderConfiguration } = await import('../lib/integrations/provider-configuration.ts')

const expectedProviders = [
  'google_calendar', 'resend', 'google_maps', 'nfse', 'google_business_profile',
  'google_drive', 'google_sheets', 'meta_leads', 'clicksign', 'mercado_livre',
  'shopee', 'bling', 'omie', 'zapier', 'make', 'n8n',
].sort()
assert.deepEqual(integrationProviders.map((provider) => provider.key).sort(), expectedProviders)
assert.equal(integrationProviders.some((provider) => ['gmail', 'slack', 'microsoft_teams', 'open_finance'].includes(provider.key)), false)

const maps = validateProviderConfiguration('google_maps', { api_key: 'maps-server-key' }, null)
assert.equal(maps.ok, true)
assert.deepEqual(maps.ok ? maps.credentials : {}, { api_key: 'maps-server-key' })
const invalidNfse = validateProviderConfiguration('nfse', { provider_name: 'municipal', environment: 'invalid' }, null)
assert.equal(invalidNfse.ok, false)
assert.equal(getProviderConfigurationSpec('omie').credentialKeys.length, 2)

const apiKeySource = readFileSync('lib/integrations/public-api-keys.ts', 'utf8')
assert.match(apiKeySource, /createHash\('sha256'\)/)
assert.match(apiKeySource, /timingSafeEqual/)
assert.match(apiKeySource, /randomBytes\(32\)/)
assert.match(apiKeySource, /\.eq\('company_id', input\.companyId\)/)
assert.match(apiKeySource, /\.is\('revoked_at', null\)/)

const migration = readFileSync('supabase/migrations/20260914213803_integration_public_api_keys.sql', 'utf8')
assert.match(migration, /enable row level security/)
assert.match(migration, /revoke all on table public\.integration_api_keys from public, anon, authenticated/)
assert.match(migration, /grant select, insert, update, delete on table public\.integration_api_keys to service_role/)

const apiRoute = readFileSync('app/api/v1/health/route.ts', 'utf8')
assert.match(apiRoute, /authenticatePublicApiKey/)
assert.match(apiRoute, /request\.headers\.get\('authorization'\)/)

console.log('Orçaly integration expansion scope and public API checks: PASS')
