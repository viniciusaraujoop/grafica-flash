import { normalizeBusinessType, type BusinessType } from '@/lib/business-types'

export type PanelModuleGroup =
  | 'principal'
  | 'comercial'
  | 'operacao'
  | 'financeiro'
  | 'presenca'
  | 'relatorios'
  | 'sistema'

export type PanelModuleStatus = 'active' | 'placeholder' | 'future'

export type PanelModule = {
  id: string
  label: string
  description: string
  href: string
  icon: string
  group: PanelModuleGroup
  segments: 'all' | BusinessType[]
  status: PanelModuleStatus
  requiresActiveSubscription: boolean
  fallbackHref: string
  aliases: string[]
  labelByBusinessType?: Partial<Record<BusinessType, string>>
  descriptionByBusinessType?: Partial<Record<BusinessType, string>>
  quick?: boolean
}

export type PanelQuickAction = {
  id: string
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
  presenca: 'Presença digital',
  relatorios: 'Relatórios',
  sistema: 'Sistema',
}

export const knownExistingPanelRoutes = [
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
  '/painel/financeiro',
  '/painel/modulos/[module]',
  '/painel/notificacoes',
  '/painel/notificacoes/inteligentes',
  '/painel/onboarding',
  '/painel/oportunidades',
  '/painel/orcamento-inteligente',
  '/painel/pedidos',
  '/painel/producao',
  '/painel/produtos',
  '/painel/produtos/ia',
  '/painel/propostas',
  '/painel/segmento',
  '/painel/setup',
  '/painel/site',
  '/painel/tarefas',
  '/painel/whatsapp',
  '/assinatura',
]

function modulePlaceholder(id: string) {
  return `/painel/modulos/${id}`
}

