import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// lib/orcaly-next uses extensionless relative imports (Next/TS convention); resolve them to .ts for node:test.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('./') && !path.extname(specifier) && context.parentURL?.includes('/lib/orcaly-next/')) {
      return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
    }
    return next(specifier, context)
  },
})
const status = await import('../lib/orcaly-next/product-status.ts')
const registryModule = await import('../lib/orcaly-next/product-registry.ts')
const { skinContracts, contrastRatio, skinStyle } = await import('../lib/orcaly-next/skins.ts')
const { buildCommandIndex, rankCommands, normalizeQuery, scoreCommand } = await import('../lib/orcaly-next/command-index.ts')
const { buildHubSections, productRoot } = await import('../lib/orcaly-next/hub-model.ts')
const demo = await import('../lib/orcaly-next/demo-data.ts')
const { landingContent } = await import('../lib/orcaly-next/landing-content.ts')
const { isActiveHref, mostSpecificActive } = await import('../lib/orcaly-next/navigation.ts')
hook.deregister()
const live = await import('../lib/ecosystem/products.ts')

const { productRegistry, validateRegistry, operationalProducts, resolveProductDestination, navItems, SCOPES, ENTITLEMENT_SOURCES } = registryModule
const { HUB_STATUSES, RELEASE_STATUSES, ACCOUNT_SIGNALS, deriveHubStatus, hubStatusCopy, releaseFromLegacy, isHubStatus } = status
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clone = (value) => structuredClone(value)

