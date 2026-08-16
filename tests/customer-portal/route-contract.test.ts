import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

function read(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), 'utf8')
}

const resolveRoute = read(
  'app',
  'api',
  'customer-portal',
  'resolve',
  'route.ts',
)
const managementRoute = read(
  'app',
  'api',
  'orders',
  '[id]',
  'portal-access',
  'route.ts',
)
const dataAccess = read('lib', 'customer-portal', 'access.server.ts')
const portalClient = read(
  'components',
  'customer-portal',
  'CustomerPortalPageClient.tsx',
)
const proxy = read('proxy.ts')

test('public resolution is POST-only, rate limited and never puts token in API path', () => {
  assert.match(resolveRoute, /export async function POST/)
  assert.doesNotMatch(resolveRoute, /export async function GET/)
  assert.match(resolveRoute, /enforceRateLimit/)
  assert.match(resolveRoute, /scope: 'customer-portal-resolve'/)
  assert.doesNotMatch(resolveRoute, /\[token\]/)
  assert.match(portalClient, /window\.location\.hash/)
  assert.match(managementRoute, /\/acompanhar#\$\{token\}/)
  assert.doesNotMatch(managementRoute, /\/acompanhar\/\$\{token\}/)
})

test('portal DAL uses explicit allowlists and customer-visible events only', () => {
  assert.doesNotMatch(dataAccess, /\.select\(['"]\*['"]\)/)
  assert.match(dataAccess, /\.eq\('company_id', access\.company_id\)/)
  assert.match(dataAccess, /\.eq\('entity_id', access\.entity_id\)/)
  assert.match(dataAccess, /\.eq\('visibility', 'customer_visible'\)/)
  assert.match(dataAccess, /isFeatureEnabled\('customer_portal'/)
  assert.doesNotMatch(dataAccess, /order_status_history/)

  for (const forbiddenColumn of [
    'internal_notes',
    'observacoes_internas',
    'provider_payment_id',
    'owner_id',
    'customer_phone',
    'customer_email',
  ]) {
    assert.equal(dataAccess.includes(`'${forbiddenColumn}'`), false)
  }
})

test('portal responses and HTML are explicitly private and non-indexable', () => {
  assert.match(resolveRoute, /private, no-store, no-cache/)
  assert.match(resolveRoute, /'Referrer-Policy': 'no-referrer'/)
  assert.match(resolveRoute, /'X-Robots-Tag': 'noindex, nofollow/)
  assert.match(proxy, /pathname\.startsWith\('\/acompanhar\/'\)/)
  assert.match(proxy, /customerPortal.*Referrer-Policy.*no-referrer/)
})

test('management endpoint requires auth, permission, tenant and feature flag', () => {
  assert.match(managementRoute, /getRequester/)
  assert.match(managementRoute, /'portal\.manage'/)
  assert.match(managementRoute, /isFeatureEnabled\('customer_portal'/)
  assert.match(managementRoute, /\.eq\('company_id', companyId\)/)
  assert.match(managementRoute, /orcaly_rotate_customer_portal_access/)
  assert.doesNotMatch(managementRoute, /tokenHash[^\n]+console/)
})
