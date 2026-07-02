export type BusinessType =
  | 'services'
  | 'graphic'
  | 'food'
  | 'beauty'
  | 'barber'
  | 'technical_assistance'
  | 'auto'
  | 'store'
  | 'events'
  | 'custom_products'

export type BusinessMenuItem = {
  title: string
  description: string
  href: string
  badge?: string
  prepared?: boolean
}

export type BusinessTypeConfig = {
  id: BusinessType
  label: string
  publicName: string
  orderLabel: string
  productLabel: string
  siteTitle: string
  siteSubtitle: string
  cta: string
  statuses: string[]
  features: string[]
  defaultCategories: string[]
  defaultFaq: Array<{ pergunta: string; resposta: string }>
  defaultBenefits: Array<{ titulo: string; texto: string }>
  defaultSiteSections: string[]
}

const aliases: Record<string, BusinessType> = {
  servicos: 'services',
  servicos_gerais: 'services',
  services: 'services',
  service: 'services',
  grafica: 'graphic',
  gráfica: 'graphic',
  graphic: 'graphic',
  personalizados: 'custom_products',
  custom: 'custom_products',
  custom_products: 'custom_products',
  alimenticio: 'food',
  alimentício: 'food',
  food: 'food',
  restaurante: 'food',
  lanchonete: 'food',
  estetica: 'beauty',
  estética: 'beauty',
  beauty: 'beauty',
  barbearia: 'barber',
  barber: 'barber',
  assistencia: 'technical_assistance',
  assistência: 'technical_assistance',
  technical_assistance: 'technical_assistance',
  oficina: 'auto',
  auto: 'auto',
  loja: 'store',
  store: 'store',
  eventos: 'events',
  events: 'events',
}

const defaultFaq = [
  {
    pergunta: 'Como faço um pedido?',
    resposta: 'Escolha o produto ou serviço, envie seus dados e a empresa continuará o atendimento pelo WhatsApp.',
  },
  {
    pergunta: 'Posso combinar detalhes antes de fechar?',
    resposta: 'Sim. O Orçaly organiza o pedido inicial e a empresa confirma valores, prazos e detalhes finais.',
  },
]

const defaultBenefits = [
  { titulo: 'Atendimento organizado', texto: 'A empresa recebe as informações principais em um único lugar.' },
  { titulo: 'Pedido mais claro', texto: 'Cliente, produto, observações e contato ficam registrados.' },
  { titulo: 'Contato rápido', texto: 'O WhatsApp continua sendo o canal principal para concluir o atendimento.' },
]