/** Resolves an internal href to an App Router page.tsx, honouring dynamic [param] folders. */
function routeExists(href) {
  const clean = href.replace(/[?#].*$/, '')
  const segments = clean.split('/').filter(Boolean)
  let dir = path.join(root, 'app')
  const dynamicMatches = []
  for (const segment of segments) {
    const literal = path.join(dir, segment)
    if (existsSync(literal) && statSync(literal).isDirectory()) { dir = literal; continue }
    const dynamic = existsSync(dir) ? readdirSync(dir).find((name) => /^\[[^.\]]+\]$/.test(name)) : undefined
    if (!dynamic) return false
    dynamicMatches.push({ folder: dir, value: segment })
    dir = path.join(dir, dynamic)
  }
  if (!existsSync(path.join(dir, 'page.tsx'))) return false
  // /produtos/[slug] is statically generated from the live registry.
  for (const match of dynamicMatches) if (match.folder.endsWith(`${path.sep}produtos`) && !live.isProductId(match.value)) return false
  return true
}

test('registry is structurally valid and every id/slug is unique', () => {
  assert.deepEqual(validateRegistry(productRegistry), [])
  assert.equal(new Set(productRegistry.map((p) => p.id)).size, productRegistry.length)
  assert.equal(new Set(productRegistry.map((p) => p.slug)).size, productRegistry.length)
})

test('validator rejects duplicated ids, slugs and nav ids', () => {
  const dup = clone(productRegistry); dup[1].id = 'business'; dup[1].slug = 'business'
  const fields = validateRegistry(dup).map((issue) => issue.field)
  assert.ok(fields.includes('id')); assert.ok(fields.includes('slug'))
  const nav = clone(productRegistry)
  nav.find((p) => p.id === 'partners').navigation.groups[0].items[1].id = 'partners.painel'
  assert.ok(validateRegistry(nav).some((issue) => issue.message.includes('duplicated nav id')))
})

test('validator rejects missing minimum metadata, bad scopes, bad entitlements and unsafe AI', () => {
  const cases = [
    [(r) => { r[0].name = '' }, 'name'],
    [(r) => { r[0].description = '  ' }, 'description'],
    [(r) => { r[0].name = 'Business' }, 'name'],
    [(r) => { r[0].scopes = ['tenant'] }, 'scopes'],
    [(r) => { r[0].scopes = [] }, 'scopes'],
    [(r) => { r[0].entitlement.key = 'business' }, 'entitlement'],
    [(r) => { r[0].entitlement.sources = ['gift'] }, 'entitlement'],
    [(r) => { r[1].ai.enabledModes = ['analysis', 'execution'] }, 'ai'],
    [(r) => { r[1].ai.crossProductContext = 'ALLOW' }, 'ai'],
    [(r) => { r[0].landing.path = 'https://evil.example' }, 'landing'],
    [(r) => { r[0].app.path = '//evil.example' }, 'app'],
    [(r) => { r[1].navigation.groups[0].items[0].href = '/apps/../admin' }, 'navigation'],
    [(r) => { r[2].navigation = { source: 'registry', groups: [{ id: 'x', label: 'X', items: [{ id: 'growth.x', label: 'X', href: '/apps/growth' }] }] } }, 'navigation'],
    [(r) => { r[1].logo = { src: null, assetStatus: 'AVAILABLE' } }, 'logo'],
    [(r) => { r[0].notifications.namespace = 'business' }, 'notifications'],
  ]
  for (const [mutate, field] of cases) {
    const copy = clone(productRegistry); mutate(copy)
    assert.ok(validateRegistry(copy).some((issue) => issue.field === field), `expected ${field} issue`)
  }
})

test('parity with the live registry: same products, order, release, entitlement and brand colors', () => {
  assert.deepEqual(productRegistry.map((p) => p.id), [...live.productIds])
  for (const product of productRegistry) {
    const legacy = live.getProduct(product.id)
    assert.ok(legacy, product.id)
    assert.equal(product.release, releaseFromLegacy(legacy.status), `${product.id} release`)
    assert.equal(product.entitlement.key, legacy.entitlement, `${product.id} entitlement`)
    assert.equal(product.name, legacy.name, `${product.id} name`)
    assert.equal(skinContracts[product.skin].accent, legacy.experience.primary, `${product.id} accent`)
    assert.equal(skinContracts[product.skin].surface, legacy.experience.surface, `${product.id} surface`)
    assert.equal(product.pwa.themeColor, legacy.experience.themeColor, `${product.id} theme`)
    assert.equal(product.pwa.installable, legacy.installability.enabled, `${product.id} installability`)
    assert.ok(legacy.permissions.every((permission) => permission.startsWith(product.entitlement.permissionPrefix)), `${product.id} permissions`)
    if (legacy.featureFlag) assert.ok(product.featureFlags.includes(legacy.featureFlag), `${product.id} flag`)
    const legacyScope = { company: ['company'], personal: ['personal'], partner: ['personal'], bundle: [] }[legacy.context]
    assert.deepEqual([...product.scopes], legacyScope, `${product.id} scope`)
  }
})

test('every LIVE route exists; every NOT_BUILT route is absent and only on COMING_SOON products', () => {
  for (const product of productRegistry) {
    assert.ok(routeExists(product.landing.path), `${product.id} landing ${product.landing.path}`)
    if (!product.app) continue
    if (product.app.status === 'LIVE') assert.ok(routeExists(product.app.path), `${product.id} app ${product.app.path}`)
    else {
      assert.equal(routeExists(product.app.path), false, `${product.id} NOT_BUILT route unexpectedly exists — mark LIVE`)
      assert.equal(deriveHubStatus({ release: product.release, account: 'ENTITLED', externalBlocked: false }), 'COMING_SOON')
    }
    for (const item of navItems(product)) assert.ok(routeExists(item.href), `${product.id} nav ${item.href}`)
  }
})

test('One is a bundle and never an operational app', () => {
  const one = productRegistry.find((p) => p.id === 'one')
  assert.equal(one.kind, 'bundle'); assert.equal(one.app, null); assert.deepEqual([...one.scopes], [])
  assert.ok(!operationalProducts().some((p) => p.id === 'one'))
  const commands = buildCommandIndex(productRegistry, { one: 'ACTIVE' })
  assert.ok(!commands.some((c) => c.productId === 'one'))
  const hub = buildHubSections(productRegistry, [{ productId: 'one', status: 'ACTIVE' }])
  assert.ok(![...hub.yourApps, ...hub.otherProducts].some((tile) => tile.product.id === 'one'))
  assert.equal(hub.one?.id, 'one')
  assert.ok(!one.entitlement.sources.includes('one_bundle'))
})

test('scopes and entitlement sources are drawn only from the canonical vocabularies', () => {
  for (const product of productRegistry) {
    for (const scope of product.scopes) assert.ok(SCOPES.includes(scope))
    for (const source of product.entitlement.sources) assert.ok(ENTITLEMENT_SOURCES.includes(source))
    assert.equal(product.entitlement.key, `product.${product.id}`)
  }
  assert.deepEqual([...SCOPES], ['personal', 'company', 'household'])
})

test('hub status derivation is total, valid and every one of the 8 statuses is reachable', () => {
  const seen = new Set()
  for (const release of RELEASE_STATUSES) for (const account of ACCOUNT_SIGNALS) for (const externalBlocked of [false, true]) {
    const result = deriveHubStatus({ release, account, externalBlocked })
    assert.ok(isHubStatus(result)); seen.add(result)
    if (release === 'IN_DEVELOPMENT') assert.equal(result, 'COMING_SOON')
  }
  assert.deepEqual([...seen].sort(), [...HUB_STATUSES].sort())
  assert.equal(HUB_STATUSES.length, 8)
  for (const hubStatus of HUB_STATUSES) assert.ok(hubStatusCopy[hubStatus].label && hubStatusCopy[hubStatus].action)
})

test('status precedence: account problems surface before external blocks; early access is invite-only', () => {
  assert.equal(deriveHubStatus({ release: 'LIVE', account: 'SUSPENDED', externalBlocked: true }), 'SUSPENDED')
  assert.equal(deriveHubStatus({ release: 'LIVE', account: 'PAYMENT_PENDING', externalBlocked: true }), 'PAYMENT_PENDING')
  assert.equal(deriveHubStatus({ release: 'LIVE', account: 'ENTITLED', externalBlocked: true }), 'BLOCKED_EXTERNAL')
  assert.equal(deriveHubStatus({ release: 'EARLY_ACCESS', account: 'NONE', externalBlocked: false }), 'COMING_SOON')
  assert.equal(deriveHubStatus({ release: 'EARLY_ACCESS', account: 'TRIAL', externalBlocked: false }), 'TRIAL')
  assert.equal(deriveHubStatus({ release: 'LIVE', account: 'LAPSED', externalBlocked: false }), 'NOT_SUBSCRIBED')
  assert.equal(deriveHubStatus({ release: 'LIVE', account: 'NONE', externalBlocked: false }), 'AVAILABLE')
})

test('destinations: subscribed opens the app, unsubscribed opens the landing, NOT_BUILT never opens', () => {
  const byId = Object.fromEntries(productRegistry.map((p) => [p.id, p]))
  assert.deepEqual(resolveProductDestination(byId.wealth, 'ACTIVE'), { href: '/apps/wealth', kind: 'app', reason: 'entitled' })
  assert.equal(resolveProductDestination(byId.wealth, 'TRIAL').kind, 'app')
  for (const s of ['AVAILABLE', 'NOT_SUBSCRIBED', 'PAYMENT_PENDING', 'SUSPENDED', 'COMING_SOON']) assert.equal(resolveProductDestination(byId.business, s).href, '/business')
  assert.equal(resolveProductDestination(byId.wealth, 'BLOCKED_EXTERNAL').kind, 'app')
  assert.equal(resolveProductDestination(byId.growth, 'BLOCKED_EXTERNAL').kind, 'landing')
  assert.deepEqual(resolveProductDestination(byId.growth, 'ACTIVE'), { href: '/produtos/growth', kind: 'landing', reason: 'app-not-built' })
})

test('command index exposes internal routes only for products the account can open', () => {
  const commands = buildCommandIndex(productRegistry, { business: 'ACTIVE', wealth: 'NOT_SUBSCRIBED', partners: 'TRIAL' })
  assert.ok(commands.some((c) => c.href === '/painel/pedidos'))
  assert.ok(commands.some((c) => c.href === '/parceiros/pipeline'))
  assert.ok(!commands.some((c) => c.href.startsWith('/apps/wealth/')))
  assert.equal(commands.find((c) => c.id === 'product.wealth').href, '/produtos/wealth')
  assert.equal(commands.find((c) => c.id === 'product.growth').title, 'Conhecer Growth')
  assert.equal(new Set(commands.map((c) => c.id)).size, commands.length)
})

test('ranking is deterministic, accent-insensitive, AND-matching and input-order independent', () => {
  const commands = buildCommandIndex(productRegistry, { business: 'ACTIVE', wealth: 'ACTIVE', partners: 'ACTIVE' })
  const first = rankCommands(commands, 'calendario').map((c) => c.id)
  assert.equal(first[0], 'nav.wealth.calendario')
  const shuffled = [...commands].reverse()
  for (const query of ['', 'a', 'wealth', 'pedidos', 'contas', 'abrir', 'priv']) {
    assert.deepEqual(rankCommands(shuffled, query).map((c) => c.id), rankCommands(commands, query).map((c) => c.id), query)
  }
  assert.equal(normalizeQuery('  Ação   ÚNICA '), 'acao unica')
  assert.deepEqual(rankCommands(commands, 'zzzz-nada'), [])
  assert.equal(scoreCommand(commands.find((c) => c.id === 'nav.wealth.dividas'), 'dividas wealth') > 0, true)
  assert.equal(scoreCommand(commands.find((c) => c.id === 'nav.wealth.dividas'), 'dividas pedidos'), 0)
  assert.ok(rankCommands(commands, '').length <= 12)
})

test('skins keep brand colors and meet WCAG AA for accent text on white and on the skin surface', () => {
  for (const skin of Object.values(skinContracts)) {
    const text = skin.accentText ?? skin.accent
    assert.ok(contrastRatio(text, '#ffffff') >= 4.5, `${skin.key} on white`)
    assert.ok(contrastRatio(text, skin.surface) >= 4.5, `${skin.key} on surface`)
    assert.ok(contrastRatio('#ffffff', skin.accent) >= 4.5, `white on ${skin.key}`)
    assert.ok(skinStyle(skin.key)['--ox-accent'] === skin.accent)
  }
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
})

test('landing content: one contract per app, no fabricated metrics, prices or testimonials', () => {
  const apps = operationalProducts().map((p) => p.id).sort()
  assert.deepEqual(landingContent.map((c) => c.productId).sort(), apps)
  const forbidden = [/\d[\d.,]*\s*(mil|k\b|clientes|empresas|usuários|negócios|%)/i, /R\$\s*\d/, /\b\d+,\d{2}\b/, /depoimento|testimonial|avalia(ç|c)ão \d|★/i, /l[ií]der de mercado|n[ºo°]\s*1\b/i]
  for (const content of landingContent) {
    const text = JSON.stringify(content)
    for (const pattern of forbidden) assert.ok(!pattern.test(text), `${content.productId} matches ${pattern}`)
    for (const shot of content.screenshots) assert.equal(shot.status, 'PLACEHOLDER')
    assert.equal(content.trial.status, 'NOT_CONFIGURED')
    const product = productRegistry.find((p) => p.id === content.productId)
    for (const feature of content.features) {
      if (feature.status === 'LIVE') {
        assert.ok(feature.evidence && existsSync(path.join(root, feature.evidence)), `${content.productId} feature evidence ${feature.evidence}`)
        assert.notEqual(product.release, 'IN_DEVELOPMENT', `${content.productId} cannot have LIVE features`)
      }
    }
    for (const integration of content.integrations) {
      const evidence = integration.evidence.split('#')[0]
      assert.ok(existsSync(path.join(root, evidence)), `${content.productId} integration evidence ${evidence}`)
    }
    if (product.release === 'IN_DEVELOPMENT') assert.ok(content.features.every((f) => f.status === 'PLANNED'))
  }
})

test('demo data is labeled, derived from real rules and never makes an unreleased product openable', () => {
  assert.ok(demo.isDemo); assert.match(demo.DEMO_LABEL, /demonstração/i)
  for (const snapshot of demo.demoSnapshots) {
    const product = productRegistry.find((p) => p.id === snapshot.productId)
    if (product.release === 'IN_DEVELOPMENT') assert.equal(snapshot.status, 'COMING_SOON')
  }
  assert.deepEqual(demo.demoStatusGallery.map((g) => g.status), [...HUB_STATUSES])
  assert.ok(demo.demoStatusGallery.every((g) => g.name.startsWith('Exemplo')))
  for (const item of [...demo.demoPulse, ...demo.demoActivity]) assert.match(item.title ?? item.label, /^Exemplo:/)
  for (const item of demo.demoPulse) assert.match(item.source, /demonstração/)
})

test('hub sections: relationship statuses go to Seus Apps; continue never leaves the product', () => {
  const hub = buildHubSections(productRegistry, [
    { productId: 'business', status: 'ACTIVE', continueItem: { label: 'Pedidos', href: '/painel/pedidos', at: '2026-09-27T10:00:00Z' } },
    { productId: 'wealth', status: 'ACTIVE', continueItem: { label: 'Fora', href: '/admin', at: '2026-09-27T11:00:00Z' } },
    { productId: 'partners', status: 'SUSPENDED', continueItem: { label: 'Portal', href: '/parceiros/painel', at: '2026-09-27T12:00:00Z' } },
  ])
  assert.deepEqual(hub.yourApps.map((t) => t.product.id), ['business', 'wealth', 'partners'])
  assert.deepEqual(hub.continueItems.map((c) => c.href), ['/painel/pedidos'])
  assert.deepEqual(hub.otherProducts.map((t) => t.status), ['COMING_SOON', 'COMING_SOON', 'COMING_SOON', 'COMING_SOON'])
  assert.equal(productRoot('/apps/wealth/metas'), '/apps/wealth'); assert.equal(productRoot('/painel/inicio'), '/painel')
})

test('active navigation matching handles roots, sub-paths, query strings and external links', () => {
  assert.ok(isActiveHref('/apps/wealth/metas/abc', '/apps/wealth/metas'))
  assert.ok(!isActiveHref('/apps/wealth/metas', '/apps/wealth', ['/apps/wealth']))
  assert.ok(isActiveHref('/apps/wealth', '/apps/wealth', ['/apps/wealth']))
  assert.ok(!isActiveHref('/apps/wealthy', '/apps/wealth'))
  assert.ok(isActiveHref('/painel/pedidos/', '/painel/pedidos?status=aberto'))
  assert.ok(!isActiveHref('/x', 'https://orcaly.com.br/x'))
  assert.equal(mostSpecificActive('/apps/wealth/metas/1', ['/apps/wealth', '/apps/wealth/metas']), '/apps/wealth/metas')
})