export const panelModules: PanelModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Central da empresa com métricas, alertas e próximos passos.',
    href: '/painel',
    icon: '🏠',
    group: 'principal',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: false,
    fallbackHref: '/painel',
    aliases: ['inicio', 'home', 'central'],
  },
  {
    id: 'pedidos',
    label: 'Pedidos/Orçamentos',
    description: 'Solicitações, pedidos, orçamentos e status de atendimento.',
    href: '/painel/pedidos',
    icon: '📥',
    group: 'principal',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('pedidos'),
    aliases: ['orcamentos', 'solicitacoes', 'agendamentos'],
    labelByBusinessType: {
      graphic: 'Orçamentos',
      custom_products: 'Orçamentos',
      food: 'Pedidos',
      beauty: 'Agendamentos',
      barber: 'Agendamentos',
      technical_assistance: 'Solicitações',
      store: 'Pedidos',
      auto: 'Solicitações',
    },
  },
  {
    id: 'produtos',
    label: 'Produtos/Serviços',
    description: 'Catálogo, serviços, preços, fotos, vídeos e disponibilidade.',
    href: '/painel/produtos',
    icon: '🧩',
    group: 'principal',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('produtos'),
    aliases: ['catalogo', 'servicos', 'cardapio'],
    labelByBusinessType: {
      graphic: 'Produtos gráficos',
      custom_products: 'Produtos personalizados',
      food: 'Cardápio',
      beauty: 'Serviços',
      barber: 'Serviços',
      technical_assistance: 'Serviços técnicos',
      store: 'Produtos',
      auto: 'Serviços automotivos',
      events: 'Pacotes',
    },
  },
  {
    id: 'crm',
    label: 'Clientes/CRM',
    description: 'Leads, clientes, histórico, observações e follow-up.',
    href: '/painel/crm',
    icon: '👥',
    group: 'comercial',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: '/painel/clientes',
    aliases: ['clientes', 'leads', 'relacionamento'],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Lista de clientes e contatos recebidos pelo Orçaly.',
    href: '/painel/clientes',
    icon: '🪪',
    group: 'comercial',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: '/painel/crm',
    aliases: ['contatos'],
  },
  {
    id: 'propostas',
    label: 'Propostas',
    description: 'Propostas comerciais, validade, status e envio ao cliente.',
    href: '/painel/propostas',
    icon: '📄',
    group: 'comercial',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('propostas'),
    aliases: ['proposta', 'comercial'],
  },
  {
    id: 'oportunidades',
    label: 'Oportunidades',
    description: 'Pedidos, leads e propostas que precisam de retorno.',
    href: '/painel/oportunidades',
    icon: '🎯',
    group: 'comercial',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('oportunidades'),
    aliases: ['follow-up', 'followup'],
  },
  {
    id: 'orcamento_inteligente',
    label: 'Orçamento inteligente',
    description: 'Criação rápida de orçamento com apoio inteligente.',
    href: '/painel/orcamento-inteligente',
    icon: '⚡',
    group: 'comercial',
    segments: ['graphic', 'custom_products', 'services', 'events', 'auto', 'technical_assistance'],
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('orcamento-inteligente'),
    aliases: ['novo-orcamento', 'orcamento-novo'],
  },
  {
    id: 'artes',
    label: 'Artes recebidas',
    description: 'Arquivos enviados pelos clientes, análise, aprovação e correções.',
    href: '/painel/artes',
    icon: '🎨',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('artes'),
    aliases: ['arquivos', 'arte', 'aprovacao-arte'],
  },
  {
    id: 'aprovacao_arte',
    label: 'Aprovação de arte',
    description: 'Acompanhe aprovações, reprovações e solicitações de correção.',
    href: '/painel/aprovacao-arte',
    icon: '✅',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('aprovacao-arte'),
    aliases: ['aprovar-arte'],
  },
  {
    id: 'producao',
    label: 'Produção',
    description: 'Etapas, prazos, responsáveis e status operacional.',
    href: '/painel/producao',
    icon: '🏭',
    group: 'operacao',
    segments: ['graphic', 'custom_products', 'technical_assistance', 'auto', 'services'],
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('producao'),
    aliases: ['operacao', 'etapas'],
    descriptionByBusinessType: {
      graphic: 'Arte recebida, aprovação, produção, acabamento e entrega.',
      technical_assistance: 'Análise, aprovação, manutenção, teste final e retirada.',
      auto: 'Serviços automotivos por etapa e status.',
    },
  },
  {
    id: 'tarefas',
    label: 'Tarefas',
    description: 'Pendências internas, responsáveis e prazos da operação.',
    href: '/painel/tarefas',
    icon: '📝',
    group: 'operacao',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('tarefas'),
    aliases: ['atividades', 'pendencias'],
  },
  {
    id: 'central_operacional',
    label: 'Central operacional',
    description: 'Visão geral de operação, produção, tarefas e status.',
    href: '/painel/central-operacional',
    icon: '🧭',
    group: 'operacao',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('central-operacional'),
    aliases: ['operacional'],
  },
  {
    id: 'entregas',
    label: 'Entregas',
    description: 'Pedidos em rota, retirada, entrega e taxa por região.',
    href: '/painel/entregas',
    icon: '🛵',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('entregas'),
    aliases: ['delivery', 'retirada'],
  },
  {
    id: 'horarios',
    label: 'Horários',
    description: 'Horários de atendimento, agenda ou funcionamento.',
    href: '/painel/horarios',
    icon: '🕒',
    group: 'operacao',
    segments: ['food', 'beauty', 'barber', 'services', 'store'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('horarios'),
    aliases: ['agenda-horarios'],
  },
  {
    id: 'taxas_entrega',
    label: 'Taxas de entrega',
    description: 'Bairros, regiões, pedido mínimo e taxa de entrega.',
    href: '/painel/taxas-entrega',
    icon: '📍',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('taxas-entrega'),
    aliases: ['bairros', 'regioes'],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Agendamentos, horários, serviços marcados e confirmações.',
    href: '/painel/agenda',
    icon: '📅',
    group: 'operacao',
    segments: ['beauty', 'barber', 'events'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('agenda'),
    aliases: ['agendamentos'],
  },
  {
    id: 'profissionais',
    label: 'Profissionais',
    description: 'Equipe, responsáveis, atendentes e profissionais da operação.',
    href: '/painel/configuracoes/equipe',
    icon: '💈',
    group: 'operacao',
    segments: ['beauty', 'barber', 'services'],
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('profissionais'),
    aliases: ['equipe'],
  },
  {
    id: 'analises',
    label: 'Análises',
    description: 'Diagnóstico, defeitos, fotos e aprovação técnica.',
    href: '/painel/analises',
    icon: '🔎',
    group: 'operacao',
    segments: ['technical_assistance', 'auto'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('analises'),
    aliases: ['diagnosticos'],
  },
  {
    id: 'ordens_servico',
    label: 'Ordens de serviço',
    description: 'Equipamentos, defeitos, peças, status técnico e entrega.',
    href: '/painel/ordens-servico',
    icon: '🧰',
    group: 'operacao',
    segments: ['technical_assistance', 'auto'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('ordens-servico'),
    aliases: ['os', 'ordens'],
  },
  {
    id: 'equipamentos',
    label: 'Equipamentos',
    description: 'Aparelhos, veículos, itens recebidos e histórico técnico.',
    href: '/painel/equipamentos',
    icon: '🖥️',
    group: 'operacao',
    segments: ['technical_assistance', 'auto'],
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('equipamentos'),
    aliases: ['aparelhos', 'veiculos'],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Resumo do mês, entradas, saídas e resultado estimado.',
    href: '/painel/financeiro',
    icon: '💰',
    group: 'financeiro',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('financeiro'),
    aliases: ['caixa', 'fluxo-de-caixa'],
  },
  {
    id: 'entradas_saidas',
    label: 'Entradas e saídas',
    description: 'Lançamentos financeiros de receitas, despesas e pendências.',
    href: '/painel/entradas-saidas',
    icon: '↕️',
    group: 'financeiro',
    segments: 'all',
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('entradas-saidas'),
    aliases: ['lancamentos', 'receitas-despesas'],
  },
  {
    id: 'contas_receber',
    label: 'Contas a receber',
    description: 'Valores pendentes de clientes, propostas e pedidos.',
    href: '/painel/contas-a-receber',
    icon: '🧾',
    group: 'financeiro',
    segments: 'all',
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('contas-a-receber'),
    aliases: ['receber'],
  },
  {
    id: 'contas_pagar',
    label: 'Contas a pagar',
    description: 'Despesas, fornecedores, peças, materiais e custos.',
    href: '/painel/contas-a-pagar',
    icon: '📉',
    group: 'financeiro',
    segments: 'all',
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('contas-a-pagar'),
    aliases: ['pagar', 'despesas'],
  },
  {
    id: 'notas_fiscais',
    label: 'Notas fiscais',
    description: 'Controle de XML, PDF/DANFE, valores, clientes e pedidos vinculados.',
    href: '/painel/notas-fiscais',
    icon: '🧾',
    group: 'financeiro',
    segments: 'all',
    status: 'placeholder',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('notas-fiscais'),
    aliases: ['nf', 'nfe', 'xml', 'danfe'],
  },
  {
    id: 'site',
    label: 'Site',
    description: 'Editor visual, textos, logo, cores, seções e publicação.',
    href: '/painel/site',
    icon: '🌐',
    group: 'presenca',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('site'),
    aliases: ['pagina-publica'],
  },
  {
    id: 'catalogo',
    label: 'Marketplace/Catálogo',
    description: 'Vitrine pública, catálogo, cardápio e experiência de compra.',
    href: '/painel/catalogo',
    icon: '🛍️',
    group: 'presenca',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: '/painel/produtos',
    aliases: ['marketplace', 'vitrine'],
    labelByBusinessType: {
      food: 'Marketplace/Cardápio',
      store: 'Marketplace/Catálogo',
      graphic: 'Catálogo gráfico',
      beauty: 'Catálogo de serviços',
      barber: 'Catálogo de serviços',
    },
  },
  {
    id: 'cupons',
    label: 'Cupons',
    description: 'Cupons promocionais para loja, food e campanhas comerciais.',
    href: '/painel/cupons',
    icon: '🏷️',
    group: 'presenca',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('cupons'),
    aliases: ['promocoes', 'descontos'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Automações, notificações, testes e configuração de mensagens.',
    href: '/painel/whatsapp',
    icon: '💬',
    group: 'presenca',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('whatsapp'),
    aliases: ['mensagens'],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    description: 'Leitura gerencial de pedidos, vendas, clientes e operação.',
    href: '/painel/auditoria',
    icon: '📊',
    group: 'relatorios',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('relatorios'),
    aliases: ['auditoria', 'indicadores'],
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    description: 'Alertas inteligentes, tarefas e avisos importantes.',
    href: '/painel/notificacoes',
    icon: '🔔',
    group: 'relatorios',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('notificacoes'),
    aliases: ['avisos', 'alertas'],
  },
  {
    id: 'assistente',
    label: 'Assistente',
    description: 'Apoio inteligente para operação, análise e próximos passos.',
    href: '/painel/assistente',
    icon: '🤖',
    group: 'relatorios',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('assistente'),
    aliases: ['ia'],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    description: 'Dados da empresa, equipe, permissões e preferências.',
    href: '/painel/configuracoes',
    icon: '⚙️',
    group: 'sistema',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('configuracoes'),
    aliases: ['settings'],
  },
  {
    id: 'segmento',
    label: 'Segmento',
    description: 'Tipo de negócio e módulos recomendados para a operação.',
    href: '/painel/segmento',
    icon: '🧬',
    group: 'sistema',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: true,
    fallbackHref: modulePlaceholder('segmento'),
    aliases: ['business-type'],
  },
  {
    id: 'assinatura',
    label: 'Assinatura',
    description: 'Plano, renovação, pagamento e acesso aos recursos.',
    href: '/assinatura',
    icon: '💳',
    group: 'sistema',
    segments: 'all',
    status: 'active',
    requiresActiveSubscription: false,
    fallbackHref: '/assinatura',
    aliases: ['plano', 'pagamento'],
  },
]

function routeExists(href: string, existingRoutes: readonly string[]) {
  if (href.startsWith('http')) return true
  return existingRoutes.includes(href)
}

function matchesSegment(module: PanelModule, businessType: BusinessType) {
  return module.segments === 'all' || module.segments.includes(businessType)
}

function withBusinessLabels(module: PanelModule, businessType: BusinessType): PanelModule {
  return {
    ...module,
    label: module.labelByBusinessType?.[businessType] || module.label,
    description: module.descriptionByBusinessType?.[businessType] || module.description,
  }
}

export function getModuleHref(module: PanelModule, existingRoutes: readonly string[] = knownExistingPanelRoutes) {
  if (routeExists(module.href, existingRoutes)) return module.href
  if (routeExists(module.fallbackHref, existingRoutes)) return module.fallbackHref
  return module.fallbackHref || modulePlaceholder(module.id)
}

export function getFallbackModuleHref(module: PanelModule) {
  return module.fallbackHref || modulePlaceholder(module.id)
}

export function getPanelModuleById(moduleId: string, businessType: unknown = 'services') {
  const normalized = normalizeBusinessType(businessType)
  const key = moduleId.replace(/-/g, '_')
  const module = panelModules.find((item) => item.id === key || item.id === moduleId || item.aliases.includes(moduleId))
  return module ? withBusinessLabels(module, normalized) : null
}

export function getPanelModulesForBusinessType(
  businessType: unknown,
  existingRoutes: readonly string[] = knownExistingPanelRoutes
) {
  const normalized = normalizeBusinessType(businessType)
  const seen = new Set<string>()

  return panelModules
    .filter((module) => matchesSegment(module, normalized))
    .map((module) => withBusinessLabels(module, normalized))
    .map((module) => ({ ...module, href: getModuleHref(module, existingRoutes) }))
    .filter((module) => {
      const key = `${module.group}:${module.href}:${module.label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function getQuickActionsForBusinessType(
  businessType: unknown,
  options: { publicLink?: string; existingRoutes?: readonly string[] } = {}
): PanelQuickAction[] {
  const normalized = normalizeBusinessType(businessType)
  const existingRoutes = options.existingRoutes || knownExistingPanelRoutes
  const modules = getPanelModulesForBusinessType(normalized, existingRoutes)

  const byId = (id: string) => modules.find((module) => module.id === id)
  const action = (id: string, title: string, description: string, badge?: string): PanelQuickAction | null => {
    const module = byId(id)
    return module ? { id, title, description, href: module.href, badge } : null
  }

  const common = [
    action('crm', 'Ver CRM', 'Clientes, leads, histórico e follow-up.'),
    action('financeiro', 'Abrir financeiro', 'Entradas, saídas e resumo do mês.'),
    action('notas_fiscais', 'Cadastrar nota fiscal', 'Controle de XML/PDF e documentos fiscais.'),
    action('site', 'Editar site', 'Textos, logo, cores e publicação.'),
  ].filter((item): item is PanelQuickAction => Boolean(item))

  if (normalized === 'graphic' || normalized === 'custom_products') {
    return [
      action('orcamento_inteligente', 'Novo orçamento', 'Crie orçamento gráfico sem cair em pedidos genéricos.', 'Gráfica'),
      action('artes', 'Ver artes recebidas', 'Arquivos, aprovações e correções de arte.'),
      action('propostas', 'Criar proposta', 'Envie proposta comercial organizada.'),
      action('produtos', 'Cadastrar produto gráfico', 'Produtos, medidas, valores e serviços gráficos.'),
      action('producao', 'Abrir produção', 'Etapas, prazos e pedidos em produção.'),
      ...common,
    ].filter((item): item is PanelQuickAction => Boolean(item))
  }

  if (normalized === 'food') {
    return [
      action('produtos', 'Adicionar item ao cardápio', 'Fotos, preços, adicionais e disponibilidade.', 'Food'),
      action('pedidos', 'Ver pedidos', 'Pedidos recebidos, preparo, retirada e entrega.'),
      action('entregas', 'Configurar entrega', 'Entrega, retirada e regiões atendidas.'),
      action('financeiro', 'Registrar venda', 'Lançamentos e resumo do caixa.'),
      action('entradas_saidas', 'Cadastrar despesa', 'Custos, compras e saídas.'),
      ...common,
    ].filter((item): item is PanelQuickAction => Boolean(item))
  }

  if (normalized === 'beauty' || normalized === 'barber') {
    return [
      action('agenda', 'Novo agendamento', 'Agenda e solicitações de atendimento.', 'Agenda'),
      action('produtos', 'Cadastrar serviço', 'Serviços, pacotes, valores e descrição.'),
      action('crm', 'Adicionar cliente', 'Clientes, preferências e histórico.'),
      action('financeiro', 'Registrar entrada', 'Recebimentos e resumo mensal.'),
      action('entradas_saidas', 'Cadastrar despesa', 'Custos e saídas do mês.'),
      action('site', 'Editar site', 'Visual, serviços e publicação.'),
    ].filter((item): item is PanelQuickAction => Boolean(item))
  }

  if (normalized === 'technical_assistance' || normalized === 'auto') {
    return [
      action('ordens_servico', 'Nova ordem de serviço', 'Equipamento, defeito, análise e status.', 'OS'),
      action('analises', 'Ver análises', 'Diagnóstico e aprovação técnica.'),
      action('crm', 'Cadastrar cliente', 'Cliente, histórico e contatos.'),
      action('financeiro', 'Registrar peça/despesa', 'Custos de peças e serviços.'),
      action('notas_fiscais', 'Cadastrar nota fiscal', 'XML/PDF e documentos vinculados.'),
      action('producao', 'Atualizar status', 'Etapas técnicas e andamento.'),
    ].filter((item): item is PanelQuickAction => Boolean(item))
  }

  if (normalized === 'store') {
    return [
      action('produtos', 'Cadastrar produto', 'Produtos, fotos, preços e estoque.'),
      action('pedidos', 'Ver pedidos', 'Pedidos recebidos e pendências.'),
      action('financeiro', 'Registrar venda', 'Entradas e resumo do mês.'),
      action('entradas_saidas', 'Cadastrar despesa', 'Custos e saídas.'),
      action('crm', 'Ver clientes', 'Clientes, compras e relacionamento.'),
      action('site', 'Editar site', 'Vitrine e publicação.'),
    ].filter((item): item is PanelQuickAction => Boolean(item))
  }

  return [
    action('pedidos', 'Novo pedido/orçamento', 'Acompanhe solicitações recebidas.'),
    action('produtos', 'Cadastrar serviço', 'Configure serviços e valores.'),
    action('propostas', 'Criar proposta', 'Monte proposta para enviar ao cliente.'),
    ...common,
  ].filter((item): item is PanelQuickAction => Boolean(item))
}
