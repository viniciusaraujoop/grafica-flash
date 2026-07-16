export type BusinessSegment =
  | 'services'
  | 'graphic'
  | 'custom_products'
  | 'food'
  | 'auto'
  | 'technical_assistance'
  | 'beauty'
  | 'barber'
  | 'store'
  | 'events'

export type ModuleStatus = 'active' | 'beta' | 'coming_soon' | 'hidden'

export type ModuleGroup =
  | 'principal'
  | 'comercial'
  | 'operacao'
  | 'financeiro'
  | 'presenca_digital'
  | 'relatorios'
  | 'sistema'
  | 'administracao'

export type PanelModuleGroup = ModuleGroup
export type RequiredPlan = 'basic' | 'intermediate' | 'premium' | null

export type PanelModule = {
  id: string
  emoji: string
  label: string
  description: string
  href: string
  fallbackHref?: string
  relatedHref?: string
  group: ModuleGroup
  segments: BusinessSegment[]
  status: ModuleStatus
  requiredPlan: RequiredPlan
  requiresActiveSubscription: boolean
  iconName: string
  icon: string
  isGlobal?: boolean
  isOperational?: boolean
  aliases?: string[]
  badge?: string
  futureActions?: string[]
}

export type SidebarGroup = {
  group: ModuleGroup
  label: string
  modules: PanelModule[]
}

export type PanelQuickAction = {
  id: string
  label: string
  title: string
  description: string
  href: string
  badge?: string
}

export const panelGroupLabels: Record<PanelModuleGroup, string> = {
  principal: 'Principal',
  comercial: 'Comercial',
  operacao: 'Operação',
  financeiro: 'Financeiro',
  presenca_digital: 'Presença digital',
  relatorios: 'Relatórios',
  sistema: 'Sistema',
  administracao: 'Administração',
}

export const moduleGroupLabels = panelGroupLabels

const allSegments: BusinessSegment[] = [
  'services',
  'graphic',
  'custom_products',
  'food',
  'auto',
  'technical_assistance',
  'beauty',
  'barber',
  'store',
  'events',
]

const groupOrder: ModuleGroup[] = [
  'principal',
  'comercial',
  'operacao',
  'financeiro',
  'presenca_digital',
  'relatorios',
  'sistema',
  'administracao',
]

export const knownExistingPanelRoutes: string[] = [
  '/painel',
  '/painel/admin',
  '/painel/assistente',
  '/painel/auditoria',
  '/painel/catalogo',
  '/painel/central-operacional',
  '/painel/clientes',
  '/painel/configuracoes',
  '/painel/configuracoes/equipe',
  '/painel/crm',
  '/painel/cupom',
  '/painel/cupons',
  '/painel/equipe',
  '/painel/financeiro',
  '/painel/financeiro/lancamentos',
  '/painel/financeiro/contas-a-receber',
  '/painel/financeiro/contas-a-pagar',
  '/painel/financeiro/materiais',
  '/painel/follow-up',
  '/painel/historico',
  '/painel/marketplace',
  '/painel/mensagens',
  '/painel/modulos/[module]',
  '/painel/notas-fiscais',
  '/painel/notificacoes',
  '/painel/notificacoes/inteligentes',
  '/painel/onboarding',
  '/painel/oportunidades',
  '/painel/orcamento-inteligente',
  '/painel/orcamento/[id]',
  '/painel/pedidos',
  '/painel/pedidos/[id]',
  '/painel/pagamentos',
  '/painel/pagamentos/configuracao',
  '/painel/pagamentos/vendas',
  '/painel/producao',
  '/painel/produtos',
  '/painel/produtos/[id]',
  '/painel/produtos/ia',
  '/painel/proposta/[id]',
  '/painel/propostas',
  '/painel/relatorios',
  '/painel/segmento',
  '/painel/segmentos',
  '/painel/setup',
  '/painel/site',
  '/painel/tarefas',
  '/painel/whatsapp',
  '/assinatura',
  '/painel/artes',
  '/painel/aprovacao-arte',
  '/painel/entregas',
  '/painel/horarios',
  '/painel/taxas-entrega',
  '/painel/ordens-servico',
  '/painel/analises',
  '/painel/equipamentos',
  '/painel/veiculos',
  '/painel/pecas',
  '/painel/mao-de-obra',
  '/painel/aprovacao-cliente',
  '/painel/garantias',
  '/painel/aparelhos',
  '/painel/diagnostico',
  '/painel/defeitos',
  '/painel/manutencao',
  '/painel/fotos',
  '/painel/orcamento-tecnico',
  '/painel/agenda',
  '/painel/profissionais',
  '/painel/pacotes',
  '/painel/comissoes',
  '/painel/lembretes',
  '/painel/datas',
  '/painel/contratos',
  '/painel/sinal-pagamento',
  '/painel/checklist-evento',
  '/painel/equipe-evento',
  '/painel/itens-alugados',
  '/painel/estoque',
  '/painel/promocoes',
  '/painel/destaques',
  '/painel/solicitacoes',
  '/painel/prazos',
  '/painel/revisoes',
  '/painel/formas-pagamento',
]

export const knownExistingPanelRouteSet = new Set<string>(knownExistingPanelRoutes)

