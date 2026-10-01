/**
 * Orçaly Next — Product Registry (isolated prototype).
 *
 * NOT CONNECTED TO THE RUNTIME. The live source of truth remains lib/ecosystem/products.ts.
 * This module is the proposed successor: pure data + pure functions, no I/O, no React.
 * scripts/test-orcaly-next-registry.mjs enforces parity with the live registry
 * (ids, colors, entitlement keys, release status) so the two cannot drift silently.
 *
 * Rules carried from the project bible:
 *  - Entitlement != consent. Nothing here authorizes data access.
 *  - Provider absent = NOT_CONFIGURED. External dependency missing = BLOCKED_EXTERNAL.
 *  - One is a commercial bundle, never an operational app.
 *  - No invented prices, customers, integrations or dates.
 */

import type { HubStatus, ReleaseStatus } from './product-status'
import { APP_DESTINATION_STATUSES } from './product-status'

export const REGISTRY_PRODUCT_IDS = ['business', 'wealth', 'growth', 'flow', 'academy', 'market', 'partners', 'one'] as const
export type RegistryProductId = (typeof REGISTRY_PRODUCT_IDS)[number]

export const SCOPES = ['personal', 'company', 'household'] as const
export type Scope = (typeof SCOPES)[number]

export const ENTITLEMENT_SOURCES = [
  'individual_subscription', 'one_bundle', 'trial', 'promotion', 'partner_grant', 'admin_grant', 'legacy', 'add_on',
] as const
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number]

export const SKIN_KEYS = ['business', 'wealth', 'growth', 'flow', 'academy', 'market', 'partners', 'one'] as const
export type SkinKey = (typeof SKIN_KEYS)[number]

/** LIVE = page.tsx exists today. NOT_BUILT = reserved path, must not be linked unless status is COMING_SOON. */
export type RouteStatus = 'LIVE' | 'NOT_BUILT'
export type RouteRef = { path: string; status: RouteStatus }

export type DependencyStatus = 'CONFIGURED' | 'NOT_CONFIGURED' | 'BLOCKED_EXTERNAL' | 'FROZEN' | 'NOT_VERIFIED'
export type ExternalDependency = { id: string; label: string; required: boolean; status: DependencyStatus }

export type NavItem = { id: string; label: string; href: string; keywords?: readonly string[] }
export type NavGroup = { id: string; label: string; items: readonly NavItem[] }

export type ProductNavigation =
  /** Registry owns the navigation. */
  | { source: 'registry'; groups: readonly NavGroup[] }
  /** Navigation lives in legacy code (Business: lib/panel-modules.ts). Registry only lists entry points. */
  | { source: 'legacy-adapter'; legacyModule: string; highlights: readonly NavItem[] }
  | { source: 'none' }

export type AiMode = 'education' | 'analysis' | 'simulation' | 'planning' | 'regulated_advice' | 'execution'
export type AiContext = {
  /** Provider status is never assumed healthy. */
  provider: 'NOT_CONFIGURED' | 'LEGACY_ASSISTANT'
  /** Modes allowed to be switched on by product policy. regulated_advice / execution are OFF by default everywhere. */
  enabledModes: readonly AiMode[]
  /** Data domains the product's assistant may read — always inside the product and scope, never cross-product without consent. */
  dataDomains: readonly string[]
  crossProductContext: 'DENY_BY_DEFAULT'
}

export type Billing = {
  /** LEGACY = existing plans outside this registry. NOT_CONFIGURED = no price published. */
  status: 'LEGACY' | 'NOT_CONFIGURED'
  billingProductKey: string | null
  trial: 'NOT_CONFIGURED'
}

export type OneInclusion = 'IS_BUNDLE' | 'UNDECIDED'

export type ProductRegistryEntry = {
  id: RegistryProductId
  slug: RegistryProductId
  kind: 'app' | 'bundle'
  name: string
  shortName: string
  description: string
  logo: { src: string | null; assetStatus: 'AVAILABLE' | 'ASSET_MISSING' }
  skin: SkinKey
  release: ReleaseStatus
  landing: RouteRef
  app: RouteRef | null
  /** Target path in the neutral /apps/<product> IA (docs/product/ORCALY_ROUTING_INFORMATION_ARCHITECTURE.md). */
  canonicalAppPath: string | null
  navigation: ProductNavigation
  scopes: readonly Scope[]
  householdSharing: 'NONE' | 'EXPLICIT_CONSENT_ONLY'
  entitlement: { key: string; permissionPrefix: string; sources: readonly EntitlementSource[] }
  billing: Billing
  oneInclusion: OneInclusion
  pwa: { installable: false; reason: string; scope: string | null; themeColor: string }
  ai: AiContext
  notifications: { namespace: string; supported: false }
  featureFlags: readonly string[]
  externalDependencies: readonly ExternalDependency[]
}