export const businessTypes: BusinessTypeConfig[] = [
  {
    id: 'services',
    label: 'Serviços gerais',
    publicName: 'Orçaly Serviços',
    orderLabel: 'Pedido',
    productLabel: 'Serviço',
    siteTitle: 'Receba pedidos e orçamentos de forma organizada.',
    siteSubtitle: 'Ideal para empresas de serviços que precisam captar clientes, organizar solicitações e vender com mais clareza.',
    cta: 'Solicitar atendimento',
    statuses: ['Recebido', 'Em análise', 'Proposta enviada', 'Aprovado', 'Em execução', 'Concluído', 'Cancelado'],
    features: ['orcamento', 'whatsapp', 'clientes', 'propostas'],
    defaultCategories: ['Serviços', 'Pacotes', 'Atendimento'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'catalogo', 'beneficios', 'sobre', 'faq', 'contato'],
  },
  {
    id: 'graphic',
    label: 'Gráfica e personalizados',
    publicName: 'Orçaly Gráfica',
    orderLabel: 'Orçamento',
    productLabel: 'Produto',
    siteTitle: 'Receba artes, medidas e quantidades de forma organizada.',
    siteSubtitle: 'Para gráficas, comunicação visual e personalizados que precisam transformar pedidos bagunçados em orçamentos claros.',
    cta: 'Pedir orçamento',
    statuses: ['Recebido', 'Aguardando arte', 'Em análise', 'Proposta enviada', 'Aprovado', 'Em produção', 'Pronto', 'Entregue'],
    features: ['upload_arte', 'medidas', 'producao', 'aprovacao_arte', 'whatsapp'],
    defaultCategories: ['Impressos', 'Comunicação visual', 'Personalizados', 'Adesivos'],
    defaultFaq: [
      { pergunta: 'Posso enviar minha arte?', resposta: 'Sim. Você pode enviar a arte ou combinar a criação com a equipe.' },
      { pergunta: 'O orçamento depende da medida?', resposta: 'Alguns produtos podem depender de largura, altura, quantidade e acabamento.' },
    ],
    defaultBenefits: [
      { titulo: 'Arte e pedido juntos', texto: 'O cliente envia informações e arquivos de forma mais organizada.' },
      { titulo: 'Produção acompanhada', texto: 'Status como análise, aprovação, produção e pronto ficam claros.' },
      { titulo: 'Menos retrabalho', texto: 'Medidas, quantidades e observações chegam melhor estruturadas.' },
    ],
    defaultSiteSections: ['hero', 'catalogo', 'upload', 'beneficios', 'faq', 'contato'],
  },
  {
    id: 'food',
    label: 'Alimentício',
    publicName: 'Orçaly Food',
    orderLabel: 'Pedido',
    productLabel: 'Item do cardápio',
    siteTitle: 'Cardápio digital e pedidos online para o seu negócio.',
    siteSubtitle: 'Monte um cardápio bonito, receba pedidos por WhatsApp e organize retirada ou entrega sem complicar a operação.',
    cta: 'Fazer pedido',
    statuses: ['Recebido', 'Em preparo', 'Pronto para retirada', 'Saiu para entrega', 'Entregue', 'Cancelado'],
    features: ['cardapio', 'carrinho', 'adicionais', 'entrega', 'pix'],
    defaultCategories: ['Lanches', 'Combos', 'Bebidas', 'Sobremesas'],
    defaultFaq: [
      { pergunta: 'Posso pedir para entrega?', resposta: 'Sim. A empresa informa as opções de entrega ou retirada disponíveis.' },
      { pergunta: 'Posso escolher adicionais?', resposta: 'Sim, quando o item tiver adicionais cadastrados.' },
      { pergunta: 'O pagamento é feito online?', resposta: 'Nesta versão, o pagamento é combinado com a empresa pelo WhatsApp.' },
    ],
    defaultBenefits: [
      { titulo: 'Cardápio organizado', texto: 'Itens, fotos, preços e descrições ficam claros para o cliente.' },
      { titulo: 'Pedido direto no WhatsApp', texto: 'O cliente monta o pedido e envia a mensagem pronta.' },
      { titulo: 'Entrega ou retirada', texto: 'O pedido já indica se o cliente quer receber ou retirar.' },
    ],
    defaultSiteSections: ['hero', 'cardapio', 'carrinho', 'entrega', 'faq', 'contato'],
  },
  {
    id: 'beauty',
    label: 'Estética e beleza',
    publicName: 'Orçaly Beauty',
    orderLabel: 'Agendamento',
    productLabel: 'Serviço',
    siteTitle: 'Mostre seus serviços e receba agendamentos com praticidade.',
    siteSubtitle: 'Para estúdios, clínicas e profissionais de beleza venderem confiança antes do primeiro contato.',
    cta: 'Agendar atendimento',
    statuses: ['Solicitado', 'Em análise', 'Agendado', 'Confirmado', 'Atendido', 'Cancelado'],
    features: ['servicos', 'agenda_manual', 'whatsapp', 'pacotes'],
    defaultCategories: ['Facial', 'Corporal', 'Pacotes', 'Avaliação'],
    defaultFaq: [
      { pergunta: 'Como funciona o agendamento?', resposta: 'O cliente escolhe o serviço e chama no WhatsApp para confirmar o melhor horário.' },
      { pergunta: 'Os valores são finais?', resposta: 'A empresa pode confirmar valores e indicações antes do atendimento.' },
    ],
    defaultBenefits: [
      { titulo: 'Serviços bem apresentados', texto: 'Procedimentos, pacotes e benefícios ficam fáceis de entender.' },
      { titulo: 'Atendimento consultivo', texto: 'O cliente tira dúvidas antes de agendar.' },
      { titulo: 'Mais confiança', texto: 'Depoimentos, galeria e FAQ ajudam na decisão.' },
    ],
    defaultSiteSections: ['hero', 'servicos', 'beneficios', 'galeria', 'faq', 'contato'],
  },
  {
    id: 'barber',
    label: 'Barbearia',
    publicName: 'Orçaly Barber',
    orderLabel: 'Agendamento',
    productLabel: 'Serviço',
    siteTitle: 'Cortes, barba e combos com agendamento simples.',
    siteSubtitle: 'Mostre serviços, combos, profissionais e leve o cliente direto para o WhatsApp.',
    cta: 'Agendar horário',
    statuses: ['Solicitado', 'Agendado', 'Confirmado', 'Atendido', 'Cancelado'],
    features: ['servicos', 'agenda_manual', 'combos', 'whatsapp'],
    defaultCategories: ['Cortes', 'Barba', 'Combos', 'Tratamentos'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'servicos', 'combos', 'galeria', 'faq', 'contato'],
  },
  {
    id: 'technical_assistance',
    label: 'Assistência técnica',
    publicName: 'Orçaly Assistência',
    orderLabel: 'Ordem de serviço',
    productLabel: 'Serviço',
    siteTitle: 'Receba diagnósticos e acompanhe reparos com mais clareza.',
    siteSubtitle: 'Para assistência técnica organizar equipamentos, defeitos, peças, prazos e atendimento.',
    cta: 'Solicitar diagnóstico',
    statuses: ['Recebido', 'Em diagnóstico', 'Aguardando aprovação', 'Em reparo', 'Pronto', 'Entregue', 'Cancelado'],
    features: ['diagnostico', 'ordem_servico', 'status', 'whatsapp'],
    defaultCategories: ['Celulares', 'Notebooks', 'Games', 'Manutenção'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'servicos', 'status', 'beneficios', 'faq', 'contato'],
  },
  {
    id: 'auto',
    label: 'Oficina/auto',
    publicName: 'Orçaly Auto',
    orderLabel: 'Orçamento',
    productLabel: 'Serviço',
    siteTitle: 'Serviços automotivos com orçamento claro e atendimento rápido.',
    siteSubtitle: 'Para oficinas receberem solicitações de revisão, peças, diagnóstico e manutenção.',
    cta: 'Solicitar orçamento',
    statuses: ['Recebido', 'Em análise', 'Aguardando peça', 'Aprovado', 'Em execução', 'Pronto', 'Entregue'],
    features: ['veiculo', 'pecas', 'orcamento', 'whatsapp'],
    defaultCategories: ['Revisão', 'Freios', 'Suspensão', 'Diagnóstico'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'servicos', 'beneficios', 'faq', 'contato'],
  },
  {
    id: 'store',
    label: 'Loja',
    publicName: 'Orçaly Loja',
    orderLabel: 'Pedido',
    productLabel: 'Produto',
    siteTitle: 'Produtos, ofertas e pedidos em uma vitrine profissional.',
    siteSubtitle: 'Para lojas locais venderem com catálogo, carrinho, cupons e atendimento rápido.',
    cta: 'Comprar agora',
    statuses: ['Recebido', 'Separando', 'Pronto para retirada', 'Saiu para entrega', 'Entregue', 'Cancelado'],
    features: ['catalogo', 'carrinho', 'cupons', 'whatsapp'],
    defaultCategories: ['Produtos', 'Ofertas', 'Kits', 'Novidades'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'catalogo', 'ofertas', 'faq', 'contato'],
  },
  {
    id: 'events',
    label: 'Eventos',
    publicName: 'Orçaly Eventos',
    orderLabel: 'Solicitação',
    productLabel: 'Pacote',
    siteTitle: 'Pacotes, datas e pedidos para eventos bem organizados.',
    siteSubtitle: 'Para buffets, decoração, fotografia, som, iluminação e serviços de eventos.',
    cta: 'Solicitar orçamento',
    statuses: ['Recebido', 'Verificando data', 'Proposta enviada', 'Aprovado', 'Em preparação', 'Concluído', 'Cancelado'],
    features: ['data_evento', 'pacotes', 'orcamento', 'whatsapp'],
    defaultCategories: ['Pacotes', 'Decoração', 'Buffet', 'Serviços'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'pacotes', 'galeria', 'faq', 'contato'],
  },
  {
    id: 'custom_products',
    label: 'Produtos personalizados',
    publicName: 'Orçaly Personalizados',
    orderLabel: 'Orçamento',
    productLabel: 'Produto',
    siteTitle: 'Personalizados, brindes e kits sob demanda.',
    siteSubtitle: 'Para camisetas, canecas, lembranças, brindes e produtos criativos com arte e variações.',
    cta: 'Personalizar',
    statuses: ['Recebido', 'Aguardando arte', 'Em análise', 'Aprovado', 'Em produção', 'Pronto', 'Entregue'],
    features: ['variacoes', 'arte', 'personalizacao', 'whatsapp'],
    defaultCategories: ['Camisetas', 'Canecas', 'Brindes', 'Kits'],
    defaultFaq,
    defaultBenefits,
    defaultSiteSections: ['hero', 'catalogo', 'personalizacao', 'beneficios', 'faq', 'contato'],
  },
]