function normalizeBusinessType(value: unknown): BusinessSegment {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const aliases: Record<string, BusinessSegment> = {
    services: 'services',
    service: 'services',
    servicos: 'services',
    servicos_gerais: 'services',
    manutencao: 'services',

    graphic: 'graphic',
    grafica: 'graphic',
    graficas: 'graphic',
    comunicacao_visual: 'graphic',

    custom_products: 'custom_products',
    personalizados: 'custom_products',
    produtos_personalizados: 'custom_products',

    food: 'food',
    alimenticio: 'food',
    restaurante: 'food',
    lanchonete: 'food',
    delivery: 'food',
    cardapio: 'food',

    auto: 'auto',
    oficina: 'auto',
    automotivo: 'auto',
    oficina_auto: 'auto',

    technical_assistance: 'technical_assistance',
    assistencia: 'technical_assistance',
    assistencia_tecnica: 'technical_assistance',
    conserto: 'technical_assistance',

    beauty: 'beauty',
    beleza: 'beauty',
    estetica: 'beauty',
    salao: 'beauty',

    barber: 'barber',
    barbearia: 'barber',

    store: 'store',
    loja: 'store',
    comercio: 'store',
    varejo: 'store',

    events: 'events',
    eventos: 'events',
    festa: 'events',
  }

  return aliases[raw] || 'services'
}

function slugFromId(id: string) {
  return id.replace(/_/g, '-')
}

function routeExists(href: string) {
  if (href.startsWith('http')) return true
  if (href.startsWith('/painel/modulos/')) return true

  const cleanHref = href.split('?')[0]
  return knownExistingPanelRouteSet.has(cleanHref)
}

function makeModule(input: Omit<PanelModule, 'icon'>): PanelModule {
  return {
    ...input,
    icon: input.emoji || input.iconName || '•',
  }
}

