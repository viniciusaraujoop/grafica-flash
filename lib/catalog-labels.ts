export type CatalogBusinessType =
  | 'food'
  | 'graphic'
  | 'custom_products'
  | 'beauty'
  | 'barber'
  | 'technical_assistance'
  | 'auto'
  | 'store'
  | 'events'
  | 'services'

export type CatalogLabels = {
  catalogTitle: string
  itemLabel: string
  actionLabel: string
  emptyTitle: string
  emptyText: string
  featuredTitle: string
  featuredText: string
  categories: string[]
}

export function normalizeCatalogBusinessType(value: unknown): CatalogBusinessType {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const aliases: Record<string, CatalogBusinessType> = {
    food: 'food',
    alimenticio: 'food',
    restaurante: 'food',
    lanchonete: 'food',
    delivery: 'food',

    graphic: 'graphic',
    grafica: 'graphic',
    graficas: 'graphic',

    custom_products: 'custom_products',
    personalizados: 'custom_products',
    produtos_personalizados: 'custom_products',

    beauty: 'beauty',
    estetica: 'beauty',
    beleza: 'beauty',
    beleza_estetica: 'beauty',

    barber: 'barber',
    barbearia: 'barber',

    technical_assistance: 'technical_assistance',
    assistencia: 'technical_assistance',
    assistencia_tecnica: 'technical_assistance',

    auto: 'auto',
    automotivo: 'auto',
    oficina: 'auto',

    store: 'store',
    loja: 'store',
    comercio: 'store',
    moda_varejo: 'store',

    events: 'events',
    eventos: 'events',

    services: 'services',
    servicos: 'services',
    servicos_gerais: 'services',
    outros: 'services',
  }

  return aliases[raw] || 'services'
}

const labelsByType: Record<CatalogBusinessType, CatalogLabels> = {
  food: {
    catalogTitle: 'Cardápio',
    itemLabel: 'Item',
    actionLabel: 'Adicionar ao carrinho',
    emptyTitle: 'Cadastre seu primeiro item do cardápio.',
    emptyText: 'Seu cardápio ainda está sendo preparado. Entre em contato pelo WhatsApp para saber mais.',
    featuredTitle: 'Destaques do cardápio',
    featuredText: 'Itens selecionados para facilitar o pedido de quem chegou agora.',
    categories: ['Lanches', 'Pizzas', 'Bebidas', 'Combos', 'Sobremesas'],
  },
  graphic: {
    catalogTitle: 'Produtos gráficos',
    itemLabel: 'Produto/serviço gráfico',
    actionLabel: 'Solicitar orçamento',
    emptyTitle: 'Cadastre seu primeiro produto gráfico ou serviço de orçamento.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para solicitar um orçamento.',
    featuredTitle: 'Destaques da gráfica',
    featuredText: 'Produtos e serviços que merecem aparecer primeiro na vitrine.',
    categories: ['Impressos', 'Adesivos', 'Banners', 'Personalizados', 'Comunicação visual'],
  },
  custom_products: {
    catalogTitle: 'Produtos personalizados',
    itemLabel: 'Produto personalizado',
    actionLabel: 'Solicitar orçamento',
    emptyTitle: 'Cadastre seu primeiro produto personalizado.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para conversar sobre sua ideia.',
    featuredTitle: 'Personalizados em destaque',
    featuredText: 'Opções que ajudam o cliente a entender o que pode pedir.',
    categories: ['Personalizados', 'Presentes', 'Kits', 'Sob consulta', 'Mais pedidos'],
  },
  beauty: {
    catalogTitle: 'Serviços',
    itemLabel: 'Serviço',
    actionLabel: 'Agendar atendimento',
    emptyTitle: 'Cadastre seu primeiro serviço.',
    emptyText: 'Este catálogo ainda está sendo preparado. Entre em contato pelo WhatsApp para agendar.',
    featuredTitle: 'Serviços em destaque',
    featuredText: 'Atendimentos e pacotes para deixar a escolha mais simples.',
    categories: ['Facial', 'Sobrancelhas', 'Cabelo', 'Pacotes', 'Promoções'],
  },
  barber: {
    catalogTitle: 'Serviços',
    itemLabel: 'Serviço',
    actionLabel: 'Agendar atendimento',
    emptyTitle: 'Cadastre seu primeiro serviço.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para agendar.',
    featuredTitle: 'Serviços em destaque',
    featuredText: 'Cortes, barba e combos que merecem aparecer primeiro.',
    categories: ['Corte', 'Barba', 'Combos', 'Pacotes', 'Promoções'],
  },
  technical_assistance: {
    catalogTitle: 'Serviços técnicos',
    itemLabel: 'Serviço técnico',
    actionLabel: 'Solicitar análise',
    emptyTitle: 'Cadastre seu primeiro serviço técnico.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para solicitar uma análise.',
    featuredTitle: 'Serviços técnicos em destaque',
    featuredText: 'Serviços que ajudam o cliente a saber por onde começar.',
    categories: ['Celulares', 'Computadores', 'Eletrônicos', 'Manutenção', 'Diagnóstico'],
  },
  auto: {
    catalogTitle: 'Serviços automotivos',
    itemLabel: 'Serviço',
    actionLabel: 'Solicitar orçamento',
    emptyTitle: 'Cadastre seu primeiro serviço automotivo.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para solicitar orçamento.',
    featuredTitle: 'Serviços automotivos em destaque',
    featuredText: 'Serviços que ajudam o cliente a escolher mais rápido.',
    categories: ['Revisão', 'Peças', 'Diagnóstico', 'Manutenção', 'Garantia'],
  },
  store: {
    catalogTitle: 'Produtos',
    itemLabel: 'Produto',
    actionLabel: 'Comprar pelo WhatsApp',
    emptyTitle: 'Cadastre seu primeiro produto.',
    emptyText: 'Este catálogo ainda está sendo preparado. Entre em contato pelo WhatsApp para saber mais.',
    featuredTitle: 'Produtos em destaque',
    featuredText: 'Produtos selecionados para vender melhor na vitrine.',
    categories: ['Produtos', 'Promoções', 'Novidades', 'Mais vendidos'],
  },
  events: {
    catalogTitle: 'Pacotes e serviços',
    itemLabel: 'Pacote',
    actionLabel: 'Solicitar proposta',
    emptyTitle: 'Cadastre seu primeiro pacote ou serviço.',
    emptyText: 'Este catálogo ainda está sendo preparado. Chame no WhatsApp para conversar sobre seu evento.',
    featuredTitle: 'Pacotes em destaque',
    featuredText: 'Opções que facilitam a escolha para o próximo evento.',
    categories: ['Pacotes', 'Eventos', 'Decoração', 'Checklist', 'Sob consulta'],
  },
  services: {
    catalogTitle: 'Serviços',
    itemLabel: 'Serviço',
    actionLabel: 'Pedir proposta',
    emptyTitle: 'Seu catálogo ainda está vazio.',
    emptyText: 'Cadastre produtos ou serviços para que seus clientes possam ver, pedir ou solicitar orçamento pelo seu site.',
    featuredTitle: 'Destaques',
    featuredText: 'Produtos e serviços que ajudam o cliente a tomar decisão mais rápido.',
    categories: ['Serviços', 'Orçamentos', 'Pacotes', 'Consultas'],
  },
}

export function getCatalogLabels(value: unknown) {
  return labelsByType[normalizeCatalogBusinessType(value)]
}

export function getFallbackCatalogCategories(value: unknown) {
  return getCatalogLabels(value).categories
}