export function normalizeBusinessType(type: unknown): BusinessType {
  const raw = String(type || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  return aliases[raw] || businessTypes.find((item) => item.id === raw)?.id || 'services'
}

export function getBusinessTypeConfig(type: unknown): BusinessTypeConfig {
  const normalized = normalizeBusinessType(type)
  return businessTypes.find((item) => item.id === normalized) || businessTypes[0]
}

export function getDefaultSetupForBusiness(type: unknown) {
  const config = getBusinessTypeConfig(type)

  return {
    business_type: config.id,
    site_template: config.id === 'services' ? 'servicos' : config.id,
    site_layout: config.id === 'food' ? 'food-menu' : config.id === 'graphic' ? 'budget-showcase' : 'premium',
    site_headline: config.siteTitle,
    site_subheadline: config.siteSubtitle,
    site_cta_text: config.cta,
    site_marketplace_title: config.id === 'food' ? 'Cardápio' : config.id === 'beauty' || config.id === 'barber' ? 'Serviços' : 'Catálogo',
    site_marketplace_subtitle: config.id === 'food'
      ? 'Escolha os itens, monte seu pedido e envie pelo WhatsApp.'
      : 'Escolha produtos ou serviços e envie tudo organizado para atendimento.',
    site_cart_button_text: config.id === 'food' ? 'Adicionar ao pedido' : 'Adicionar',
    site_checkout_button_text: config.id === 'food' ? 'Enviar pedido' : 'Finalizar pedido',
    site_empty_catalog_text: config.id === 'food'
      ? 'O cardápio ainda está sendo preparado.'
      : 'A empresa ainda está preparando o catálogo.',
    site_benefits: config.defaultBenefits,
    site_faq: config.defaultFaq,
    site_features: config.features.map((feature) => ({
      titulo: feature.split('_').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' '),
      texto: 'Recurso recomendado para este tipo de negócio.',
    })),
    site_payment_methods: config.id === 'food' ? ['Pix', 'Dinheiro', 'Cartão na entrega'] : ['Pix', 'Cartão', 'A combinar'],
    site_delivery_options: config.id === 'food' ? ['Retirada', 'Entrega'] : ['Retirada', 'Entrega', 'A combinar'],
    site_updated_at: new Date().toISOString(),
  }
}

