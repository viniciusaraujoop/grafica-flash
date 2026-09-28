// Wave 1 T1 — Industry Pack core: invariants, catalog, legacy mapping, diff/proposal, determinism.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packs = await import('../../lib/industry-packs/index.ts')
const { buildWave1PackRegistry } = await import('../../lib/wave1/manifest.ts')
const { sha256Hex } = await import('../../lib/wave1/shared/sha256.server.ts')
const { nichosOrcaly } = await import('../../lib/orcaly-nichos.ts')
const { allSegments } = await import('../../lib/segment-modules.ts')
const { companyPermissionAllowed } = await import('../../lib/access-control-core.ts')

const {
  validatePack,
  resolvePack,
  classifyPackItem,
  diffPackAgainstCompany,
  buildPackProposal,
  buildRegistrySnapshot,
  roleCapabilityFlags,
  ALL_COMPANY_PERMISSIONS,
  legacyNichoToPackKey,
  LEGACY_NICHO_IDS,
  industryPackCatalog,
  WAVE1_PACK_KEYS,
  buildResolvedView,
} = packs

const registry = buildWave1PackRegistry()
const clone = (value) => structuredClone(value)
const byKey = (key) => industryPackCatalog.find((pack) => pack.key === key)
const codes = (result) => (result.ok ? [] : result.errors.map((error) => error.code))
const hash = sha256Hex

function emptyCompany(overrides = {}) {
  return {
    schemaVersion: 1,
    companyId: '00000000-0000-4000-8000-000000000001',
    businessType: 'graphic',
    plan: 'premium',
    entitledFeatures: [...registry.features],
    enabledModules: [],
    statuses: {},
    categories: [],
    settings: {},
    templates: [],
    dashboardCards: [],
    enabledReports: [],
    activeRecipes: [],
    integrations: [],
    rolePermissionProfiles: {},
    onboardingSteps: [],
    appliedPack: null,
    userOverrides: [],
    platform: { availableIntegrations: [], availableRecipes: [] },
    ...overrides,
  }
}

function mutate(key, fn) {
  const pack = clone(byKey(key))
  fn(pack)
  return validatePack(pack, registry)
}

// ---- catalog ------------------------------------------------------------------------------------

test('catalog contains exactly the four Wave 1 packs, all published and valid', () => {
  assert.deepEqual(industryPackCatalog.map((pack) => pack.key), [...WAVE1_PACK_KEYS])
  assert.deepEqual([...WAVE1_PACK_KEYS].sort(), ['food.restaurant', 'graphic.print_shop', 'services.general', 'store.local_store'])
  for (const pack of industryPackCatalog) {
    assert.equal(pack.status, 'published', pack.key)
    const result = validatePack(pack, registry)
    assert.equal(result.ok, true, `${pack.key}: ${JSON.stringify(result.ok ? [] : result.errors)}`)
  }
})

test('canonical business types: graphic, food, services, store (Varejo is presentation only)', () => {
  assert.deepEqual(
    Object.fromEntries(industryPackCatalog.map((pack) => [pack.key, pack.businessType])),
    { 'graphic.print_shop': 'graphic', 'food.restaurant': 'food', 'services.general': 'services', 'store.local_store': 'store' },
  )
  for (const pack of industryPackCatalog) assert.ok(allSegments.includes(pack.businessType))
  assert.equal(byKey('graphic.visual_communication'), undefined)
  assert.ok(byKey('graphic.print_shop').subsegments.includes('Comunicação visual'))
})

test('catalog content is sourced from the legacy niches (provenance)', () => {
  const legacy = Object.fromEntries(nichosOrcaly.map((nicho) => [nicho.id, nicho]))
  const orderLabels = (key) =>
    byKey(key).items.filter((item) => item.kind === 'status' && item.value.scope === 'order').sort((a, b) => a.value.order - b.value.order).map((item) => item.value.label)
  assert.deepEqual(orderLabels('graphic.print_shop'), legacy.grafica.status)
  assert.deepEqual(orderLabels('services.general'), legacy.prestador_servico.status)
  assert.deepEqual(orderLabels('store.local_store'), legacy.loja_local.status)
})

test('catalog templates never contain markup and only allowlisted placeholders', () => {
  for (const pack of industryPackCatalog) {
    for (const item of pack.items.filter((entry) => entry.kind === 'template')) {
      assert.doesNotMatch(JSON.stringify(item.value.content), /<[^>]+>/, `${pack.key}/${item.id}`)
    }
  }
})

test('catalog never grants a role more than it already has (no permission escalation)', () => {
  for (const pack of industryPackCatalog) {
    for (const item of pack.items.filter((entry) => entry.kind === 'permission')) {
      for (const grant of item.value.grants) assert.ok(registry.rolePermissions[item.value.role].includes(grant), `${pack.key} ${item.value.role} ${grant}`)
    }
  }
})

test('recipes and integrations in packs are always opt-in', () => {
  for (const pack of industryPackCatalog) {
    for (const item of pack.items.filter((entry) => entry.kind === 'recipe' || entry.kind === 'integration')) {
      assert.ok(['recommended', 'optional'].includes(item.requirement), `${pack.key}/${item.id}`)
    }
  }
})

// ---- legacy mapping ------------------------------------------------------------------------------