const ALL_SOURCES = ENTITLEMENT_SOURCES
const NO_AI: AiContext = { provider: 'NOT_CONFIGURED', enabledModes: [], dataDomains: [], crossProductContext: 'DENY_BY_DEFAULT' }
const PWA_PENDING = 'Ícones próprios, escopo e roteamento ainda não verificados para instalação independente.'

function landing(slug: RegistryProductId): RouteRef {
  return { path: `/produtos/${slug}`, status: 'LIVE' }
}

export const productRegistry: readonly ProductRegistryEntry[] = [
  {
    id: 'business', slug: 'business', kind: 'app', name: 'Orçaly Business', shortName: 'Business',
    description: 'Operação da empresa: clientes, propostas, pedidos, entregas e financeiro.',
    logo: { src: null, assetStatus: 'ASSET_MISSING' },
    skin: 'business', release: 'LIVE',
    landing: { path: '/business', status: 'LIVE' },
    app: { path: '/painel/inicio', status: 'LIVE' }, canonicalAppPath: '/apps/business',
    navigation: {
      source: 'legacy-adapter', legacyModule: 'lib/panel-modules.ts',
      highlights: [
        { id: 'business.inicio', label: 'Início', href: '/painel/inicio', keywords: ['hoje', 'visão geral'] },
        { id: 'business.pedidos', label: 'Pedidos', href: '/painel/pedidos', keywords: ['vendas', 'ordens'] },
        { id: 'business.clientes', label: 'Clientes', href: '/painel/clientes', keywords: ['crm', 'contatos'] },
        { id: 'business.financeiro', label: 'Financeiro', href: '/painel/financeiro', keywords: ['caixa', 'contas'] },
        { id: 'business.catalogo', label: 'Catálogo', href: '/painel/catalogo', keywords: ['produtos', 'serviços'] },
        { id: 'business.entregas', label: 'Entregas', href: '/painel/entregas', keywords: ['logística'] },
        { id: 'business.relatorios', label: 'Relatórios', href: '/painel/relatorios', keywords: ['indicadores'] },
        { id: 'business.assistente', label: 'Assistente', href: '/painel/assistente', keywords: ['ia'] },
      ],
    },
    scopes: ['company'], householdSharing: 'NONE',
    entitlement: { key: 'product.business', permissionPrefix: 'business.', sources: ALL_SOURCES },
    billing: { status: 'LEGACY', billingProductKey: 'business', trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: '/painel/', themeColor: '#164bc4' },
    ai: { provider: 'LEGACY_ASSISTANT', enabledModes: ['analysis'], dataDomains: ['orders', 'customers', 'finance'], crossProductContext: 'DENY_BY_DEFAULT' },
    notifications: { namespace: 'orcaly.business', supported: false },
    featureFlags: [],
    externalDependencies: [
      { id: 'payments-gateway', label: 'Gateway de pagamentos', required: false, status: 'NOT_VERIFIED' },
      { id: 'whatsapp', label: 'WhatsApp', required: false, status: 'FROZEN' },
      { id: 'nfse', label: 'NFS-e', required: false, status: 'NOT_CONFIGURED' },
    ],
  },
  {
    id: 'wealth', slug: 'wealth', kind: 'app', name: 'Orçaly Wealth', shortName: 'Wealth',
    description: 'Clareza patrimonial com dados declarados, sem saldo duplicado.',
    logo: { src: '/brand/wealth/endorsed.png', assetStatus: 'AVAILABLE' },
    skin: 'wealth', release: 'EARLY_ACCESS',
    landing: landing('wealth'),
    app: { path: '/apps/wealth', status: 'LIVE' }, canonicalAppPath: '/apps/wealth',
    navigation: {
      source: 'registry',
      groups: [
        { id: 'hoje', label: 'Hoje', items: [
          { id: 'wealth.overview', label: 'Visão geral', href: '/apps/wealth', keywords: ['início', 'resumo'] },
          { id: 'wealth.briefing', label: 'Briefing', href: '/apps/wealth/briefing', keywords: ['manhã', 'noite', 'morning', 'night'] },
        ] },
        { id: 'dinheiro', label: 'Dinheiro', items: [
          { id: 'wealth.lancamentos', label: 'Lançamentos', href: '/apps/wealth/lancamentos', keywords: ['receitas', 'despesas', 'histórico', 'exportar'] },
          { id: 'wealth.recorrencias', label: 'Recorrências', href: '/apps/wealth/recorrencias', keywords: ['contas fixas', 'agendamentos'] },
          { id: 'wealth.calendario', label: 'Calendário', href: '/apps/wealth/calendario', keywords: ['contas', 'vencimentos'] },
          { id: 'wealth.dividas', label: 'Dívidas', href: '/apps/wealth/dividas', keywords: ['quitação', 'empréstimo'] },
        ] },
        { id: 'patrimonio', label: 'Patrimônio', items: [
          { id: 'wealth.patrimonio', label: 'Patrimônio líquido', href: '/apps/wealth/patrimonio', keywords: ['net worth', 'ativos', 'passivos'] },
          { id: 'wealth.carteiras', label: 'Carteiras', href: '/apps/wealth/carteiras', keywords: ['investimentos', 'portfolio'] },
          { id: 'wealth.tarifas', label: 'Tarifas', href: '/apps/wealth/tarifas', keywords: ['custos', 'taxas'] },
        ] },
        { id: 'futuro', label: 'Futuro', items: [
          { id: 'wealth.metas', label: 'Metas', href: '/apps/wealth/metas', keywords: ['objetivos'] },
          { id: 'wealth.planejamento', label: 'Planejamento', href: '/apps/wealth/planejamento', keywords: ['planos de vida', 'simulação'] },
          { id: 'wealth.saude', label: 'Saúde financeira', href: '/apps/wealth/saude', keywords: ['indicadores'] },
        ] },
        { id: 'protecao', label: 'Proteção', items: [
          { id: 'wealth.shield', label: 'Shield', href: '/apps/wealth/shield', keywords: ['seguros', 'proteção'] },
          { id: 'wealth.documentos', label: 'Documentos', href: '/apps/wealth/documentos', keywords: ['cofre', 'arquivos'] },
          { id: 'wealth.impostos', label: 'Impostos', href: '/apps/wealth/impostos', keywords: ['fiscal', 'ir'] },
        ] },
        { id: 'conexoes', label: 'Conexões', items: [
          { id: 'wealth.familia', label: 'Família', href: '/apps/wealth/familia', keywords: ['compartilhar', 'consentimento'] },
          { id: 'wealth.automacoes', label: 'Automações', href: '/apps/wealth/automacoes', keywords: ['agendas'] },
          { id: 'wealth.timeline', label: 'Timeline', href: '/apps/wealth/timeline', keywords: ['atividades'] },
        ] },
      ],
    },
    scopes: ['personal'], householdSharing: 'EXPLICIT_CONSENT_ONLY',
    entitlement: { key: 'product.wealth', permissionPrefix: 'wealth.', sources: ALL_SOURCES },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: '/apps/wealth/', themeColor: '#146447' },
    ai: { provider: 'NOT_CONFIGURED', enabledModes: ['education', 'analysis', 'simulation', 'planning'], dataDomains: ['wealth_entries', 'wealth_goals', 'portfolio', 'debt', 'documents_metadata'], crossProductContext: 'DENY_BY_DEFAULT' },
    notifications: { namespace: 'orcaly.wealth', supported: false },
    featureFlags: ['ecosystem.wealth'],
    externalDependencies: [
      { id: 'market-data', label: 'Cotações de mercado', required: false, status: 'NOT_CONFIGURED' },
      { id: 'open-finance', label: 'Open Finance', required: false, status: 'BLOCKED_EXTERNAL' },
      { id: 'tax-rules', label: 'Regras fiscais', required: false, status: 'NOT_CONFIGURED' },
    ],
  },
  {
    id: 'growth', slug: 'growth', kind: 'app', name: 'Orçaly Growth', shortName: 'Growth',
    description: 'Experimentos de aquisição e decisões guiadas pelos seus resultados.',
    logo: { src: '/brand/growth/endorsed.png', assetStatus: 'AVAILABLE' },
    skin: 'growth', release: 'IN_DEVELOPMENT',
    landing: landing('growth'), app: { path: '/apps/growth', status: 'NOT_BUILT' }, canonicalAppPath: '/apps/growth',
    navigation: { source: 'none' },
    scopes: ['company'], householdSharing: 'NONE',
    entitlement: { key: 'product.growth', permissionPrefix: 'growth.', sources: ALL_SOURCES },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: null, themeColor: '#a44322' },
    ai: NO_AI, notifications: { namespace: 'orcaly.growth', supported: false },
    featureFlags: ['ecosystem.growth'],
    externalDependencies: [{ id: 'ads-analytics', label: 'Fontes de mídia e analytics', required: true, status: 'NOT_CONFIGURED' }],
  },
  {
    id: 'flow', slug: 'flow', kind: 'app', name: 'Orçaly Flow', shortName: 'Flow',
    description: 'Automações visuais e em linguagem natural, com permissões e aprovação.',
    logo: { src: null, assetStatus: 'ASSET_MISSING' },
    skin: 'flow', release: 'IN_DEVELOPMENT',
    landing: landing('flow'), app: { path: '/apps/flow', status: 'NOT_BUILT' }, canonicalAppPath: '/apps/flow',
    navigation: { source: 'none' },
    scopes: ['company'], householdSharing: 'NONE',
    entitlement: { key: 'product.flow', permissionPrefix: 'flow.', sources: ALL_SOURCES },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: null, themeColor: '#6245b0' },
    ai: NO_AI, notifications: { namespace: 'orcaly.flow', supported: false },
    featureFlags: ['ecosystem.flow'], externalDependencies: [],
  },
  {
    id: 'academy', slug: 'academy', kind: 'app', name: 'Orçaly Academy', shortName: 'Academy',
    description: 'Biblioteca, trilhas e aprendizado no seu ritmo.',
    logo: { src: '/brand/academy/endorsed.png', assetStatus: 'AVAILABLE' },
    skin: 'academy', release: 'IN_DEVELOPMENT',
    landing: landing('academy'), app: { path: '/apps/academy', status: 'NOT_BUILT' }, canonicalAppPath: '/apps/academy',
    navigation: { source: 'none' },
    scopes: ['personal'], householdSharing: 'NONE',
    entitlement: { key: 'product.academy', permissionPrefix: 'academy.', sources: ALL_SOURCES },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: null, themeColor: '#865914' },
    ai: NO_AI, notifications: { namespace: 'orcaly.academy', supported: false },
    featureFlags: ['ecosystem.academy'],
    externalDependencies: [{ id: 'content-licensing', label: 'Licenciamento de conteúdo', required: true, status: 'NOT_CONFIGURED' }],
  },
  {
    id: 'market', slug: 'market', kind: 'app', name: 'Orçaly Market', shortName: 'Market',
    description: 'Do problema à solução: ferramentas, serviços e especialistas.',
    logo: { src: null, assetStatus: 'ASSET_MISSING' },
    skin: 'market', release: 'IN_DEVELOPMENT',
    landing: landing('market'), app: { path: '/apps/market', status: 'NOT_BUILT' }, canonicalAppPath: '/apps/market',
    navigation: { source: 'none' },
    scopes: ['personal'], householdSharing: 'NONE',
    entitlement: { key: 'product.market', permissionPrefix: 'market.', sources: ALL_SOURCES },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: null, themeColor: '#176572' },
    ai: NO_AI, notifications: { namespace: 'orcaly.market', supported: false },
    featureFlags: ['ecosystem.market'], externalDependencies: [],
  },
  {
    id: 'partners', slug: 'partners', kind: 'app', name: 'Orçaly Partners', shortName: 'Partners',
    description: 'Indicações, oportunidades e acompanhamento de comissões.',
    logo: { src: null, assetStatus: 'ASSET_MISSING' },
    skin: 'partners', release: 'LIVE',
    landing: { path: '/parceiros', status: 'LIVE' },
    app: { path: '/parceiros/painel', status: 'LIVE' }, canonicalAppPath: '/apps/partners',
    navigation: {
      source: 'registry',
      groups: [{ id: 'rede', label: 'Rede', items: [
        { id: 'partners.painel', label: 'Portal', href: '/parceiros/painel', keywords: ['comissões', 'indicações'] },
        { id: 'partners.pipeline', label: 'Pipeline', href: '/parceiros/pipeline', keywords: ['oportunidades', 'leads'] },
        { id: 'partners.notificacoes', label: 'Notificações', href: '/parceiros/notificacoes' },
        { id: 'partners.demo', label: 'Demonstrações', href: '/parceiros/demo', keywords: ['demo'] },
      ] }],
    },
    scopes: ['personal'], householdSharing: 'NONE',
    entitlement: { key: 'product.partners', permissionPrefix: 'partners.', sources: ['partner_grant', 'admin_grant', 'legacy'] },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'UNDECIDED',
    pwa: { installable: false, reason: PWA_PENDING, scope: '/parceiros/', themeColor: '#364996' },
    ai: { provider: 'LEGACY_ASSISTANT', enabledModes: ['education'], dataDomains: ['referrals', 'commissions'], crossProductContext: 'DENY_BY_DEFAULT' },
    notifications: { namespace: 'orcaly.partners', supported: false },
    featureFlags: [], externalDependencies: [],
  },
  {
    id: 'one', slug: 'one', kind: 'bundle', name: 'Orçaly One', shortName: 'One',
    description: 'Proposta de acesso integrado aos produtos Orçaly. Não é um aplicativo.',
    logo: { src: null, assetStatus: 'ASSET_MISSING' },
    skin: 'one', release: 'IN_DEVELOPMENT',
    landing: landing('one'), app: null, canonicalAppPath: null,
    navigation: { source: 'none' },
    scopes: [], householdSharing: 'NONE',
    entitlement: { key: 'product.one', permissionPrefix: 'one.', sources: ['individual_subscription', 'promotion', 'admin_grant'] },
    billing: { status: 'NOT_CONFIGURED', billingProductKey: null, trial: 'NOT_CONFIGURED' },
    oneInclusion: 'IS_BUNDLE',
    pwa: { installable: false, reason: 'Bundle comercial não é instalável.', scope: null, themeColor: '#24394c' },
    ai: NO_AI, notifications: { namespace: 'orcaly.one', supported: false },
    featureFlags: ['ecosystem.one'], externalDependencies: [],
  },
]