export function getMenuByBusinessType(type: unknown): BusinessMenuItem[] {
  const config = getBusinessTypeConfig(type)

  const common: BusinessMenuItem[] = [
    { title: 'Dashboard', description: 'Resumo da operação.', href: '/painel' },
    { title: `${config.orderLabel}s`, description: 'Acompanhe solicitações, status e atendimento.', href: '/painel/pedidos' },
    { title: `${config.productLabel}s`, description: 'Cadastre itens, fotos, preços e disponibilidade.', href: '/painel/produtos' },
    { title: 'Clientes', description: 'Histórico, contatos e relacionamento.', href: '/painel/clientes' },
    { title: 'Site', description: 'Edite página pública, cores, textos e catálogo.', href: '/painel/site' },
    { title: 'Configurações', description: 'Empresa, recebimentos, equipe e preferências.', href: '/painel/configuracoes' },
    { title: 'Assinatura', description: 'Plano, renovação e pagamento.', href: '/assinatura' },
  ]

  if (config.id === 'food') {
    return [
      ...common,
      { title: 'Cardápio', description: 'Itens, categorias, adicionais e disponibilidade.', href: '/painel/produtos', badge: 'Food' },
      { title: 'Pedidos do dia', description: 'Pedidos recebidos para preparo, retirada ou entrega.', href: '/painel/pedidos', badge: 'Food' },
      { title: 'Entregas', description: 'Módulo de entrega em preparação para este segmento.', href: '/painel/modulos/entregas', prepared: true },
      { title: 'Horários', description: 'Configure horários de funcionamento.', href: '/painel/modulos/horarios', prepared: true },
      { title: 'Taxas de entrega', description: 'Configure bairros, taxas e pedido mínimo.', href: '/painel/modulos/taxas-entrega', prepared: true },
    ]
  }

  if (config.id === 'graphic' || config.id === 'custom_products') {
    return [
      ...common,
      { title: 'Orçamentos', description: 'Receba medidas, quantidades, arquivos e observações.', href: '/painel/pedidos', badge: 'Gráfica' },
      { title: 'Artes', description: 'Acompanhe arquivos enviados pelos clientes.', href: '/painel/modulos/artes', prepared: true },
      { title: 'Produção', description: 'Controle etapas, prazos e responsáveis.', href: '/painel/producao' },
      { title: 'Aprovação de arte', description: 'Módulo de aprovação em preparação.', href: '/painel/modulos/aprovacao-arte', prepared: true },
    ]
  }

  if (config.id === 'beauty' || config.id === 'barber') {
    return [
      ...common,
      { title: 'Agenda', description: 'Agendamentos em preparação para este segmento.', href: '/painel/modulos/agenda', prepared: true },
      { title: 'Serviços', description: 'Configure serviços, pacotes, duração e preço.', href: '/painel/produtos' },
      { title: 'Profissionais', description: 'Equipe e profissionais em preparação.', href: '/painel/modulos/profissionais', prepared: true },
      { title: 'Horários', description: 'Horários de atendimento em preparação.', href: '/painel/modulos/horarios', prepared: true },
    ]
  }

  return common
}