test('legacy mapping covers every NichoId and never invents packs', () => {
  assert.deepEqual([...LEGACY_NICHO_IDS], nichosOrcaly.map((nicho) => nicho.id).sort())
  for (const nichoId of LEGACY_NICHO_IDS) {
    const mapping = legacyNichoToPackKey(nichoId)
    assert.ok(mapping)
    assert.ok(allSegments.includes(mapping.businessType))
    if (mapping.packKey) {
      assert.equal(mapping.status, 'WAVE1_PACK')
      const pack = byKey(mapping.packKey)
      assert.ok(pack, mapping.packKey)
      assert.equal(pack.businessType, mapping.businessType)
      assert.ok(pack.legacy.nichoIds.includes(nichoId), `${nichoId} listed in ${pack.key}.legacy`)
    } else {
      assert.equal(mapping.status, 'NO_WAVE1_PACK')
    }
  }
  assert.equal(legacyNichoToPackKey('grafica').packKey, 'graphic.print_shop')
  assert.equal(legacyNichoToPackKey('loja_local').packKey, 'store.local_store')
  assert.equal(legacyNichoToPackKey('personalizados').packKey, null)
  for (const junk of ['unknown', '', null, undefined, '__proto__', 'constructor', 'toString']) assert.equal(legacyNichoToPackKey(junk), null)
})

// ---- invariants I1–I16 ------------------------------------------------------------------------------

test('I1 key/businessType', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.key = 'food.print_shop'))).includes('PACK_KEY_INVALID'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.key = 'graphic.X'))).includes('PACK_KEY_INVALID'))
  assert.ok(codes(mutate('store.local_store', (p) => (p.businessType = 'retail'))).includes('PACK_BUSINESS_TYPE_INVALID'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.capabilities = ['cap.teleport']))).includes('PACK_CAPABILITY_UNKNOWN'))
})

test('I2 version and changelog', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.version = '1.0'))).includes('PACK_VERSION_INVALID'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.version = '1.1.0'))).includes('PACK_VERSION_INVALID'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.changelog = []))).includes('PACK_VERSION_INVALID'))
  assert.ok(
    codes(mutate('graphic.print_shop', (p) => p.changelog.push({ ...p.changelog[0], version: '2.0.0' }))).includes('PACK_VERSION_INVALID'),
  )
})

test('I3 duplicate items', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => p.items.push(clone(p.items[0])))).includes('PACK_ITEM_DUPLICATE'))
})

test('I4 module unknown or from another segment', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items[0].value.moduleId = 'nope'))).includes('PACK_MODULE_UNKNOWN'))
  const result = mutate('graphic.print_shop', (p) => p.items.push({ kind: 'module', id: 'cardapio', requirement: 'optional', value: { moduleId: 'cardapio' } }))
  assert.ok(codes(result).includes('PACK_MODULE_SEGMENT_MISMATCH'))
})

test('I5 dashboard metric must exist', () => {
  const result = mutate('food.restaurant', (p) => (p.items.find((item) => item.kind === 'dashboard').value.metricKey = 'lucroMagico'))
  assert.ok(codes(result).includes('PACK_METRIC_UNKNOWN'))
})

test('I6 recipe must exist and be internal-only', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'recipe').value.recipeRef = 'nope@1.0.0'))).includes('PACK_RECIPE_UNKNOWN'))
  const external = { ...registry, recipes: registry.recipes.map((recipe) => ({ ...recipe, internalOnly: false })) }
  assert.ok(codes(validatePack(byKey('graphic.print_shop'), external)).includes('PACK_RECIPE_BLOCKED'))
})

test('I7 recipe/integration can never be required or default', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'recipe').requirement = 'required'))).includes('PACK_OPT_IN_REQUIRED'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'integration').requirement = 'default'))).includes('PACK_OPT_IN_REQUIRED'))
})

test('I8 status flow must be contiguous with new + terminal', () => {
  assert.ok(codes(mutate('food.restaurant', (p) => (p.items.find((item) => item.kind === 'status').value.order = 99))).includes('PACK_STATUS_FLOW_INVALID'))
  const noTerminal = mutate('food.restaurant', (p) => p.items.filter((item) => item.kind === 'status').forEach((item) => delete item.value.terminal))
  assert.ok(codes(noTerminal).includes('PACK_STATUS_FLOW_INVALID'))
})

test('I9 templates reject HTML, unknown placeholders and oversized text', () => {
  const html = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template' && item.value.content.format === 'plain').value.content.text = 'Oi <script>alert(1)</script>'))
  assert.ok(codes(html).includes('PACK_TEMPLATE_UNSAFE'))
  const img = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template' && item.value.content.format === 'proposal').value.content.titulo = '<img src=x onerror=alert(1)>'))
  assert.ok(codes(img).includes('PACK_TEMPLATE_UNSAFE'))
  const placeholder = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template' && item.value.content.format === 'plain').value.content.text = 'Olá {{cpf_cliente}}'))
  assert.ok(codes(placeholder).includes('PACK_TEMPLATE_UNSAFE'))
  const allowed = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template' && item.value.content.format === 'plain').value.content.text = 'Olá {{cliente_nome}}'))
  assert.equal(allowed.ok, true)
  const long = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template' && item.value.content.format === 'plain').value.content.text = 'x'.repeat(1001)))
  assert.ok(codes(long).includes('PACK_TEMPLATE_UNSAFE'))
  const format = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'template').value.content = { format: 'html', html: '<b>x</b>' }))
  assert.ok(codes(format).includes('PACK_TEMPLATE_UNSAFE'))
})

