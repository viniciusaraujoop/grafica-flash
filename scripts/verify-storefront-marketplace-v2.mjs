import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const publicClient = read('components/public-site/PublicSiteClient.tsx')
const chrome = read('components/public-site/StorefrontExperienceV2.tsx')
const productPage = read('app/site/[slug]/produto/[productId]/page.tsx')
const productActions = read('components/public-site/StorefrontProductActions.tsx')
const searchApi = read('app/api/public-site/[slug]/search/route.ts')
const eventsApi = read('app/api/public-site/[slug]/events/route.ts')
const settingsApi = read('app/api/site/settings/route.ts')
const food = read('components/public-site/FoodMarketplaceCatalog.tsx')
const segment = read('components/public-site/SegmentMarketplaceCatalog.tsx')
const checkout = read('components/checkout/CheckoutClient.tsx')
const panelModules = read('lib/panel-modules.ts')
const migration = read('supabase/migrations/20260819234000_storefront_marketplace_v2.sql')

assert(publicClient.includes('StorefrontExperienceV2') && publicClient.includes('PublicSiteRenderer'), 'Public site must evolve around the existing renderer')
assert(chrome.includes('storefront-search') && chrome.includes('orcaly-storefront-favorites') && chrome.includes('orcaly-storefront-recent'), 'Storefront discovery/local state missing')
assert(chrome.includes('business_hours') && chrome.includes('delivery_zones'), 'Topbar must use real operating data')
assert(productPage.includes('application/ld+json') && productPage.includes('productPrice(product)'), 'Product detail SEO must be grounded in product data')
assert(productActions.includes('navigator.share') && productActions.includes('favorite_add'), 'Product share/favorite behavior missing')
assert(searchApi.includes('.limit(8)') && searchApi.includes('result_count'), 'Search must be limited and track search gaps')
assert(eventsApi.includes("allowedEvents = new Set") && eventsApi.includes("createHash('sha256')"), 'Analytics allowlist/session hashing missing')
for (const forbidden of ['password','authorization','access_token','refresh_token','card_number','cpfCnpj']) {
  assert(!eventsApi.toLowerCase().includes(`metadata.${forbidden}`), `Sensitive analytics field leaked: ${forbidden}`)
}
assert(migration.includes('storefront_events') && migration.includes('storefront_reviews'), 'Storefront additive schema missing')
assert(migration.includes('enable row level security'), 'Storefront tables must enable RLS')
assert(food.includes('`orcaly-checkout:${slug}`') && food.includes('/checkout/${encodeURIComponent(slug)}?origem=marketplace-food'), 'Food checkout handoff changed')
assert(segment.includes('`orcaly-checkout:${slug}`') && segment.includes('/checkout/${encodeURIComponent(slug)}?origem=marketplace'), 'Segment checkout handoff changed')
assert(checkout.includes('/prepare') && checkout.includes('/status?paymentId='), 'Existing checkout contract markers missing')
assert(settingsApi.includes('site_product_card_style') && settingsApi.includes('site_seo_title'), 'Existing site configuration fields were not exposed safely')
assert(!settingsApi.includes('mercado_pago_access_token'), 'Site builder settings must not edit payment credentials')

for (const route of ['/painel/site','/painel/produtos','/painel/cupons','/painel/relatorios','/painel/entregas','/painel/horarios','/painel/pagamentos']) {
  assert(panelModules.includes(`'${route}'`), `Canonical panel route missing from registry: ${route}`)
}
for (const file of ['app/painel/site/page.tsx','app/painel/produtos/page.tsx','app/painel/cupons/page.tsx','app/painel/relatorios/page.tsx','app/painel/entregas/page.tsx','app/painel/horarios/page.tsx','app/painel/pagamentos/page.tsx']) {
  assert(exists(file), `Panel destination does not exist: ${file}`)
}

const base = process.env.STOREFRONT_BASE_SHA || ''
if (base) {
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
  const protectedPrefixes = [
    'lib/payments/',
    'lib/mercado-pago',
    'app/api/checkout/',
    'components/checkout/CheckoutClient.tsx',
    'app/api/marketplace/coupon',
    'app/api/marketplace/payments/',
  ]
  const touched = changed.filter((file) => protectedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)))
  assert(touched.length === 0, `Protected payment/checkout contract changed: ${touched.join(', ')}`)
}

for (const file of [
  'components/public-site/StorefrontExperienceV2.tsx',
  'components/public-site/StorefrontProductActions.tsx',
  'app/api/public-site/[slug]/search/route.ts',
  'app/api/public-site/[slug]/events/route.ts',
  'app/site/[slug]/produto/[productId]/page.tsx',
]) {
  const source = read(file)
  assert(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), `Service role leaked to storefront client/surface: ${file}`)
  assert(!source.includes('console.log('), `Debug console introduced: ${file}`)
  assert(!source.includes('TODO'), `Temporary TODO introduced: ${file}`)
}

console.log('Storefront Marketplace v2 invariants: PASS')