const modules: Array<Omit<PanelModule, 'icon'>> = [
  {
    id: 'dashboard',
    emoji: '🏠',
    label: 'Dashboard',
    description: 'Resumo da operação, indicadores principais e ações rápidas.',
    href: '/painel',
    group: 'principal',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'dashboard',
    isGlobal: true,
  },
  {
    id: 'produtos_servicos',
    emoji: '📦',
    label: 'Produtos / Serviços',
    description: 'Gestão dos itens cadastrados: fotos, vídeo, preço, categoria e disponibilidade.',
    href: '/painel/produtos',
    group: 'principal',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'produtos',
    isGlobal: true,
    aliases: ['produtos', 'servicos', 'cardapio', 'serviços'],
    futureActions: ['Cadastrar item', 'Editar fotos e vídeo', 'Ativar ou inativar', 'Ver no site público'],
  },
  {
    id: 'catalogo',
    emoji: '🛒',
    label: 'Catálogo / Marketplace',
    description: 'Vitrine comercial dos produtos e serviços, usando a mesma base visual nova.',
    href: '/painel/catalogo',
    fallbackHref: '/painel/produtos',
    relatedHref: '/painel/produtos',
    group: 'principal',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'catalogo',
    isGlobal: true,
    aliases: ['marketplace', 'vitrine', 'loja'],
    futureActions: ['Ver itens ativos', 'Conferir aparência comercial', 'Acessar site público', 'Organizar experiência de compra'],
  },
  {
    id: 'pedidos',
    emoji: '📥',
    label: 'Pedidos',
    description: 'Pedidos, solicitações e orçamentos recebidos.',
    href: '/painel/pedidos',
    group: 'principal',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'pedidos',
    isGlobal: true,
    aliases: ['pedidos_orcamentos', 'solicitacoes'],
  },
  {
    id: 'pagamentos_marketplace',
    emoji: '💳',
    label: 'Pagamentos',
    description: 'Acompanhe Pix e cartão online recebidos pelo site.',
    href: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'pagamentos',
    isGlobal: true,
    aliases: ['pagamentos', 'mercado_pago', 'split', 'vendas_online'],
    futureActions: ['Conectar Mercado Pago', 'Ver vendas online', 'Acompanhar status'],
  },
  {
    id: 'clientes_crm',
    emoji: '👥',
    label: 'Clientes/CRM',
    description: 'Clientes, leads, histórico, tags, observações e oportunidades.',
    href: '/painel/crm',
    fallbackHref: '/painel/clientes',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'clientes',
    isGlobal: true,
    aliases: ['crm', 'clientes', 'leads'],
    futureActions: ['Gerenciar clientes', 'Registrar histórico', 'Criar tags', 'Acompanhar oportunidades'],
  },
  {
    id: 'follow_up',
    emoji: '🔁',
    label: 'Follow-up',
    description: 'Clientes, propostas e oportunidades que precisam de retorno.',
    href: '/painel/follow-up',
    relatedHref: '/painel/crm',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'follow_up',
    isGlobal: true,
    aliases: ['follow-up', 'followup', 'retorno_comercial'],
    futureActions: ['Ver clientes aguardando retorno', 'Chamar no WhatsApp', 'Agendar retorno', 'Marcar como resolvido', 'Vincular proposta'],
  },
  {
    id: 'propostas',
    emoji: '📄',
    label: 'Propostas',
    description: 'Propostas comerciais, status, validade, itens e aprovação.',
    href: '/painel/propostas',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'propostas',
    isGlobal: true,
    aliases: ['proposta'],
    futureActions: ['Criar proposta', 'Vincular cliente', 'Enviar pelo WhatsApp', 'Acompanhar aceite'],
  },
  {
    id: 'cupons',
    emoji: '🎟️',
    label: 'Cupons',
    description: 'Promoções, descontos, campanhas e regras comerciais.',
    href: '/painel/cupons',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'cupons',
    isGlobal: true,
    aliases: ['cupom', 'promocoes'],
  },

  // Financeiro global
  {
    id: 'financeiro',
    emoji: '💰',
    label: 'Financeiro',
    description: 'Visão geral de entradas, saídas, contas, notas e resultado.',
    href: '/painel/financeiro',
    group: 'financeiro',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'financeiro',
    isGlobal: true,
    aliases: ['fluxo_caixa'],
  },
  {
    id: 'entradas_saidas',
    emoji: '📥',
    label: 'Entradas e saídas',
    description: 'Lançamentos financeiros de receita e despesa.',
    href: '/painel/financeiro/lancamentos',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'entradas_saidas',
    isGlobal: true,
    aliases: ['lancamentos', 'entradas-saidas'],
  },
  {
    id: 'contas_receber',
    emoji: '📆',
    label: 'Contas a receber',
    description: 'Valores que clientes ainda precisam pagar.',
    href: '/painel/financeiro/contas-a-receber',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'contas_receber',
    isGlobal: true,
    aliases: ['contas-receber', 'receber'],
  },
  {
    id: 'contas_pagar',
    emoji: '📤',
    label: 'Contas a pagar',
    description: 'Despesas futuras, fornecedores e pagamentos pendentes.',
    href: '/painel/financeiro/contas-a-pagar',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'contas_pagar',
    isGlobal: true,
    aliases: ['contas-pagar', 'pagar'],
  },
  {
    id: 'notas_fiscais',
    emoji: '🧾',
    label: 'Notas fiscais',
    description: 'Notas emitidas e recebidas, XML/PDF e vínculo financeiro.',
    href: '/painel/notas-fiscais',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'notas_fiscais',
    isGlobal: true,
    aliases: ['notas-fiscais', 'nf', 'xml', 'danfe'],
  },
  {
    id: 'materiais_custos',
    emoji: '📦',
    label: 'Materiais e custos',
    description: 'Gastos com materiais, insumos, peças e custos de produção.',
    href: '/painel/financeiro/materiais',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'financeiro',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'materiais',
    isGlobal: true,
    aliases: ['materiais', 'custos', 'materiais-acabamentos'],
  },

  // Presença digital e sistema
  {
    id: 'site',
    emoji: '🌐',
    label: 'Site',
    description: 'Editor do site público, textos, cores, logo, catálogo e publicação.',
    href: '/painel/site',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'site',
    isGlobal: true,
  },
  {
    id: 'whatsapp',
    emoji: '💬',
    label: 'WhatsApp',
    description: 'Configurações e automações de atendimento pelo WhatsApp.',
    href: '/painel/whatsapp',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'whatsapp',
    isGlobal: true,
  },
  {
    id: 'configuracoes',
    emoji: '⚙️',
    label: 'Configurações',
    description: 'Dados da empresa, equipe, preferências e ajustes do sistema.',
    href: '/painel/configuracoes',
    group: 'sistema',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'configuracoes',
    isGlobal: true,
  },
  {
    id: 'assinatura',
    emoji: '💳',
    label: 'Assinatura',
    description: 'Plano atual, renovação e acesso aos recursos.',
    href: '/assinatura',
    group: 'sistema',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: false,
    iconName: 'assinatura',
    isGlobal: true,
  },

  // Gráfica e personalizados
  {
    id: 'artes_recebidas',
    emoji: '🎨',
    label: 'Artes recebidas',
    description: 'Arquivos enviados pelos clientes, vínculo com orçamento e aprovação.',
    href: '/painel/artes',
    fallbackHref: '/painel/modulos/artes-recebidas',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'artes',
    isOperational: true,
    aliases: ['artes', 'artes-recebidas'],
    futureActions: ['Ver arquivos enviados', 'Aprovar ou reprovar arte', 'Solicitar correção', 'Vincular arte ao orçamento', 'Baixar arquivos'],
  },
  {
    id: 'aprovacao_arte',
    emoji: '✅',
    label: 'Aprovação de arte',
    description: 'Aprovar, reprovar, solicitar ajuste e registrar aprovação do cliente.',
    href: '/painel/aprovacao-arte',
    fallbackHref: '/painel/modulos/aprovacao-arte',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'aprovacao_arte',
    isOperational: true,
    aliases: ['aprovacao-arte'],
    futureActions: ['Enviar para aprovação', 'Registrar aprovado', 'Solicitar correção', 'Histórico de versões'],
  },
  {
    id: 'producao',
    emoji: '🏭',
    label: 'Produção',
    description: 'Etapas, status, prazos, responsáveis e conclusão da operação.',
    href: '/painel/producao',
    group: 'operacao',
    segments: ['graphic', 'custom_products', 'auto', 'technical_assistance'],
    status: 'active',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'producao',
    isOperational: true,
    aliases: ['produção'],
  },
  {
    id: 'prazos',
    emoji: '⏱️',
    label: 'Prazos',
    description: 'Controle prazos de orçamento, aprovação, produção e entrega.',
    href: '/painel/prazos',
    fallbackHref: '/painel/modulos/prazos',
    relatedHref: '/painel/producao',
    group: 'operacao',
    segments: ['graphic', 'custom_products', 'services'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'prazos',
    isOperational: true,
    futureActions: ['Definir prazo prometido', 'Ver atrasos', 'Vincular pedido', 'Alertar produção'],
  },
  {
    id: 'revisoes',
    emoji: '🔁',
    label: 'Revisões',
    description: 'Revisões de arte, pedidos e solicitações de ajuste.',
    href: '/painel/revisoes',
    fallbackHref: '/painel/modulos/revisoes',
    relatedHref: '/painel/aprovacao-arte',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'revisoes',
    isOperational: true,
    futureActions: ['Registrar revisão', 'Solicitar correção', 'Enviar nova versão', 'Acompanhar aprovação'],
  },

  // Food
  {
    id: 'pedidos_dia',
    emoji: '🍔',
    label: 'Pedidos do dia',
    description: 'Pedidos de hoje, preparo, retirada e entrega.',
    href: '/painel/pedidos',
    group: 'operacao',
    segments: ['food'],
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'food',
    isOperational: true,
    badge: 'Food',
  },
  {
    id: 'cardapio',
    emoji: '📋',
    label: 'Cardápio',
    description: 'Itens, combos, bebidas, adicionais e disponibilidade.',
    href: '/painel/produtos',
    relatedHref: '/painel/catalogo',
    group: 'operacao',
    segments: ['food'],
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'cardapio',
    isOperational: true,
    aliases: ['menu'],
  },
  {
    id: 'entregas',
    emoji: '🚚',
    label: 'Entregas',
    description: 'Acompanhe entregas, retirada, regiões e status dos pedidos.',
    href: '/painel/entregas',
    fallbackHref: '/painel/modulos/entregas',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'entregas',
    isOperational: true,
    futureActions: ['Registrar entrega', 'Definir status', 'Vincular pedido', 'Acompanhar retirada'],
  },
  {
    id: 'horarios',
    emoji: '⏰',
    label: 'Horários',
    description: 'Horários de funcionamento, atendimento, agenda e retirada.',
    href: '/painel/horarios',
    fallbackHref: '/painel/modulos/horarios',
    relatedHref: '/painel/site',
    group: 'operacao',
    segments: ['food', 'beauty', 'barber'],
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'horarios',
    isOperational: true,
    futureActions: ['Configurar dias', 'Definir horários', 'Marcar indisponibilidade', 'Exibir no site'],
  },
  {
    id: 'taxas_entrega',
    emoji: '📍',
    label: 'Taxas de entrega',
    description: 'Regiões, valores mínimos, taxa e regras de entrega.',
    href: '/painel/taxas-entrega',
    fallbackHref: '/painel/modulos/taxas-entrega',
    relatedHref: '/painel/site',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'taxas_entrega',
    isOperational: true,
    futureActions: ['Cadastrar região', 'Definir taxa', 'Valor mínimo', 'Prazo estimado'],
  },
  {
    id: 'formas_pagamento',
    emoji: '💳',
    label: 'Formas de pagamento',
    description: 'Pix, dinheiro, cartão, retirada, entrega e regras de pagamento.',
    href: '/painel/pagamentos?tab=formas',
    fallbackHref: '/painel/pagamentos?tab=formas',
    relatedHref: '/painel/pagamentos',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'formas_pagamento',
    isOperational: true,
    futureActions: ['Configurar Pix manual', 'Adicionar dinheiro/cartão', 'Definir instruções', 'Exibir no checkout'],
  },

  // Auto / oficina
  {
    id: 'ordens_servico',
    emoji: '🔧',
    label: 'Ordens de serviço',
    description: 'Controle serviços, análises, peças, mão de obra, aprovação do cliente e garantias.',
    href: '/painel/ordens-servico',
    fallbackHref: '/painel/modulos/ordens-servico',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'ordens_servico',
    isOperational: true,
    aliases: ['ordens-servico', 'os'],
    futureActions: ['Criar OS', 'Vincular cliente', 'Adicionar veículo/equipamento', 'Registrar diagnóstico', 'Informar peças e mão de obra', 'Acompanhar status'],
  },
  {
    id: 'veiculos',
    emoji: '🚗',
    label: 'Veículos',
    description: 'Histórico, placa, modelo, cliente e serviços vinculados.',
    href: '/painel/veiculos',
    fallbackHref: '/painel/equipamentos',
    relatedHref: '/painel/clientes',
    group: 'operacao',
    segments: ['auto'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'veiculos',
    isOperational: true,
    aliases: ['equipamentos'],
    futureActions: ['Cadastrar veículo', 'Vincular cliente', 'Registrar placa/modelo', 'Ver histórico de serviços'],
  },
  {
    id: 'analises',
    emoji: '🧪',
    label: 'Análises',
    description: 'Diagnóstico técnico, aprovação e observações da análise.',
    href: '/painel/analises',
    fallbackHref: '/painel/modulos/analises',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'analises',
    isOperational: true,
    futureActions: ['Registrar diagnóstico', 'Adicionar observações', 'Solicitar aprovação', 'Vincular orçamento'],
  },
  {
    id: 'pecas',
    emoji: '🧩',
    label: 'Peças',
    description: 'Controle peças usadas, compras e vínculo com serviço.',
    href: '/painel/pecas',
    fallbackHref: '/painel/financeiro/materiais',
    relatedHref: '/painel/financeiro/materiais',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'pecas',
    isOperational: true,
    futureActions: ['Cadastrar peça', 'Vincular OS', 'Registrar custo', 'Controlar garantia'],
  },
  {
    id: 'mao_de_obra',
    emoji: '👷',
    label: 'Mão de obra',
    description: 'Serviços executados, profissionais, custos e execução.',
    href: '/painel/mao-de-obra',
    fallbackHref: '/painel/modulos/mao-de-obra',
    relatedHref: '/painel/ordens-servico',
    group: 'operacao',
    segments: ['auto'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'mao_de_obra',
    isOperational: true,
    futureActions: ['Adicionar serviço executado', 'Vincular profissional', 'Definir custo', 'Acompanhar execução'],
  },
  {
    id: 'aprovacao_cliente',
    emoji: '✅',
    label: 'Aprovação do cliente',
    description: 'Aprovação de orçamento, serviço, peças e execução.',
    href: '/painel/aprovacao-cliente',
    fallbackHref: '/painel/modulos/aprovacao-cliente',
    relatedHref: '/painel/propostas',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'aprovacao_cliente',
    isOperational: true,
    futureActions: ['Enviar orçamento', 'Registrar aprovação', 'Solicitar ajuste', 'Guardar histórico'],
  },
  {
    id: 'garantias',
    emoji: '🛡️',
    label: 'Garantias',
    description: 'Prazos de garantia, condições e vínculo com serviços realizados.',
    href: '/painel/garantias',
    fallbackHref: '/painel/modulos/garantias',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'garantias',
    isOperational: true,
    futureActions: ['Cadastrar garantia', 'Vincular OS', 'Definir validade', 'Consultar histórico'],
  },

  // Assistência técnica
  {
    id: 'aparelhos',
    emoji: '📱',
    label: 'Aparelhos',
    description: 'Marca, modelo, número de série, fotos e cliente vinculado.',
    href: '/painel/aparelhos',
    fallbackHref: '/painel/equipamentos',
    relatedHref: '/painel/clientes',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'aparelhos',
    isOperational: true,
    futureActions: ['Cadastrar aparelho', 'Adicionar marca/modelo', 'Registrar número de série', 'Anexar fotos'],
  },
  {
    id: 'diagnostico',
    emoji: '🔍',
    label: 'Diagnóstico',
    description: 'Análise técnica, defeito relatado, laudo e orçamento.',
    href: '/painel/diagnostico',
    fallbackHref: '/painel/analises',
    relatedHref: '/painel/analises',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'diagnostico',
    isOperational: true,
    aliases: ['defeitos'],
    futureActions: ['Registrar defeito', 'Adicionar diagnóstico', 'Gerar orçamento técnico', 'Solicitar aprovação'],
  },
  {
    id: 'manutencao',
    emoji: '🛠️',
    label: 'Manutenção',
    description: 'Controle etapas de reparo, peças, status e finalização.',
    href: '/painel/manutencao',
    fallbackHref: '/painel/producao',
    relatedHref: '/painel/producao',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'manutencao',
    isOperational: true,
    futureActions: ['Iniciar manutenção', 'Adicionar peça', 'Atualizar status', 'Finalizar reparo'],
  },
  {
    id: 'fotos',
    emoji: '📸',
    label: 'Fotos do aparelho',
    description: 'Fotos recebidas, estado do equipamento e histórico visual.',
    href: '/painel/fotos',
    fallbackHref: '/painel/modulos/fotos',
    relatedHref: '/painel/aparelhos',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'fotos',
    isOperational: true,
    futureActions: ['Enviar fotos', 'Comparar antes/depois', 'Vincular atendimento', 'Baixar arquivos'],
  },
  {
    id: 'orcamento_tecnico',
    emoji: '📄',
    label: 'Orçamento técnico',
    description: 'Proposta técnica com peças, mão de obra e aprovação do cliente.',
    href: '/painel/orcamento-tecnico',
    fallbackHref: '/painel/propostas',
    relatedHref: '/painel/propostas',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'orcamento_tecnico',
    isOperational: true,
    futureActions: ['Adicionar peças', 'Adicionar mão de obra', 'Enviar proposta', 'Registrar aceite'],
  },

  // Beauty, barbearia e serviços agendáveis
  {
    id: 'agenda',
    emoji: '📅',
    label: 'Agenda',
    description: 'Agendamentos, horários, confirmação e atendimento.',
    href: '/painel/agenda',
    fallbackHref: '/painel/modulos/agenda',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['beauty', 'barber', 'events'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'agenda',
    isOperational: true,
    futureActions: ['Criar agendamento', 'Confirmar horário', 'Remarcar cliente', 'Ver agenda do dia'],
  },
  {
    id: 'profissionais',
    emoji: '👤',
    label: 'Profissionais',
    description: 'Equipe, permissões, profissionais e horários vinculados.',
    href: '/painel/profissionais',
    fallbackHref: '/painel/configuracoes/equipe',
    relatedHref: '/painel/configuracoes/equipe',
    group: 'operacao',
    segments: ['beauty', 'barber'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'profissionais',
    isOperational: true,
    futureActions: ['Cadastrar profissional', 'Definir horários', 'Vincular serviços', 'Organizar comissões'],
  },
  {
    id: 'pacotes',
    emoji: '🎁',
    label: 'Pacotes',
    description: 'Pacotes de serviços, combos, eventos e ofertas comerciais.',
    href: '/painel/pacotes',
    fallbackHref: '/painel/produtos',
    relatedHref: '/painel/produtos',
    group: 'operacao',
    segments: ['beauty', 'barber', 'events'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'pacotes',
    isOperational: true,
    futureActions: ['Criar pacote', 'Definir valor', 'Vincular serviços', 'Publicar no catálogo'],
  },
  {
    id: 'comissoes',
    emoji: '💸',
    label: 'Comissões',
    description: 'Comissões por profissional, atendimento, serviço e período.',
    href: '/painel/comissoes',
    fallbackHref: '/painel/financeiro',
    relatedHref: '/painel/pagamentos',
    group: 'operacao',
    segments: ['beauty', 'barber'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'comissoes',
    isOperational: true,
    futureActions: ['Cadastrar regra', 'Calcular comissão', 'Vincular profissional', 'Filtrar por mês'],
  },
  {
    id: 'lembretes',
    emoji: '🔔',
    label: 'Lembretes',
    description: 'Avisos de retorno, agendamento, confirmação e pós-atendimento.',
    href: '/painel/lembretes',
    fallbackHref: '/painel/follow-up',
    relatedHref: '/painel/follow-up',
    group: 'operacao',
    segments: ['beauty', 'barber', 'services'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'lembretes',
    isOperational: true,
    futureActions: ['Criar lembrete', 'Avisar retorno', 'Confirmar horário', 'Acompanhar cliente'],
  },

  // Eventos
  {
    id: 'datas',
    emoji: '📅',
    label: 'Datas disponíveis',
    description: 'Calendário de datas, reservas e indisponibilidades.',
    href: '/painel/datas',
    fallbackHref: '/painel/modulos/datas',
    relatedHref: '/painel/agenda',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'datas',
    isOperational: true,
    aliases: ['datas_disponiveis', 'datas-disponiveis'],
    futureActions: ['Cadastrar data', 'Bloquear dia', 'Vincular evento', 'Consultar disponibilidade'],
  },
  {
    id: 'contratos',
    emoji: '📑',
    label: 'Contratos',
    description: 'Contrato, termos, aceite, anexos e histórico do evento.',
    href: '/painel/contratos',
    fallbackHref: '/painel/modulos/contratos',
    relatedHref: '/painel/propostas',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'contratos',
    isOperational: true,
    futureActions: ['Criar contrato', 'Anexar documento', 'Registrar aceite', 'Vincular proposta'],
  },
  {
    id: 'sinal_pagamento',
    emoji: '💰',
    label: 'Sinal/Pagamento',
    description: 'Controle sinal, parcelas, valores pendentes e confirmação.',
    href: '/painel/sinal-pagamento',
    fallbackHref: '/painel/financeiro/contas-a-receber',
    relatedHref: '/painel/pagamentos',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'sinal_pagamento',
    isOperational: true,
    futureActions: ['Registrar sinal', 'Vincular contrato', 'Controlar parcelas', 'Confirmar pagamento'],
  },
  {
    id: 'checklist_evento',
    emoji: '✅',
    label: 'Checklist do evento',
    description: 'Tarefas, itens e pendências antes da data do evento.',
    href: '/painel/checklist-evento',
    fallbackHref: '/painel/modulos/checklist-evento',
    relatedHref: '/painel/tarefas',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'checklist_evento',
    isOperational: true,
    futureActions: ['Criar checklist', 'Definir responsável', 'Marcar concluído', 'Filtrar pendências'],
  },
  {
    id: 'equipe_evento',
    emoji: '👥',
    label: 'Equipe do evento',
    description: 'Equipe, funções, horários e responsáveis do evento.',
    href: '/painel/equipe-evento',
    fallbackHref: '/painel/equipe',
    relatedHref: '/painel/configuracoes/equipe',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'equipe_evento',
    isOperational: true,
    futureActions: ['Adicionar pessoa', 'Definir função', 'Vincular evento', 'Acompanhar escala'],
  },
  {
    id: 'itens_alugados',
    emoji: '📦',
    label: 'Itens alugados',
    description: 'Itens, equipamentos e materiais vinculados ao evento.',
    href: '/painel/itens-alugados',
    fallbackHref: '/painel/produtos',
    relatedHref: '/painel/produtos',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'itens_alugados',
    isOperational: true,
    futureActions: ['Cadastrar item', 'Vincular evento', 'Controlar retirada', 'Controlar devolução'],
  },

  // Loja e serviços gerais
  {
    id: 'estoque',
    emoji: '📦',
    label: 'Estoque simples',
    description: 'Quantidade disponível, baixo estoque e movimentações simples.',
    href: '/painel/estoque',
    fallbackHref: '/painel/produtos',
    relatedHref: '/painel/produtos',
    group: 'operacao',
    segments: ['store'],
    status: 'coming_soon',
    requiredPlan: 'premium',
    requiresActiveSubscription: true,
    iconName: 'estoque',
    isOperational: true,
    futureActions: ['Definir quantidade', 'Registrar entrada', 'Registrar saída', 'Avisar baixo estoque'],
  },
  {
    id: 'promocoes',
    emoji: '🏷️',
    label: 'Promoções',
    description: 'Ofertas, preços promocionais, campanhas e validade.',
    href: '/painel/promocoes',
    fallbackHref: '/painel/cupons',
    relatedHref: '/painel/cupons',
    group: 'operacao',
    segments: ['store'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'promocoes',
    isOperational: true,
    futureActions: ['Criar promoção', 'Definir validade', 'Vincular produto', 'Publicar no catálogo'],
  },
  {
    id: 'destaques',
    emoji: '⭐',
    label: 'Destaques',
    description: 'Produtos em destaque na vitrine pública.',
    href: '/painel/destaques',
    fallbackHref: '/painel/produtos',
    relatedHref: '/painel/produtos',
    group: 'operacao',
    segments: ['store'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'destaques',
    isOperational: true,
    futureActions: ['Selecionar destaque', 'Ordenar vitrine', 'Adicionar selo', 'Medir interesse'],
  },
  {
    id: 'solicitacoes',
    emoji: '📋',
    label: 'Solicitações',
    description: 'Pedidos de serviço, demandas recebidas e acompanhamento.',
    href: '/painel/solicitacoes',
    fallbackHref: '/painel/pedidos',
    relatedHref: '/painel/pedidos',
    group: 'operacao',
    segments: ['services'],
    status: 'coming_soon',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'solicitacoes',
    isOperational: true,
    futureActions: ['Receber solicitação', 'Vincular cliente', 'Definir prazo', 'Criar proposta'],
  },
]

export const panelModules: PanelModule[] = modules.map(makeModule)

export function getModuleById(id: string) {
  const normalized = id.replace(/-/g, '_')

  return panelModules.find((moduleItem) => {
    if (moduleItem.id === id || moduleItem.id === normalized) return true
    return moduleItem.aliases?.some((alias) => alias === id || alias === normalized || alias.replace(/-/g, '_') === normalized) || false
  })
}

export function getSafeModuleHref(module: Pick<PanelModule, 'href' | 'fallbackHref' | 'id'>) {
  if (routeExists(module.href)) return module.href
  if (module.fallbackHref && routeExists(module.fallbackHref)) return module.fallbackHref

  return `/painel/modulos/${slugFromId(module.id)}`
}

export function getGlobalModules() {
  return panelModules
    .filter((moduleItem) => moduleItem.status !== 'hidden' && moduleItem.isGlobal)
    .map((moduleItem) => ({ ...moduleItem, href: getSafeModuleHref(moduleItem) }))
}

export function getOperationalModulesForBusinessType(businessType: unknown) {
  const segment = normalizeBusinessType(businessType)

  return panelModules
    .filter((moduleItem) => moduleItem.status !== 'hidden')
    .filter((moduleItem) => Boolean(moduleItem.isOperational) && moduleItem.segments.includes(segment))
    .map((moduleItem) => ({ ...moduleItem, href: getSafeModuleHref(moduleItem) }))
}

export function getModulesForBusinessType(businessType: unknown) {
  const segment = normalizeBusinessType(businessType)
  const selected = panelModules
    .filter((moduleItem) => moduleItem.status !== 'hidden')
    .filter((moduleItem) => moduleItem.isGlobal || moduleItem.segments.includes(segment))
    .map((moduleItem) => ({ ...moduleItem, href: getSafeModuleHref(moduleItem) }))

  const byHref = new Map<string, PanelModule>()

  for (const moduleItem of selected) {
    const existing = byHref.get(moduleItem.href)
    if (!existing) {
      byHref.set(moduleItem.href, moduleItem)
      continue
    }

    const moduleIsSegmentSpecific = !moduleItem.isGlobal && moduleItem.segments.includes(segment)
    const existingIsGlobal = Boolean(existing.isGlobal)

    if (moduleIsSegmentSpecific && existingIsGlobal) {
      byHref.set(moduleItem.href, moduleItem)
    }
  }

  return Array.from(byHref.values())
}

export function getPanelModulesForBusinessType(businessType: unknown) {
  return getModulesForBusinessType(businessType)
}

export function getSidebarGroups(businessType: unknown): SidebarGroup[] {
  const modulesForType = getModulesForBusinessType(businessType)

  return groupOrder
    .map((group) => ({
      group,
      label: panelGroupLabels[group],
      modules: modulesForType.filter((module) => module.group === group),
    }))
    .filter((item) => item.modules.length > 0)
}

export function getModulesByGroup(businessType: unknown) {
  return getSidebarGroups(businessType)
}

export function getModulesByGroupForBusinessType(businessType: unknown) {
  return getSidebarGroups(businessType)
}

function actionFromModule(id: string, label?: string, description?: string): PanelQuickAction | null {
  const moduleInfo = getModuleById(id)
  if (!moduleInfo) return null

  const actionLabel = label || moduleInfo.label

  return {
    id: moduleInfo.id,
    label: actionLabel,
    title: actionLabel,
    description: description || moduleInfo.description,
    href: getSafeModuleHref(moduleInfo),
    badge: moduleInfo.badge,
  }
}

function cleanActions(actions: Array<PanelQuickAction | null>) {
  const seen = new Set<string>()

  return actions.filter((action): action is PanelQuickAction => {
    if (!action) return false

    const key = `${action.id}-${action.label}`
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export function getQuickActionsForBusinessType(businessType: unknown, options: { publicLink?: string } = {}) {
  const segment = normalizeBusinessType(businessType)
  const viewSite: PanelQuickAction = {
    id: 'ver_site',
    label: 'Ver site',
    title: 'Ver site',
    description: options.publicLink ? 'Abra a página pública da empresa.' : 'Configure o link público no editor do site.',
    href: options.publicLink || '/painel/site',
  }

  if (segment === 'food') {
    return cleanActions([
      actionFromModule('cardapio', 'Novo item do cardápio', 'Cadastre item, foto, preço e disponibilidade.'),
      actionFromModule('pedidos_dia', 'Ver pedidos do dia', 'Acompanhe preparo, retirada e entrega.'),
      actionFromModule('entregas', 'Organizar entregas', 'Controle entregas e retirada.'),
      actionFromModule('horarios', 'Editar horários', 'Configure atendimento e funcionamento.'),
      actionFromModule('cupons', 'Cadastrar cupom', 'Crie promoções para aumentar pedidos.'),
      actionFromModule('financeiro', 'Financeiro do dia', 'Veja entradas, saídas e resultado.'),
      viewSite,
    ])
  }

  if (segment === 'graphic' || segment === 'custom_products') {
    return cleanActions([
      actionFromModule('produtos_servicos', 'Novo produto gráfico', 'Cadastre impressos, personalizados e serviços.'),
      actionFromModule('artes_recebidas', 'Ver artes recebidas', 'Gerencie arquivos enviados pelos clientes.'),
      actionFromModule('aprovacao_arte', 'Aprovação de arte', 'Aprove, reprove ou solicite correções.'),
      actionFromModule('producao', 'Abrir produção', 'Controle etapas, prazos e status.'),
      actionFromModule('propostas', 'Criar proposta', 'Transforme orçamento em proposta comercial.'),
      actionFromModule('follow_up', 'Retomar clientes', 'Não deixe orçamento parado morrer no WhatsApp.'),
      viewSite,
    ])
  }

  if (segment === 'auto') {
    return cleanActions([
      actionFromModule('ordens_servico', 'Nova ordem de serviço', 'Crie OS para análise, execução e entrega.'),
      actionFromModule('veiculos', 'Cadastrar veículo', 'Registre placa, modelo e histórico.'),
      actionFromModule('analises', 'Ver análises', 'Acompanhe diagnóstico e aprovação.'),
      actionFromModule('pecas', 'Registrar peça', 'Vincule peças e custos ao serviço.'),
      actionFromModule('financeiro', 'Registrar entrada', 'Registre recebimentos e despesas.'),
      viewSite,
    ])
  }

  if (segment === 'technical_assistance') {
    return cleanActions([
      actionFromModule('aparelhos', 'Cadastrar aparelho', 'Registre marca, modelo e número de série.'),
      actionFromModule('diagnostico', 'Registrar diagnóstico', 'Análise técnica e orçamento.'),
      actionFromModule('manutencao', 'Abrir manutenção', 'Acompanhe reparo e peças.'),
      actionFromModule('garantias', 'Ver garantias', 'Controle prazos e condições.'),
      actionFromModule('follow_up', 'Retomar clientes', 'Recupere orçamentos sem resposta.'),
      viewSite,
    ])
  }

  if (segment === 'beauty' || segment === 'barber') {
    return cleanActions([
      actionFromModule('agenda', 'Novo agendamento', 'Organize horários e atendimentos.'),
      actionFromModule('produtos_servicos', 'Novo serviço', 'Cadastre serviços, valores e duração.'),
      actionFromModule('profissionais', 'Adicionar profissional', 'Organize equipe e permissões.'),
      actionFromModule('comissoes', 'Ver comissões', 'Acompanhe ganhos por profissional.'),
      actionFromModule('follow_up', 'Lembretes e retornos', 'Acompanhe clientes que precisam voltar.'),
      viewSite,
    ])
  }

  if (segment === 'events') {
    return cleanActions([
      actionFromModule('datas', 'Ver datas disponíveis', 'Organize reservas e disponibilidade.'),
      actionFromModule('pacotes', 'Criar pacote', 'Monte pacotes e ofertas.'),
      actionFromModule('contratos', 'Contrato do evento', 'Prepare documentos e aceite.'),
      actionFromModule('checklist_evento', 'Checklist do evento', 'Controle pendências antes da data.'),
      actionFromModule('financeiro', 'Registrar sinal', 'Acompanhe reserva e pagamento.'),
      viewSite,
    ])
  }

  if (segment === 'store') {
    return cleanActions([
      actionFromModule('produtos_servicos', 'Novo produto', 'Cadastre produto, foto, preço e estoque.'),
      actionFromModule('catalogo', 'Ver catálogo', 'Veja a vitrine comercial.'),
      actionFromModule('estoque', 'Estoque simples', 'Controle quantidades e alertas.'),
      actionFromModule('promocoes', 'Criar promoção', 'Organize ofertas e campanhas.'),
      actionFromModule('financeiro', 'Financeiro', 'Controle entradas e saídas.'),
      viewSite,
    ])
  }

  return cleanActions([
    actionFromModule('pedidos', 'Nova solicitação', 'Acompanhe pedidos e orçamentos.'),
    actionFromModule('produtos_servicos', 'Novo serviço', 'Cadastre serviços e pacotes.'),
    actionFromModule('propostas', 'Criar proposta', 'Envie propostas comerciais.'),
    actionFromModule('clientes_crm', 'Ver CRM', 'Acompanhe clientes e histórico.'),
    actionFromModule('follow_up', 'Follow-up comercial', 'Retome oportunidades paradas.'),
    actionFromModule('financeiro', 'Financeiro', 'Controle entradas e saídas.'),
    viewSite,
  ])
}

export function getQuickActionsForSegment(businessType: unknown, options: { publicLink?: string } = {}) {
  return getQuickActionsForBusinessType(businessType, options)
}

export function getVisibleGroupOrder() {
  return groupOrder
}

export { normalizeBusinessType as normalizePanelBusinessType }