test('I10 settings allowlist and value validation', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => p.items.push({ kind: 'setting', id: 'pix', requirement: 'default', value: { path: 'companies.pix_key', value: 'x' } }))).includes('PACK_SETTING_FORBIDDEN'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items.find((item) => item.id === 'payments.depositEnabled').value = { path: 'payments.depositPercent', value: 150 }))).includes('PACK_SETTING_FORBIDDEN'))
})

test('I11 permission escalation is rejected', () => {
  const result = mutate('graphic.print_shop', (p) => p.items.find((item) => item.kind === 'permission' && item.value.role === 'atendente').value.grants.push('finance.manage'))
  assert.ok(codes(result).includes('PACK_PERMISSION_ESCALATION'))
  const config = mutate('graphic.print_shop', (p) => p.items.push({ kind: 'permission', id: 'role.gerente', requirement: 'recommended', value: { role: 'gerente', grants: ['team.manage'] } }))
  assert.ok(codes(config).includes('PACK_PERMISSION_ESCALATION'))
  const unknown = mutate('graphic.print_shop', (p) => p.items.find((item) => item.kind === 'permission').value.grants.push('root.all'))
  assert.ok(codes(unknown).includes('PACK_PERMISSION_UNKNOWN'))
  const role = mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'permission').value.role = 'dono'))
  assert.ok(codes(role).includes('PACK_ITEM_VALUE_INVALID'))
})

test('I12 dependencies must exist and be acyclic', () => {
  const missing = mutate('graphic.print_shop', (p) => (p.items[0].requires = [{ type: 'item', kind: 'module', id: 'ghost' }]))
  assert.ok(codes(missing).includes('PACK_DEPENDENCY_INVALID'))
  const cycle = mutate('graphic.print_shop', (p) => {
    p.items[0].requires = [{ type: 'item', kind: 'module', id: p.items[1].id }]
    p.items[1].requires = [{ type: 'item', kind: 'module', id: p.items[0].id }]
  })
  assert.ok(codes(cycle).includes('PACK_DEPENDENCY_INVALID'))
  const feature = mutate('graphic.print_shop', (p) => (p.items[0].requires = [{ type: 'feature', feature: 'teleporte' }]))
  assert.ok(codes(feature).includes('PACK_FEATURE_UNKNOWN'))
})

test('I13 deprecation metadata must be coherent', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items[0].deprecatedSince = '9.0.0'))).includes('PACK_DEPRECATION_INVALID'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items[0].replacedBy = 'ghost'))).includes('PACK_DEPRECATION_INVALID'))
})

test('I14 published packs must be complete', () => {
  assert.ok(codes(mutate('food.restaurant', (p) => (p.items = p.items.filter((item) => item.kind !== 'onboarding')))).includes('PACK_INCOMPLETE'))
  const draft = mutate('food.restaurant', (p) => {
    p.status = 'draft'
    p.items = p.items.filter((item) => item.kind !== 'onboarding')
  })
  assert.equal(draft.ok, true)
})

test('I15 size limits', () => {
  const result = mutate('food.restaurant', (p) => {
    for (let index = 0; index < 400; index += 1) {
      p.items.push({ kind: 'category', id: `product.extra_${index}`, requirement: 'optional', value: { scope: 'product', label: `Extra ${index}` } })
    }
  })
  assert.ok(codes(result).includes('PACK_TOO_LARGE'))
})

test('I16 remote references are rejected anywhere', () => {
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.description = 'Veja https://evil.example'))).includes('PACK_REMOTE_REFERENCE'))
  assert.ok(codes(mutate('graphic.print_shop', (p) => (p.items.find((item) => item.kind === 'category').value.label = 'javascript:alert(1)'))).includes('PACK_REMOTE_REFERENCE'))
})

test('validatePack never throws on invalid input', () => {
  const junk = [null, undefined, 1, 'x', [], {}, { items: 'x' }, { items: [null, 1, 'x', {}] }, { items: [{ kind: 'module', value: null }] }]
  for (const value of junk) {
    const result = validatePack(value, registry)
    assert.equal(result.ok, false)
  }
  assert.deepEqual(codes(validatePack(null, registry)), ['PACK_NOT_OBJECT'])
  const cyclic = clone(byKey('food.restaurant'))
  cyclic.items[0].value.self = cyclic
  assert.ok(codes(validatePack(cyclic, registry)).includes('PACK_NOT_SERIALIZABLE'))
})

// ---- resolvePack ------------------------------------------------------------------------------------