export function getRegistryProduct(id: string): ProductRegistryEntry | undefined {
  return productRegistry.find((product) => product.id === id)
}

/** Products that can appear in a launcher as apps. One is excluded by construction. */
export function operationalProducts(registry: readonly ProductRegistryEntry[] = productRegistry): ProductRegistryEntry[] {
  return registry.filter((product) => product.kind === 'app')
}

export function navItems(product: ProductRegistryEntry): NavItem[] {
  if (product.navigation.source === 'registry') return product.navigation.groups.flatMap((group) => [...group.items])
  if (product.navigation.source === 'legacy-adapter') return [...product.navigation.highlights]
  return []
}

export type Destination = { href: string; kind: 'app' | 'landing'; reason: string }

/**
 * Where a Hub/Launcher/Palette entry leads.
 * ACTIVE / TRIAL → app (only if the app route is LIVE). Everything else → public landing.
 * An app entitlement never bypasses a NOT_BUILT route.
 */
export function resolveProductDestination(product: ProductRegistryEntry, status: HubStatus): Destination {
  if (APP_DESTINATION_STATUSES.includes(status) && product.app?.status === 'LIVE') {
    return { href: product.app.path, kind: 'app', reason: 'entitled' }
  }
  if (status === 'BLOCKED_EXTERNAL' && product.app?.status === 'LIVE') {
    return { href: product.app.path, kind: 'app', reason: 'app-explains-external-block' }
  }
  return { href: product.landing.path, kind: 'landing', reason: APP_DESTINATION_STATUSES.includes(status) ? 'app-not-built' : 'not-entitled' }
}

