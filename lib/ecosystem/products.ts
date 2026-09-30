/** Public product/experience truth. Commercial access is evaluated separately on the server. */
export const productIds = ['business', 'wealth', 'growth', 'flow', 'academy', 'market', 'partners', 'one'] as const
export type ProductId = typeof productIds[number]
export type ProductStatus = 'available' | 'preview' | 'planned'
export type ProductContext = 'company' | 'personal' | 'partner' | 'bundle'

export type ProductDefinition = {
  id: ProductId
  slug: ProductId
  name: string
  shortName: string
  description: string
  benefit: string
  intent: string
  context: ProductContext
  status: ProductStatus
  href: string
  startUrl: string
  scope: string
  domain: string | null
  subdomain: string | null
  brand: {
    primary: string | null
    secondary: string
    symbol: string | null
    favicon: string | null
    assetStatus: 'AVAILABLE' | 'ASSET_MISSING'
  }
  experience: {
    primary: string
    secondary: string
    surface: string
    text: string
    font: string
    motionMs: number
    themeColor: string
    backgroundColor: string
  }
  navigation: ReadonlyArray<{ label: string; href: string }>
  permissions: readonly string[]
  capabilities: readonly string[]
  featureFlag: string | null
  entitlement: string
  notifications: { supported: boolean }
  installability: { enabled: boolean; reason: string; icons: readonly string[] }
}

type ProductInput = Pick<ProductDefinition, 'id' | 'shortName' | 'description' | 'benefit' | 'intent' | 'context' | 'status' | 'startUrl' | 'capabilities'> & {
  color: string
  surface: string
  primary?: string
  navigation?: ProductDefinition['navigation']
}

function defineProduct(input: ProductInput): ProductDefinition {
  return {
    id: input.id, slug: input.id, name: `Orçaly ${input.shortName}`, shortName: input.shortName,
    description: input.description, benefit: input.benefit, intent: input.intent,
    context: input.context, status: input.status, href: `/produtos/${input.id}`,
    startUrl: input.startUrl, scope: input.id === 'business' ? '/painel/' : input.id === 'partners' ? '/parceiros/' : input.startUrl,
    domain: null, subdomain: null,
    brand: { primary: input.primary ?? null, secondary: `/brand/${input.id}/endorsed.png`, symbol: null, favicon: null, assetStatus: input.primary ? 'AVAILABLE' : 'ASSET_MISSING' },
    experience: { primary: input.color, secondary: '#087f8c', surface: input.surface, text: '#12223d', font: 'Arial, Helvetica, sans-serif', motionMs: 220, themeColor: input.color, backgroundColor: input.surface },
    navigation: input.navigation ?? [], permissions: [`${input.id}.read`], capabilities: input.capabilities,
    featureFlag: input.status === 'available' ? null : `ecosystem.${input.id}`,
    entitlement: `product.${input.id}`, notifications: { supported: false },
    installability: { enabled: false, reason: 'Ícones próprios e instalação deste produto ainda em preparação.', icons: [] },
  }
}

export const products: readonly ProductDefinition[] = [
  defineProduct({ id: 'business', shortName: 'Business', context: 'company', status: 'available', startUrl: '/painel/inicio', color: '#164bc4', surface: '#edf3ff', intent: 'Quero gerenciar meu negócio', description: 'Seu negócio em movimento. Do primeiro contato à entrega.', benefit: 'Clientes, propostas, pedidos e finanças em uma operação conectada.', capabilities: ['customers', 'orders', 'finance', 'production'], navigation: [{ label: 'Visão geral', href: '/painel/inicio' }, { label: 'Clientes', href: '/painel/clientes' }, { label: 'Planos', href: '/business#planos' }] }),
  defineProduct({ id: 'wealth', shortName: 'Wealth', context: 'personal', status: 'preview', startUrl: '/apps/wealth', color: '#146447', surface: '#eaf5ed', primary: '/brand/wealth/endorsed.png', intent: 'Quero organizar meu patrimônio', description: 'Mais clareza para as escolhas que constroem seu futuro.', benefit: 'Sua vida financeira, suas metas e seu patrimônio no mesmo horizonte.', capabilities: ['education', 'analysis', 'simulation', 'planning'] }),
  defineProduct({ id: 'growth', shortName: 'Growth', context: 'company', status: 'planned', startUrl: '/apps/growth', color: '#a44322', surface: '#fff1e9', primary: '/brand/growth/endorsed.png', intent: 'Quero conseguir mais clientes', description: 'Entenda o que faz seu negócio crescer.', benefit: 'Aquisição, experimentos e decisões guiadas pelos seus resultados.', capabilities: [] }),
  defineProduct({ id: 'flow', shortName: 'Flow', context: 'company', status: 'planned', startUrl: '/apps/flow', color: '#6245b0', surface: '#f1edfc', intent: 'Quero automatizar meu trabalho', description: 'Menos tarefas repetidas. Mais espaço para criar.', benefit: 'Automações e agentes com permissões, histórico e aprovação.', capabilities: [] }),
  defineProduct({ id: 'academy', shortName: 'Academy', context: 'personal', status: 'planned', startUrl: '/apps/academy', color: '#865914', surface: '#fff7e5', primary: '/brand/academy/endorsed.png', intent: 'Quero aprender e evoluir', description: 'Conhecimento que acompanha a sua curiosidade.', benefit: 'Livros, jornadas de leitura e aprendizado no seu ritmo.', capabilities: [] }),
  defineProduct({ id: 'market', shortName: 'Market', context: 'personal', status: 'planned', startUrl: '/apps/market', color: '#176572', surface: '#eaf7f8', intent: 'Quero encontrar soluções', description: 'Encontre a próxima possibilidade.', benefit: 'Descubra ferramentas, serviços e especialistas para seguir adiante.', capabilities: [] }),
  defineProduct({ id: 'partners', shortName: 'Partners', context: 'partner', status: 'available', startUrl: '/parceiros/painel', color: '#364996', surface: '#eef0fa', intent: 'Quero participar da rede', description: 'Crescer é melhor quando a gente cresce junto.', benefit: 'Indicações, oportunidades e acompanhamento das suas comissões.', capabilities: ['referrals', 'commissions'], navigation: [{ label: 'Portal de parceiros', href: '/parceiros/painel' }] }),
  defineProduct({ id: 'one', shortName: 'One', context: 'bundle', status: 'planned', startUrl: '/apps/one', color: '#24394c', surface: '#edf2f5', intent: 'Quero tudo integrado', description: 'Todas as suas possibilidades, mais próximas.', benefit: 'A proposta premium de acesso integrado aos produtos Orçaly.', capabilities: [] }),
]

export function isProductId(value: unknown): value is ProductId {
  return typeof value === 'string' && productIds.some((id) => id === value)
}

export function getProduct(id: string): ProductDefinition | undefined {
  return products.find((product) => product.id === id)
}

export const productStatusLabels: Record<ProductStatus, string> = {
  available: 'Disponível', preview: 'Acesso antecipado', planned: 'Em desenvolvimento',
}

export const ecosystemJourneys = [
  { title: 'Tenho uma empresa', description: 'Organize a operação, encontre oportunidades e ganhe tempo.', products: ['business', 'growth', 'flow'] },
  { title: 'Quero cuidar do meu futuro', description: 'Conecte suas escolhas financeiras a novos conhecimentos.', products: ['wealth', 'academy'] },
  { title: 'Quero descobrir mais', description: 'Aprenda, encontre soluções e amplie suas possibilidades.', products: ['academy', 'market'] },
] as const