test('resolvePack selects versions and builds derived views', () => {
  const v2 = { ...clone(byKey('food.restaurant')), version: '1.1.0' }
  v2.changelog = [{ version: '1.1.0', date: '2026-10-01', kind: 'minor', summary: 'x', changes: [] }, ...v2.changelog]
  const draft = { ...clone(byKey('food.restaurant')), version: '2.0.0', status: 'draft' }
  draft.changelog = [{ version: '2.0.0', date: '2026-10-02', kind: 'major', summary: 'x', changes: [] }, ...v2.changelog]
  const catalog = [byKey('food.restaurant'), v2, draft]

  const latest = resolvePack(catalog, 'food.restaurant')
  assert.equal(latest.ok && latest.value.ref, 'food.restaurant@1.1.0')
  const pinned = resolvePack(catalog, 'food.restaurant@1.0.0')
  assert.equal(pinned.ok && pinned.value.ref, 'food.restaurant@1.0.0')
  assert.deepEqual(codes(resolvePack(catalog, 'food.restaurant@2.0.0')), ['PACK_STATUS_NOT_ALLOWED'])
  assert.equal(resolvePack(catalog, 'food.restaurant@2.0.0', { allowStatuses: ['draft'] }).ok, true)
  assert.deepEqual(codes(resolvePack(catalog, 'food.nope')), ['PACK_NOT_FOUND'])
  assert.deepEqual(codes(resolvePack(catalog, 'food.restaurant@x')), ['PACK_REF_INVALID'])
  assert.deepEqual(codes(resolvePack([...catalog, byKey('food.restaurant')], 'food.restaurant')), ['PACK_CATALOG_DUPLICATE'])

  const view = latest.value
  const total = view.required.length + view.defaults.length + view.recommended.length + view.optional.length
  assert.equal(total, view.definition.items.length)
  assert.equal(view.modules.length + view.statuses.length + view.categories.length + view.dashboards.length + view.reports.length + view.recipes.length + view.integrations.length + view.permissions.length + view.templates.length + view.onboarding.length + view.settings.length, total)
})

// ---- classification ---------------------------------------------------------------------------------

const PACK = { key: 'graphic.print_shop', version: '1.0.0' }

test('classifyPackItem covers all eight diff states', () => {
  const settingItem = { kind: 'setting', id: 'proposals.defaultValidityHours', requirement: 'default', value: { path: 'proposals.defaultValidityHours', value: 48 } }
  const states = {
    SAFE_ADDITION: classifyPackItem(settingItem, emptyCompany(), registry, PACK),
    SAME_VALUE: classifyPackItem(settingItem, emptyCompany({ settings: { 'proposals.defaultValidityHours': 48 } }), registry, PACK),
    CONFLICT: classifyPackItem(settingItem, emptyCompany({ settings: { 'proposals.defaultValidityHours': 24 } }), registry, PACK),
    USER_OVERRIDE: classifyPackItem(
      settingItem,
      emptyCompany({ settings: { 'proposals.defaultValidityHours': 24 }, userOverrides: [{ kind: 'setting', id: 'proposals.defaultValidityHours' }] }),
      registry,
      PACK,
    ),
    UNAVAILABLE: classifyPackItem({ kind: 'module', id: 'estoque_simples', requirement: 'optional', value: { moduleId: 'estoque_simples' } }, emptyCompany(), registry, PACK),
    ENTITLEMENT_BLOCKED: classifyPackItem(
      { kind: 'module', id: 'propostas', requirement: 'default', value: { moduleId: 'propostas' }, requires: [{ type: 'feature', feature: 'propostas' }] },
      emptyCompany({ plan: 'basic', entitledFeatures: ['site', 'pedidos', 'produtos', 'whatsapp'] }),
      registry,
      PACK,
    ),
    INTEGRATION_UNAVAILABLE: classifyPackItem({ kind: 'integration', id: 'google_drive', requirement: 'optional', value: { provider: 'google_drive', capabilities: ['files.read'] } }, emptyCompany(), registry, PACK),
    DEPRECATED_SETTING: classifyPackItem(
      { ...settingItem, deprecatedSince: '1.0.0' },
      emptyCompany({ settings: { 'proposals.defaultValidityHours': 48 } }),
      registry,
      PACK,
    ),
  }
  for (const [expected, result] of Object.entries(states)) assert.equal(result.state, expected, expected)
  assert.equal(states.ENTITLEMENT_BLOCKED.requiredPlan, 'premium')
  assert.equal(states.INTEGRATION_UNAVAILABLE.requiredIntegration, 'google_drive')
})

test('classification precedence: deprecated > unavailable > entitlement > integration', () => {
  const item = {
    kind: 'module',
    id: 'estoque_simples',
    requirement: 'optional',
    value: { moduleId: 'estoque_simples' },
    deprecatedSince: '1.0.0',
    requires: [{ type: 'feature', feature: 'automacoes' }, { type: 'integration', provider: 'bling' }],
  }
  const company = emptyCompany({ enabledModules: ['estoque_simples'], entitledFeatures: [] })
  assert.equal(classifyPackItem(item, company, registry, PACK).state, 'DEPRECATED_SETTING')
  assert.equal(classifyPackItem({ ...item, deprecatedSince: undefined }, company, registry, PACK).state, 'UNAVAILABLE')
  const available = { ...item, deprecatedSince: undefined, value: { moduleId: 'catalogo' }, id: 'catalogo' }
  assert.equal(classifyPackItem(available, company, registry, PACK).state, 'ENTITLEMENT_BLOCKED')
  assert.equal(classifyPackItem(available, emptyCompany({ entitledFeatures: ['automacoes'] }), registry, PACK).state, 'INTEGRATION_UNAVAILABLE')
})