export type RegistryIssue = { productId: string; field: string; message: string }

/** Structural validation used by tests and by any future runtime adoption. Does not touch the filesystem. */
export function validateRegistry(registry: readonly ProductRegistryEntry[]): RegistryIssue[] {
  const issues: RegistryIssue[] = []
  const seenIds = new Set<string>()
  const seenSlugs = new Set<string>()
  const seenNav = new Set<string>()
  for (const product of registry) {
    const push = (field: string, message: string) => issues.push({ productId: product.id, field, message })
    if (seenIds.has(product.id)) push('id', 'duplicated id')
    if (seenSlugs.has(product.slug)) push('slug', 'duplicated slug')
    seenIds.add(product.id); seenSlugs.add(product.slug)
    if (!/^[a-z][a-z0-9-]*$/.test(product.slug)) push('slug', 'slug must be kebab-case')
    for (const field of ['name', 'shortName', 'description'] as const) if (!product[field].trim()) push(field, 'required')
    if (!product.name.startsWith('Orçaly ')) push('name', 'name must carry the master brand')
    if (!isInternalPath(product.landing.path)) push('landing', 'invalid path')
    if (product.landing.status !== 'LIVE') push('landing', 'landing must be LIVE')
    if (product.kind === 'bundle') {
      if (product.app !== null) push('app', 'bundle must not have an app route')
      if (product.navigation.source !== 'none') push('navigation', 'bundle must not have navigation')
      if (product.scopes.length) push('scopes', 'bundle holds no data scope')
      if (product.oneInclusion !== 'IS_BUNDLE') push('oneInclusion', 'bundle must be IS_BUNDLE')
    } else {
      if (!product.app) push('app', 'app product needs an app route')
      else if (!isInternalPath(product.app.path)) push('app', 'invalid path')
      if (product.app?.status === 'NOT_BUILT' && product.release !== 'IN_DEVELOPMENT') push('app', 'NOT_BUILT route requires IN_DEVELOPMENT (COMING_SOON)')
      if (!product.scopes.length) push('scopes', 'app needs at least one scope')
      if (product.oneInclusion === 'IS_BUNDLE') push('oneInclusion', 'only the bundle is IS_BUNDLE')
    }
    for (const scope of product.scopes) if (!(SCOPES as readonly string[]).includes(scope)) push('scopes', `invalid scope ${scope}`)
    if (product.householdSharing === 'EXPLICIT_CONSENT_ONLY' && !product.scopes.includes('personal')) push('householdSharing', 'household sharing starts from a personal scope')
    if (product.entitlement.key !== `product.${product.id}`) push('entitlement', 'key must be product.<id>')
    if (product.entitlement.permissionPrefix !== `${product.id}.`) push('entitlement', 'permission prefix must be <id>.')
    for (const source of product.entitlement.sources) if (!(ENTITLEMENT_SOURCES as readonly string[]).includes(source)) push('entitlement', `invalid source ${source}`)
    if (product.entitlement.sources.includes('one_bundle') && product.kind === 'bundle') push('entitlement', 'bundle cannot be granted by itself')
    if (product.ai.crossProductContext !== 'DENY_BY_DEFAULT') push('ai', 'cross-product context must deny by default')
    if (product.ai.enabledModes.includes('regulated_advice') || product.ai.enabledModes.includes('execution')) push('ai', 'regulated_advice/execution are OFF by default')
    if (product.ai.provider === 'NOT_CONFIGURED' && product.ai.dataDomains.length && product.release === 'IN_DEVELOPMENT') push('ai', 'unreleased product must not declare data domains')
    if (product.notifications.namespace !== `orcaly.${product.id}`) push('notifications', 'namespace must be orcaly.<id>')
    if (!/^#[0-9a-f]{6}$/.test(product.pwa.themeColor)) push('pwa', 'themeColor must be lowercase #rrggbb')
    if (product.logo.assetStatus === 'AVAILABLE' && !product.logo.src) push('logo', 'AVAILABLE logo needs src')
    for (const item of navItems(product)) {
      if (seenNav.has(item.id)) push('navigation', `duplicated nav id ${item.id}`)
      seenNav.add(item.id)
      if (!isInternalPath(item.href)) push('navigation', `invalid href ${item.href}`)
      if (!item.id.startsWith(`${product.id}.`)) push('navigation', `nav id ${item.id} must be namespaced`)
    }
    if (product.release === 'IN_DEVELOPMENT' && navItems(product).length) push('navigation', 'unreleased product must not expose navigation')
  }
  return issues
}

export function isInternalPath(path: string): boolean {
  return /^\/[a-z0-9\-/[\]#?=&.]*$/i.test(path) && !path.startsWith('//') && !path.includes('..')
}