test('ReportItem without a report registry is always UNAVAILABLE (never fabricated)', () => {
  assert.deepEqual(registry.reportKeys, [])
  const report = { kind: 'report', id: 'sales.summary', requirement: 'optional', value: { reportKey: 'sales.summary' } }
  const pack = mutateAndGet('graphic.print_shop', (p) => p.items.push(report))
  assert.equal(validatePack(pack, registry).ok, true)
  const result = classifyPackItem(report, emptyCompany({ enabledReports: ['sales.summary'] }), registry, PACK)
  assert.equal(result.state, 'UNAVAILABLE')
  assert.equal(result.reason.code, 'REPORT_REGISTRY_MISSING')
  assert.equal(classifyPackItem({ ...report, requirement: 'required' }, emptyCompany(), registry, PACK).blocking, true)
})

function mutateAndGet(key, fn) {
  const pack = clone(byKey(key))
  fn(pack)
  return pack
}

test('recipes are UNAVAILABLE while no recipe runtime exists in the platform', () => {
  const view = buildResolvedView(byKey('graphic.print_shop'))
  for (const item of view.recipes) assert.equal(classifyPackItem(item, emptyCompany(), registry, PACK).state, 'UNAVAILABLE')
})

// ---- diff + proposal ---------------------------------------------------------------------------------

function realisticCompany() {
  return emptyCompany({
    plan: 'basic',
    entitledFeatures: ['site', 'pedidos', 'produtos', 'whatsapp'],
    enabledModules: ['pedidos_orcamentos', 'orcamentos'],
    statuses: {
      order: [
        { key: 'recebido', label: 'Recebido', inUseCount: 4 },
        { key: 'em_producao', label: 'Produzindo', inUseCount: 2 },
        { key: 'arquivado_legado', label: 'Arquivado legado', inUseCount: 3 },
        { key: 'rascunho', label: 'Rascunho', inUseCount: 0 },
      ],
    },
    categories: [{ scope: 'product', label: 'banners', inUseCount: 5 }, { scope: 'product', label: 'Camisetas', inUseCount: 1 }],
    settings: { 'proposals.defaultValidityHours': 24 },
    userOverrides: [{ kind: 'setting', id: 'proposals.defaultValidityHours' }],
  })
}

test('diffPackAgainstCompany is deterministic and fingerprints are stable', () => {
  const view = buildResolvedView(byKey('graphic.print_shop'))
  const first = diffPackAgainstCompany(view, realisticCompany(), registry, { hash })
  const second = diffPackAgainstCompany(view, realisticCompany(), registry, { hash })
  assert.deepEqual(first, second)
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/)
  const changed = diffPackAgainstCompany(view, { ...realisticCompany(), enabledModules: ['pedidos_orcamentos'] }, registry, { hash })
  assert.notEqual(changed.fingerprint, first.fingerprint)
  const shuffled = { ...byKey('graphic.print_shop'), items: [...byKey('graphic.print_shop').items].reverse() }
  assert.deepEqual(diffPackAgainstCompany(buildResolvedView(shuffled), realisticCompany(), registry, { hash }).items, first.items)
  const total = Object.values(first.summary).reduce((sum, value) => sum + value, 0)
  assert.equal(total, first.items.length)
})

test('diff detects conflicts, overrides, entitlement blocks and in-use removals', () => {
  const view = buildResolvedView(byKey('graphic.print_shop'))
  const diff = diffPackAgainstCompany(view, realisticCompany(), registry, { hash })
  const find = (kind, id) => diff.items.find((item) => item.kind === kind && item.id === id)
  assert.equal(find('module', 'pedidos_orcamentos').state, 'SAME_VALUE')
  assert.equal(find('module', 'produtos_graficos').state, 'SAFE_ADDITION')
  assert.equal(find('module', 'propostas').state, 'ENTITLEMENT_BLOCKED')
  assert.equal(find('module', 'aprovacao_arte').state, 'UNAVAILABLE')
  assert.equal(find('status', 'order.em_producao').state, 'CONFLICT')
  assert.equal(find('status', 'order.em_producao').blocking, true)
  assert.equal(find('category', 'product.banners').state, 'SAME_VALUE')
  assert.equal(find('setting', 'proposals.defaultValidityHours').state, 'USER_OVERRIDE')
  assert.equal(find('integration', 'google_drive').state, 'INTEGRATION_UNAVAILABLE')
  const legacyRemoval = diff.removals.find((removal) => removal.id === 'arquivado_legado')
  assert.equal(legacyRemoval.replacesFlow, true)
  assert.equal(legacyRemoval.inUseCount, 3)
  assert.ok(diff.removals.some((removal) => removal.kind === 'category' && removal.id === 'Camisetas' && removal.replacesFlow === false))
  assert.ok(diff.blockingCount >= 2)
})

test('buildPackProposal never applies and never overrides the tenant by default', () => {
  const view = buildResolvedView(byKey('graphic.print_shop'))
  const diff = diffPackAgainstCompany(view, realisticCompany(), registry, { hash })
  const proposal = buildPackProposal(diff, { includeRecommended: true })
  assert.equal(proposal.notApplied, true)
  assert.equal(proposal.applyStatus, 'MIGRATION_REQUIRED_BLOCKED_BY_M0')
  assert.equal(proposal.diffFingerprint, diff.fingerprint)
  assert.equal(proposal.applicable, false)
  const decision = (kind, id) => proposal.decisions.find((entry) => entry.kind === kind && entry.id === id)
  assert.equal(decision('setting', 'proposals.defaultValidityHours').defaultDecision, 'KEEP_CURRENT')
  assert.equal(decision('status', 'order.em_producao').defaultDecision, 'REQUIRES_MAPPING')
  assert.equal(decision('status', 'arquivado_legado').defaultDecision, 'REQUIRES_MAPPING')
  assert.equal(decision('status', 'rascunho').defaultDecision, 'KEEP_CURRENT')
  assert.equal(decision('category', 'Camisetas').defaultDecision, 'KEEP_CURRENT')
  assert.equal(decision('module', 'produtos_graficos').defaultDecision, 'ADD')
  assert.equal(decision('module', 'produtos_graficos').userSelectable, false)
  for (const entry of proposal.decisions.filter((item) => item.kind === 'recipe' || item.kind === 'integration')) {
    assert.notEqual(entry.defaultDecision, 'ADD', entry.id)
  }
  for (const entry of proposal.decisions.filter((item) => item.state === 'USER_OVERRIDE' || item.state === 'CONFLICT')) {
    assert.notEqual(entry.defaultDecision, 'ADD')
  }
  assert.deepEqual(buildPackProposal(diff, { includeRecommended: true }), proposal)
})

test('a fresh premium company gets an applicable proposal for every Wave 1 pack', () => {
  for (const pack of industryPackCatalog) {
    const diff = diffPackAgainstCompany(buildResolvedView(pack), emptyCompany({ businessType: pack.businessType }), registry, { hash })
    const proposal = buildPackProposal(diff)
    assert.equal(proposal.applicable, true, `${pack.key}: ${JSON.stringify(proposal.blocking)}`)
    assert.equal(diff.summary.CONFLICT, 0)
  }
})

// ---- registry snapshot ------------------------------------------------------------------------------

test('role mirror matches permissionsByRole in lib/company-access.ts (parity)', () => {
  // company-access.ts imports Supabase and next/server, so it cannot be loaded outside Next.
  // Parity is checked by evaluating the flag expressions declared in its source.
  const source = readFileSync(new URL('../../lib/company-access.ts', import.meta.url), 'utf8')
  const start = source.indexOf('export function permissionsByRole')
  const body = source.slice(start, source.indexOf('\n}\n', start))
  const expressions = Object.fromEntries([...body.matchAll(/^\s+(can\w+): ([^,\n]+),$/gm)].map((match) => [match[1], match[2]]))
  const flags = ['canManage', 'canFinance', 'canConfig', 'canProducts', 'canProposal', 'canSubscription', 'canProduction']
  assert.deepEqual(Object.keys(expressions).sort(), [...flags].sort())
  for (const role of ['gerente', 'atendente', 'producao']) {
    const scope = { isAdminMaster: false, isOwner: false, isManager: role === 'gerente', isAttendant: role === 'atendente', isProduction: role === 'producao' }
    const mirror = roleCapabilityFlags(role)
    for (const flag of flags) {
      const expected = new Function(...Object.keys(scope), `return (${expressions[flag]})`)(...Object.values(scope))
      assert.equal(mirror[flag], expected, `${role}.${flag}`)
    }
    const derived = ALL_COMPANY_PERMISSIONS.filter((permission) => companyPermissionAllowed(mirror, permission))
    assert.deepEqual(registry.rolePermissions[role], derived)
  }
})

test('ALL_COMPANY_PERMISSIONS matches the CompanyPermission union in access-control-core.ts', () => {
  const source = readFileSync(new URL('../../lib/access-control-core.ts', import.meta.url), 'utf8')
  const union = source.slice(source.indexOf('export type CompanyPermission'), source.indexOf('export type CompanyPermissionContext'))
  const declared = [...union.matchAll(/'([a-z.]+)'/g)].map((match) => match[1]).sort()
  assert.deepEqual([...ALL_COMPANY_PERMISSIONS].sort(), declared)
})

test('registry snapshot is derived deterministically from static modules', () => {
  assert.deepEqual(buildRegistrySnapshot({ recipes: registry.recipes }), registry)
  assert.deepEqual(registry.businessTypes, [...allSegments])
  assert.ok(registry.modules.length > 50)
  assert.equal(registry.featureRequiredPlan.automacoes, 'premium')
})

// ---- branch coverage: header validation, manifest ------------------------------------------------------

test('header, minimum requirements and legacy metadata are validated', () => {
  const cases = [
    [(p) => (p.schemaVersion = 2), 'PACK_SCHEMA_VERSION'],
    [(p) => (p.key = 42), 'PACK_KEY_INVALID'],
    [(p) => (p.status = 'live'), 'PACK_STATUS_INVALID'],
    [(p) => (p.name = ''), 'PACK_FIELD_INVALID'],
    [(p) => (p.description = 'x'.repeat(281)), 'PACK_FIELD_INVALID'],
    [(p) => (p.subsegments = 'x'), 'PACK_FIELD_INVALID'],
    [(p) => (p.subsegments = ['a', 'a']), 'PACK_FIELD_INVALID'],
    [(p) => (p.capabilities = 'x'), 'PACK_FIELD_INVALID'],
    [(p) => (p.capabilities = ['cap.quotes', 'cap.quotes']), 'PACK_FIELD_INVALID'],
    [(p) => (p.minimumRequirements = null), 'PACK_FIELD_INVALID'],
    [(p) => (p.minimumRequirements.plan = 'gold'), 'PACK_FIELD_INVALID'],
    [(p) => (p.minimumRequirements.features = 'x'), 'PACK_FIELD_INVALID'],
    [(p) => (p.minimumRequirements.features = ['teleporte']), 'PACK_FEATURE_UNKNOWN'],
    [(p) => (p.minimumRequirements.modules = 'x'), 'PACK_FIELD_INVALID'],
    [(p) => (p.minimumRequirements.modules = ['ghost']), 'PACK_MODULE_UNKNOWN'],
    [(p) => (p.legacy = 'x'), 'PACK_FIELD_INVALID'],
    [(p) => (p.legacy = { nichoIds: ['padaria'] }), 'PACK_LEGACY_UNKNOWN'],
    [(p) => (p.changelog[0] = { version: '1.0.0', date: 'ontem', kind: 'mega', summary: '', changes: 'x' }), 'PACK_VERSION_INVALID'],
    [(p) => (p.changelog[0] = null), 'PACK_VERSION_INVALID'],
    [(p) => (p.items = 'x'), 'PACK_FIELD_INVALID'],
  ]
  for (const [fn, code] of cases) assert.ok(codes(mutate('graphic.print_shop', fn)).includes(code), code)
})

test('item shapes are validated for every kind', () => {
  const item = (kind, value, extra = {}) => (p) => p.items.push({ kind, id: `x.${kind}`, requirement: 'optional', value, ...extra })
  const cases = [
    [item('module', { moduleId: 'catalogo', order: 1.5 }), 'PACK_ITEM_VALUE_INVALID'],
    [item('status', { scope: 'invoice', key: 'x', label: 'x', order: 0, terminal: 'yes', semantic: 'done' }), 'PACK_ITEM_VALUE_INVALID'],
    [item('category', { scope: 'stock', label: '', parentId: 1 }), 'PACK_ITEM_VALUE_INVALID'],
    [item('dashboard', { cardId: '', metricKey: 'pedidosTotal', order: 'x' }), 'PACK_ITEM_VALUE_INVALID'],
    [item('report', { reportKey: 'X' }), 'PACK_ITEM_VALUE_INVALID'],
    [item('recipe', { recipeRef: 'lead_followup_task@1.0.0', params: [] }), 'PACK_ITEM_VALUE_INVALID'],
    [item('integration', { provider: 'X', capabilities: [] }), 'PACK_ITEM_VALUE_INVALID'],
    [item('permission', { role: 'gerente', grants: [] }), 'PACK_ITEM_VALUE_INVALID'],
    [item('template', { templateKind: 'sms', key: '', content: null }), 'PACK_ITEM_VALUE_INVALID'],
    [item('template', { templateKind: 'ready_message', key: 'k', content: { format: 'plain', text: '' } }), 'PACK_ITEM_VALUE_INVALID'],
    [item('template', { templateKind: 'proposal', key: 'k', content: { format: 'proposal', titulo: '', introducao: 'a', condicoes: 'b', prazoPadrao: 'c', validadeHoras: 0 } }), 'PACK_ITEM_VALUE_INVALID'],
    [item('onboarding', { stepKey: '', order: 'x', checklistLabel: '', completionSignal: '' }), 'PACK_ITEM_VALUE_INVALID'],
    [item('teleport', {}), 'PACK_ITEM_KIND_INVALID'],
    [item('module', null), 'PACK_ITEM_VALUE_INVALID'],
    [(p) => p.items.push({ kind: 'module', id: 'Bad Id!', requirement: 'mandatory', value: { moduleId: 'catalogo' } }), 'PACK_ITEM_ID_INVALID'],
    [(p) => p.items.push({ kind: 'module', id: 'catalogo', requirement: 'mandatory', value: { moduleId: 'catalogo' } }), 'PACK_ITEM_REQUIREMENT_INVALID'],
    [(p) => p.items.push(null), 'PACK_ITEM_VALUE_INVALID'],
    [(p) => (p.items[0].requires = 'x'), 'PACK_DEPENDENCY_INVALID'],
    [(p) => (p.items[0].requires = [null, { type: 'magic' }, { type: 'integration', provider: 'X' }]), 'PACK_DEPENDENCY_INVALID'],
    [(p) => (p.items[0].requires = [{ type: 'permission', permission: 'root' }]), 'PACK_PERMISSION_UNKNOWN'],
    [(p) => (p.items[0].requires = [{ type: 'module', moduleId: 'ghost' }]), 'PACK_MODULE_UNKNOWN'],
    [(p) => (p.items[0].since = '9.9.9'), 'PACK_DEPRECATION_INVALID'],
  ]
  for (const [fn, code] of cases) assert.ok(codes(mutate('graphic.print_shop', fn)).includes(code), code)
  const replaced = mutate('graphic.print_shop', (p) => {
    p.items.push({ kind: 'module', id: 'catalogo', requirement: 'optional', value: { moduleId: 'catalogo' } })
    p.items[0].deprecatedSince = '1.0.0'
    p.items[0].replacedBy = 'catalogo'
  })
  assert.equal(replaced.ok, true, JSON.stringify(replaced.ok ? [] : replaced.errors))
})

test('classification covers presence of every item kind', () => {
  const view = buildResolvedView(byKey('graphic.print_shop'))
  const everything = emptyCompany({
    enabledModules: view.modules.map((item) => item.value.moduleId),
    statuses: { order: view.statuses.sort((a, b) => a.value.order - b.value.order).map((item) => ({ key: item.value.key, label: item.value.label, inUseCount: 1 })) },
    categories: view.categories.map((item) => ({ scope: 'product', label: item.value.label.toUpperCase(), inUseCount: 0 })),
    dashboardCards: view.dashboards.map((item) => item.value.cardId),
    activeRecipes: ['proposal_followup_task@0.9.0'],
    integrations: [{ provider: 'google_drive', status: 'CONNECTED', capabilities: ['files.read'] }],
    rolePermissionProfiles: { atendente: ['orders.read', 'orders.update', 'proposals.manage'], producao: ['orders.read'] },
    templates: view.templates.map((item) => ({ templateKind: item.value.templateKind, key: item.value.key, content: item.value.content })),
    onboardingSteps: view.onboarding.map((item) => item.value.stepKey),
    settings: Object.fromEntries(view.settings.map((item) => [item.value.path, item.value.value])),
    platform: { availableIntegrations: ['google_drive'], availableRecipes: view.recipes.map((item) => item.value.recipeRef) },
  })
  const diff = diffPackAgainstCompany(view, everything, registry, { hash })
  const find = (kind, id) => diff.items.find((item) => item.kind === kind && item.id === id).state
  assert.equal(find('permission', 'role.atendente'), 'SAME_VALUE')
  assert.equal(find('permission', 'role.producao'), 'CONFLICT')
  assert.equal(find('integration', 'google_drive'), 'CONFLICT')
  assert.equal(find('recipe', 'proposal_followup_task'), 'CONFLICT')
  assert.equal(find('recipe', 'order_delayed_internal_task'), 'SAFE_ADDITION')
  assert.equal(find('template', 'proposal.default'), 'SAME_VALUE')
  assert.equal(find('onboarding', 'step.add_products'), 'SAME_VALUE')
  assert.equal(find('dashboard', 'card.prontos'), 'SAME_VALUE')
  assert.equal(find('category', 'product.banners'), 'SAME_VALUE')
  assert.equal(find('status', 'order.recebido'), 'SAME_VALUE')
  assert.equal(find('module', 'aprovacao_arte'), 'UNAVAILABLE')
  const report = { kind: 'report', id: 'r', requirement: 'optional', value: { reportKey: 'sales.summary' } }
  const withReports = { ...registry, reportKeys: ['sales.summary'] }
  assert.equal(classifyPackItem(report, emptyCompany({ enabledReports: ['sales.summary'] }), withReports, PACK).state, 'SAME_VALUE')
  assert.equal(classifyPackItem(report, emptyCompany(), withReports, PACK).state, 'SAFE_ADDITION')
  const requiresModule = { kind: 'setting', id: 'delivery.enabled', requirement: 'default', value: { path: 'delivery.enabled', value: true }, requires: [{ type: 'module', moduleId: 'estoque_simples' }] }
  assert.equal(classifyPackItem(requiresModule, emptyCompany(), registry, PACK).reason.code, 'REQUIRED_MODULE_NOT_AVAILABLE')
  const needsConnection = { ...requiresModule, requires: [{ type: 'integration', provider: 'google_drive' }] }
  const inPlatform = emptyCompany({ platform: { availableIntegrations: ['google_drive'], availableRecipes: [] } })
  assert.equal(classifyPackItem(needsConnection, inPlatform, registry, PACK).reason.code, 'INTEGRATION_NOT_CONNECTED')
  const proposal = buildPackProposal(diff)
  assert.equal(proposal.decisions.find((entry) => entry.kind === 'recipe' && entry.id === 'order_delayed_internal_task').defaultDecision, 'SKIP')
  const deprecated = buildPackProposal({ ...diff, items: [{ ...diff.items[0], state: 'DEPRECATED_SETTING', replacedBy: 'x' }, { ...diff.items[1], state: 'DEPRECATED_SETTING' }], removals: [] })
  assert.deepEqual(deprecated.decisions.map((entry) => entry.defaultDecision), ['SUGGEST_REPLACEMENT', 'KEEP_CURRENT'])
})

test('industry pack manifest is deterministic and all Wave 1 packs are valid', async () => {
  const { buildIndustryPackManifest } = await import('../../lib/wave1/manifest.ts')
  const manifest = buildIndustryPackManifest()
  assert.deepEqual(buildIndustryPackManifest(), manifest)
  assert.equal(manifest.applyStatus, 'MIGRATION_REQUIRED_BLOCKED_BY_M0')
  assert.deepEqual(manifest.packs.map((pack) => pack.ref), industryPackCatalog.map((pack) => `${pack.key}@${pack.version}`))
  assert.ok(manifest.packs.every((pack) => pack.valid && pack.status === 'published'))
})
