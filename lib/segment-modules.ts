export type SegmentType =
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

export type ModuleStatus = 'active' | 'beta' | 'coming_soon' | 'hidden'

export type ModuleGroup =
  | 'principal'
  | 'comercial'
  | 'operacao'
  | 'financeiro'
  | 'presenca_digital'
  | 'relatorios'
  | 'sistema'

export type SegmentModule = {
  id: string
  label: string
  description: string
  href: string
  fallbackHref?: string
  group: ModuleGroup
  segments: SegmentType[]
  status: ModuleStatus
  iconName: string
  requiresActiveSubscription: boolean
  badge?: string
  isGlobal?: boolean
  aliases?: string[]
  relatedHref?: string
  futureActions?: string[]
}

export type SegmentQuickAction = {
  id: string
  label: string
  description: string
  href: string
  badge?: string
}

export type SegmentDashboardCard = {
  title: string
  description: string
  metricKey:
    | 'pedidosHoje'
    | 'pedidosTotal'
    | 'pedidosPendentes'
    | 'pedidosAndamento'
    | 'pedidosConcluidos'
    | 'faturamentoEstimado'
    | 'faturamentoHoje'
    | 'propostasTotal'
    | 'propostasPendentes'
    | 'produtosTotal'
    | 'produtosAtivos'
    | 'produtosDestaque'
    | 'clientesTotal'
    | 'aguardandoArte'
    | 'propostasEnviadas'
    | 'emProducao'
    | 'aguardandoAprovacao'
    | 'emPreparo'
    | 'prontos'
    | 'saiuEntrega'
    | 'emAnalise'
}

export type SegmentInfo = {
  id: SegmentType
  label: string
  shortLabel: string
  description: string
  principalModules: string[]
  adminModules: string[]
  developmentModules: string[]
}

export const allSegments: SegmentType[] = [
  'services',
  'graphic',
  'food',
  'beauty',
  'barber',
  'technical_assistance',
  'auto',
  'store',
  'events',
  'custom_products',
]

export const moduleGroupLabels: Record<ModuleGroup, string> = {
  principal: 'Principal',
  comercial: 'Comercial',
  operacao: 'Operação',
  financeiro: 'Financeiro',
  presenca_digital: 'Presença digital',
  relatorios: 'Relatórios',
  sistema: 'Sistema',
}

const existingPanelRoutes = new Set([
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
  '/painel/segmentos',
  '/painel/setup',
  '/painel/site',
  '/painel/tarefas',
  '/painel/formas-pagamento',
  '/painel/taxas-entrega',
  '/painel/horarios',
  '/painel/entregas',
  '/painel/whatsapp',
  '/assinatura',
])

export const segmentInfos: SegmentInfo[] = [
  {
    id: 'food',
    label: 'Alimentício / Food',
    shortLabel: 'Food',
    description: 'Organize pedidos, cardápio, entregas, horários, taxas e financeiro em um painel feito para negócios alimentícios.',
    principalModules: ['Pedidos do dia', 'Cardápio', 'Entregas', 'Horários', 'Taxas de entrega', 'Formas de pagamento', 'Cupons'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Entradas e saídas', 'Contas a receber', 'Contas a pagar', 'Notas fiscais'],
    developmentModules: ['Adicionais', 'Formas de pagamento', 'Itens mais vendidos'],
  },
  {
    id: 'graphic',
    label: 'Gráfica e personalizados',
    shortLabel: 'Gráfica',
    description: 'Organize orçamentos, artes, aprovação, produção, propostas e clientes em um painel feito para gráficas e personalizados.',
    principalModules: ['Orçamentos', 'Artes recebidas', 'Aprovação de arte', 'Produção', 'Propostas', 'Produtos gráficos', 'Cupons'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais', 'Relatórios'],
    developmentModules: ['Leitura de arquivos', 'Aprovação pelo cliente', 'Mapa de produção'],
  },
  {
    id: 'custom_products',
    label: 'Produtos personalizados',
    shortLabel: 'Personalizados',
    description: 'Receba pedidos com referências, variações, arte, aprovação e produção organizada.',
    principalModules: ['Orçamentos', 'Artes recebidas', 'Aprovação de arte', 'Produção', 'Produtos personalizados', 'Propostas'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais', 'Relatórios'],
    developmentModules: ['Variações', 'Personalização por item', 'Aprovação visual'],
  },
  {
    id: 'auto',
    label: 'Oficina / Auto',
    shortLabel: 'Auto',
    description: 'Controle ordens de serviço, análises, veículos, peças, mão de obra, garantias e financeiro.',
    principalModules: ['Ordens de serviço', 'Análises', 'Equipamentos/Veículos', 'Peças', 'Aprovação do cliente', 'Garantias'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais'],
    developmentModules: ['Controle de peças', 'Mão de obra', 'Histórico do veículo'],
  },
  {
    id: 'technical_assistance',
    label: 'Assistência técnica',
    shortLabel: 'Assistência',
    description: 'Gerencie solicitações, aparelhos, defeitos, fotos, análise técnica, manutenção e garantias.',
    principalModules: ['Solicitações', 'Aparelhos', 'Defeitos', 'Análise técnica', 'Manutenção', 'Garantia'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais'],
    developmentModules: ['Fotos do problema', 'Número de série', 'Laudo técnico'],
  },
  {
    id: 'beauty',
    label: 'Beauty / Estética',
    shortLabel: 'Beauty',
    description: 'Organize agenda, serviços, profissionais, horários, clientes, pacotes e financeiro.',
    principalModules: ['Agenda', 'Serviços', 'Profissionais', 'Horários', 'Pacotes', 'Cupons'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Comissões'],
    developmentModules: ['Preferências do cliente', 'Comissões', 'Próximo atendimento'],
  },
  {
    id: 'barber',
    label: 'Barbearia',
    shortLabel: 'Barbearia',
    description: 'Gerencie serviços, agenda, profissionais, combos, horários e relacionamento com clientes.',
    principalModules: ['Agenda', 'Serviços', 'Profissionais', 'Horários', 'Pacotes', 'Cupons'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Comissões'],
    developmentModules: ['Combos', 'Recorrência', 'Preferências'],
  },
  {
    id: 'store',
    label: 'Loja / Comércio',
    shortLabel: 'Loja',
    description: 'Controle produtos, catálogo, pedidos, promoções, cupons, clientes e financeiro.',
    principalModules: ['Produtos', 'Catálogo', 'Pedidos', 'Estoque simples', 'Cupons', 'Promoções'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais'],
    developmentModules: ['Estoque simples', 'Promoções', 'Relatórios por categoria'],
  },
  {
    id: 'events',
    label: 'Eventos',
    shortLabel: 'Eventos',
    description: 'Organize solicitações, datas, pacotes, contratos, sinal de pagamento, checklist e financeiro.',
    principalModules: ['Solicitações', 'Datas disponíveis', 'Pacotes', 'Orçamentos', 'Contratos', 'Checklist do evento'],
    adminModules: ['Clientes/CRM', 'Financeiro', 'Notas fiscais'],
    developmentModules: ['Contratos', 'Sinal de pagamento', 'Checklist do evento'],
  },
  {
    id: 'services',
    label: 'Serviços gerais',
    shortLabel: 'Serviços',
    description: 'Organize solicitações, orçamentos, propostas, clientes, financeiro, notas fiscais e relatórios.',
    principalModules: ['Solicitações', 'Orçamentos', 'Propostas', 'Serviços', 'Clientes/CRM'],
    adminModules: ['Financeiro', 'Notas fiscais', 'Site', 'Relatórios'],
    developmentModules: ['Follow-up', 'Contratos', 'Relatórios avançados'],
  },
]

function globalSegments(except: SegmentType[] = []): SegmentType[] {
  return allSegments.filter((segment) => !except.includes(segment))
}

export const segmentModules: SegmentModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Resumo da operação, métricas e ações rápidas.',
    href: '/painel',
    group: 'principal',
    segments: allSegments,
    status: 'active',
    iconName: 'layout-dashboard',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'pedidos_orcamentos',
    label: 'Pedidos/Orçamentos',
    description: 'Solicitações, pedidos e orçamentos recebidos pela empresa.',
    href: '/painel/pedidos',
    group: 'principal',
    segments: ['services'],
    status: 'active',
    iconName: 'inbox',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['pedidos', 'orcamentos'],
  },
  {
    id: 'produtos_servicos',
    label: 'Produtos/Serviços',
    description: 'Catálogo de produtos e serviços vendidos pela empresa.',
    href: '/painel/produtos',
    group: 'principal',
    segments: ['services', 'graphic', 'technical_assistance', 'auto', 'events', 'custom_products'],
    status: 'active',
    iconName: 'package',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['produtos', 'servicos'],
  },
  {
    id: 'clientes_crm',
    label: 'Clientes/CRM',
    description: 'Clientes, leads, histórico, follow-up e observações internas.',
    href: '/painel/crm',
    fallbackHref: '/painel/clientes',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    iconName: 'users',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['crm', 'clientes', 'leads', 'follow-up'],
    futureActions: ['Organizar leads', 'Registrar histórico', 'Criar follow-up', 'Adicionar observações'],
  },
  {
    id: 'propostas',
    label: 'Propostas',
    description: 'Propostas comerciais enviadas, aprovadas, recusadas ou em negociação.',
    href: '/painel/propostas',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    iconName: 'file-text',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['proposta', 'propostas-enviadas'],
    futureActions: ['Criar proposta', 'Enviar pelo WhatsApp', 'Acompanhar aprovação', 'Vincular a pedido'],
  },
  {
    id: 'oportunidades',
    label: 'Oportunidades',
    description: 'Leads e oportunidades comerciais que merecem atenção.',
    href: '/painel/oportunidades',
    group: 'comercial',
    segments: allSegments,
    status: 'beta',
    iconName: 'sparkles',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'tarefas',
    label: 'Tarefas',
    description: 'Tarefas internas e acompanhamento da equipe.',
    href: '/painel/tarefas',
    group: 'comercial',
    segments: allSegments,
    status: 'beta',
    iconName: 'check-square',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Entradas, saídas, contas, resultado do mês e visão financeira.',
    href: '/painel/financeiro',
    group: 'financeiro',
    segments: allSegments,
    status: 'active',
    iconName: 'wallet',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['financeiro', 'fluxo-caixa'],
    futureActions: ['Registrar entrada', 'Registrar despesa', 'Ver resumo do mês', 'Acompanhar pendências'],
  },
  {
    id: 'entradas_saidas',
    label: 'Entradas e saídas',
    description: 'Controle lançamentos financeiros de receita e despesa.',
    href: '/painel/entradas-saidas',
    fallbackHref: '/painel/modulos/entradas-saidas',
    group: 'financeiro',
    segments: allSegments,
    status: 'coming_soon',
    iconName: 'arrow-left-right',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['entradas-saidas', 'lancamentos'],
    relatedHref: '/painel/pagamentos',
    futureActions: ['Registrar venda', 'Registrar despesa', 'Vincular pedido', 'Acompanhar pagamento'],
  },
  {
    id: 'contas_receber',
    label: 'Contas a receber',
    description: 'Valores pendentes, recebimentos e previsão de caixa.',
    href: '/painel/contas-receber',
    fallbackHref: '/painel/modulos/contas-receber',
    group: 'financeiro',
    segments: allSegments,
    status: 'coming_soon',
    iconName: 'banknote',
    requiresActiveSubscription: true,
    isGlobal: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Ver pendências', 'Marcar como recebido', 'Vincular proposta', 'Filtrar por cliente'],
  },
  {
    id: 'contas_pagar',
    label: 'Contas a pagar',
    description: 'Despesas, fornecedores, custos fixos e vencimentos.',
    href: '/painel/contas-pagar',
    fallbackHref: '/painel/modulos/contas-pagar',
    group: 'financeiro',
    segments: allSegments,
    status: 'coming_soon',
    iconName: 'receipt',
    requiresActiveSubscription: true,
    isGlobal: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Registrar conta', 'Marcar como paga', 'Anexar comprovante', 'Filtrar por categoria'],
  },
  {
    id: 'notas_fiscais',
    label: 'Notas fiscais',
    description: 'Controle de notas emitidas e recebidas, XML, PDF/DANFE e vínculo com clientes.',
    href: '/painel/notas-fiscais',
    fallbackHref: '/painel/modulos/notas-fiscais',
    group: 'financeiro',
    segments: allSegments,
    status: 'coming_soon',
    iconName: 'file-check',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['notas-fiscais', 'nf', 'xml', 'danfe'],
    relatedHref: '/painel/pagamentos',
    futureActions: ['Cadastrar nota manualmente', 'Enviar XML', 'Anexar PDF/DANFE', 'Vincular cliente e pedido'],
  },
  {
    id: 'cupons',
    label: 'Cupons',
    description: 'Promoções e descontos para pedidos, orçamentos e campanhas.',
    href: '/painel/cupons',
    group: 'comercial',
    segments: allSegments,
    status: 'active',
    iconName: 'badge-percent',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['cupom', 'promocoes'],
    futureActions: ['Criar cupom', 'Definir validade', 'Aplicar por categoria', 'Limitar uso'],
  },
  {
    id: 'site',
    label: 'Site',
    description: 'Editor visual do site, textos, cores, logo, publicação e preview.',
    href: '/painel/site',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    iconName: 'globe',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'catalogo',
    label: 'Catálogo / Marketplace',
    description: 'Vitrine, catálogo, cardápio e produtos exibidos para o cliente.',
    href: '/painel/catalogo',
    fallbackHref: '/painel/produtos',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    iconName: 'store',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['marketplace', 'cardapio', 'catalogo'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Configurações, mensagens e automações de atendimento.',
    href: '/painel/whatsapp',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    iconName: 'message-circle',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    description: 'Auditoria, indicadores e histórico da operação.',
    href: '/painel/auditoria',
    group: 'relatorios',
    segments: allSegments,
    status: 'beta',
    iconName: 'bar-chart',
    requiresActiveSubscription: true,
    isGlobal: true,
    aliases: ['auditoria', 'indicadores'],
  },
  {
    id: 'assistente',
    label: 'Assistente',
    description: 'Assistente inteligente para apoiar a operação.',
    href: '/painel/assistente',
    group: 'relatorios',
    segments: allSegments,
    status: 'beta',
    iconName: 'bot',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    description: 'Alertas importantes da operação e mensagens inteligentes.',
    href: '/painel/notificacoes',
    group: 'relatorios',
    segments: allSegments,
    status: 'active',
    iconName: 'bell',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    description: 'Dados da empresa, equipe, preferências e ajustes do sistema.',
    href: '/painel/configuracoes',
    group: 'sistema',
    segments: allSegments,
    status: 'active',
    iconName: 'settings',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'segmentos',
    label: 'Segmentos e módulos',
    description: 'Escolha como o Orçaly deve organizar sua empresa.',
    href: '/painel/segmento',
    group: 'sistema',
    segments: allSegments,
    status: 'active',
    iconName: 'layers',
    requiresActiveSubscription: true,
    isGlobal: true,
  },
  {
    id: 'assinatura',
    label: 'Assinatura',
    description: 'Plano, renovação e acesso aos recursos.',
    href: '/assinatura',
    group: 'sistema',
    segments: allSegments,
    status: 'active',
    iconName: 'credit-card',
    requiresActiveSubscription: false,
    isGlobal: true,
  },

  // Food
  {
    id: 'pedidos_dia',
    label: 'Pedidos do dia',
    description: 'Pedidos de hoje, preparo, retirada e entrega.',
    href: '/painel/pedidos',
    group: 'principal',
    segments: ['food'],
    status: 'active',
    iconName: 'clipboard-list',
    requiresActiveSubscription: true,
    badge: 'Food',
    aliases: ['pedidos-hoje', 'pedidos-dia'],
  },
  {
    id: 'cardapio',
    label: 'Cardápio',
    description: 'Itens do cardápio, fotos, preços, adicionais e disponibilidade.',
    href: '/painel/produtos',
    group: 'principal',
    segments: ['food'],
    status: 'active',
    iconName: 'utensils',
    requiresActiveSubscription: true,
    badge: 'Food',
    aliases: ['cardápio'],
  },
  {
    id: 'adicionais',
    label: 'Adicionais',
    description: 'Complementos, variações e extras dos produtos.',
    href: '/painel/adicionais',
    fallbackHref: '/painel/modulos/adicionais',
    group: 'operacao',
    segments: ['food'],
    status: 'coming_soon',
    iconName: 'plus-circle',
    requiresActiveSubscription: true,
    relatedHref: '/painel/produtos',
    futureActions: ['Criar adicional', 'Definir preço', 'Vincular item', 'Organizar opções'],
  },
  {
    id: 'entregas',
    label: 'Entregas',
    description: 'Acompanhe entregas, retirada, regiões e status dos pedidos.',
    href: '/painel/entregas',
    fallbackHref: '/painel/modulos/entregas',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'active',
    iconName: 'truck',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Registrar entrega', 'Definir status', 'Vincular pedido', 'Acompanhar retirada'],
  },
  {
    id: 'horarios',
    label: 'Horários',
    description: 'Horários de funcionamento, atendimento, agenda e retirada.',
    href: '/painel/horarios',
    fallbackHref: '/painel/modulos/horarios',
    group: 'operacao',
    segments: ['food', 'beauty', 'barber'],
    status: 'active',
    iconName: 'clock',
    requiresActiveSubscription: true,
    relatedHref: '/painel/site',
    futureActions: ['Configurar dias', 'Definir horários', 'Marcar indisponibilidade', 'Exibir no site'],
  },
  {
    id: 'taxas_entrega',
    label: 'Taxas de entrega',
    description: 'Regiões, valores mínimos, taxa e regras de entrega.',
    href: '/painel/taxas-entrega',
    fallbackHref: '/painel/modulos/taxas-entrega',
    group: 'operacao',
    segments: ['food', 'store'],
    status: 'active',
    iconName: 'map-pin',
    requiresActiveSubscription: true,
    relatedHref: '/painel/site',
    futureActions: ['Cadastrar região', 'Definir taxa', 'Valor mínimo', 'Prazo estimado'],
  },
  {
    id: 'formas_pagamento',
    label: 'Formas de pagamento',
    description: 'Pix manual, dinheiro, cartão na entrega e instruções operacionais.',
    href: '/painel/pagamentos?tab=formas',
    fallbackHref: '/painel/pagamentos?tab=formas',
    group: 'financeiro',
    segments: ['food', 'store', 'services', 'graphic', 'custom_products'],
    status: 'active',
    iconName: 'credit-card',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Ativar Pix manual', 'Informar cartão local', 'Salvar instruções', 'Exibir no checkout'],
  },

  // Gráfica e personalizados
  {
    id: 'orcamentos',
    label: 'Orçamentos',
    description: 'Solicitações de orçamento, medidas, quantidades, materiais e status.',
    href: '/painel/orcamentos',
    fallbackHref: '/painel/pedidos',
    group: 'principal',
    segments: ['graphic', 'custom_products', 'services', 'events', 'auto'],
    status: 'active',
    iconName: 'calculator',
    requiresActiveSubscription: true,
    aliases: ['orcamento', 'orçamentos'],
  },
  {
    id: 'novo_orcamento',
    label: 'Novo orçamento',
    description: 'Crie ou simule orçamento com apoio inteligente.',
    href: '/painel/orcamentos/novo',
    fallbackHref: '/painel/orcamento-inteligente',
    group: 'principal',
    segments: ['graphic', 'custom_products', 'services', 'events', 'auto'],
    status: 'active',
    iconName: 'plus',
    requiresActiveSubscription: true,
    aliases: ['novo-orcamento'],
  },
  {
    id: 'artes_recebidas',
    label: 'Artes recebidas',
    description: 'Arquivos enviados pelos clientes, vínculo com orçamento e aprovação.',
    href: '/painel/artes',
    fallbackHref: '/painel/modulos/artes-recebidas',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'coming_soon',
    iconName: 'image',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    aliases: ['artes', 'artes-recebidas'],
    futureActions: ['Ver arquivos enviados', 'Aprovar ou reprovar arte', 'Solicitar correção', 'Vincular arte ao orçamento', 'Baixar arquivos'],
  },
  {
    id: 'aprovacao_arte',
    label: 'Aprovação de arte',
    description: 'Aprovar, reprovar, solicitar ajuste e registrar aprovação do cliente.',
    href: '/painel/aprovacao-arte',
    fallbackHref: '/painel/modulos/aprovacao-arte',
    group: 'operacao',
    segments: ['graphic', 'custom_products'],
    status: 'coming_soon',
    iconName: 'badge-check',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    aliases: ['aprovação-arte', 'aprovacao-arte'],
    futureActions: ['Enviar para aprovação', 'Registrar aprovado', 'Solicitar correção', 'Histórico de versões'],
  },
  {
    id: 'producao',
    label: 'Produção',
    description: 'Etapas, status, prazos, responsáveis e conclusão da operação.',
    href: '/painel/producao',
    group: 'operacao',
    segments: ['graphic', 'custom_products', 'technical_assistance', 'auto'],
    status: 'active',
    iconName: 'factory',
    requiresActiveSubscription: true,
    aliases: ['produção'],
    futureActions: ['Mover etapa', 'Acompanhar prazo', 'Ver responsáveis', 'Marcar como pronto'],
  },
  {
    id: 'produtos_graficos',
    label: 'Produtos gráficos',
    description: 'Produtos, serviços gráficos, medidas, materiais e preços.',
    href: '/painel/produtos',
    group: 'principal',
    segments: ['graphic', 'custom_products'],
    status: 'active',
    iconName: 'package-open',
    requiresActiveSubscription: true,
  },

  // Auto e assistência
  {
    id: 'solicitacoes',
    label: 'Solicitações',
    description: 'Solicitações recebidas, status, cliente e detalhes do atendimento.',
    href: '/painel/pedidos',
    group: 'principal',
    segments: ['technical_assistance', 'events', 'services'],
    status: 'active',
    iconName: 'inbox',
    requiresActiveSubscription: true,
  },
  {
    id: 'ordens_servico',
    label: 'Ordens de serviço',
    description: 'Organize serviços, análises, peças, mão de obra, status e garantias.',
    href: '/painel/ordens-servico',
    fallbackHref: '/painel/modulos/ordens-servico',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    iconName: 'clipboard-check',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    aliases: ['ordens-servico', 'os'],
    futureActions: ['Criar OS', 'Vincular cliente', 'Adicionar veículo/equipamento', 'Registrar diagnóstico', 'Informar peças e mão de obra', 'Acompanhar status'],
  },
  {
    id: 'analises',
    label: 'Análises',
    description: 'Diagnóstico técnico, aprovação e observações da análise.',
    href: '/painel/analises',
    fallbackHref: '/painel/modulos/analises',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    iconName: 'search-check',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Registrar diagnóstico', 'Adicionar observações', 'Solicitar aprovação', 'Vincular orçamento'],
  },
  {
    id: 'equipamentos',
    label: 'Equipamentos/Veículos',
    description: 'Dados do veículo, equipamento, aparelho, placa, modelo ou número de série.',
    href: '/painel/equipamentos',
    fallbackHref: '/painel/modulos/equipamentos',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    iconName: 'car',
    requiresActiveSubscription: true,
    relatedHref: '/painel/clientes',
    aliases: ['veiculos', 'aparelhos'],
    futureActions: ['Cadastrar veículo/equipamento', 'Vincular cliente', 'Registrar placa/modelo', 'Ver histórico'],
  },
  {
    id: 'pecas',
    label: 'Peças',
    description: 'Peças usadas, custo, fornecedor, estoque simples e garantia.',
    href: '/painel/pecas',
    fallbackHref: '/painel/modulos/pecas',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    iconName: 'wrench',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Registrar peça', 'Informar custo', 'Vincular OS', 'Controlar garantia'],
  },
  {
    id: 'mao_obra',
    label: 'Mão de obra',
    description: 'Serviços executados, tempo, custo e profissional responsável.',
    href: '/painel/mao-obra',
    fallbackHref: '/painel/modulos/mao-obra',
    group: 'operacao',
    segments: ['auto'],
    status: 'coming_soon',
    iconName: 'hammer',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Registrar serviço', 'Calcular custo', 'Vincular profissional', 'Compor orçamento'],
  },
  {
    id: 'aprovacao_cliente',
    label: 'Aprovação do cliente',
    description: 'Proposta técnica, aceite, reprovação e histórico de resposta.',
    href: '/painel/aprovacao-cliente',
    fallbackHref: '/painel/modulos/aprovacao-cliente',
    group: 'operacao',
    segments: ['auto', 'technical_assistance', 'events'],
    status: 'coming_soon',
    iconName: 'user-check',
    requiresActiveSubscription: true,
    relatedHref: '/painel/propostas',
    futureActions: ['Enviar proposta', 'Registrar aceite', 'Registrar recusa', 'Anexar condições'],
  },
  {
    id: 'garantias',
    label: 'Garantias',
    description: 'Prazos de garantia, condições e vínculo com serviços realizados.',
    href: '/painel/garantias',
    fallbackHref: '/painel/modulos/garantias',
    group: 'operacao',
    segments: ['auto', 'technical_assistance'],
    status: 'coming_soon',
    iconName: 'shield-check',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Cadastrar garantia', 'Vincular OS', 'Definir validade', 'Consultar histórico'],
  },
  {
    id: 'aparelhos',
    label: 'Aparelhos',
    description: 'Marca, modelo, número de série, defeito e fotos do equipamento.',
    href: '/painel/aparelhos',
    fallbackHref: '/painel/modulos/aparelhos',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    iconName: 'smartphone',
    requiresActiveSubscription: true,
    relatedHref: '/painel/clientes',
    futureActions: ['Cadastrar aparelho', 'Vincular cliente', 'Registrar defeito', 'Anexar fotos'],
  },
  {
    id: 'defeitos',
    label: 'Defeitos',
    description: 'Tipos de defeito, fotos, observações e diagnóstico inicial.',
    href: '/painel/defeitos',
    fallbackHref: '/painel/modulos/defeitos',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    iconName: 'bug',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Registrar defeito', 'Anexar fotos', 'Classificar problema', 'Gerar análise'],
  },
  {
    id: 'analise_tecnica',
    label: 'Análise técnica',
    description: 'Diagnóstico, laudo, aprovação, orçamento técnico e status.',
    href: '/painel/analise-tecnica',
    fallbackHref: '/painel/modulos/analise-tecnica',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    iconName: 'scan-search',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Criar laudo', 'Anexar fotos', 'Gerar orçamento', 'Solicitar aprovação'],
  },
  {
    id: 'manutencao',
    label: 'Manutenção',
    description: 'Execução do reparo, teste final e status de retirada.',
    href: '/painel/manutencao',
    fallbackHref: '/painel/modulos/manutencao',
    group: 'operacao',
    segments: ['technical_assistance'],
    status: 'coming_soon',
    iconName: 'settings-2',
    requiresActiveSubscription: true,
    relatedHref: '/painel/producao',
    futureActions: ['Atualizar manutenção', 'Registrar peça', 'Teste final', 'Marcar pronto'],
  },

  // Beauty e barbearia
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Agendamentos, horários, confirmação e atendimento.',
    href: '/painel/agenda',
    fallbackHref: '/painel/modulos/agenda',
    group: 'operacao',
    segments: ['beauty', 'barber'],
    status: 'coming_soon',
    iconName: 'calendar',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Criar agendamento', 'Confirmar horário', 'Remarcar cliente', 'Ver agenda do dia'],
  },
  {
    id: 'servicos',
    label: 'Serviços',
    description: 'Serviços, valores, duração e descrição para agendamento.',
    href: '/painel/servicos',
    fallbackHref: '/painel/produtos',
    group: 'principal',
    segments: ['beauty', 'barber'],
    status: 'active',
    iconName: 'sparkle',
    requiresActiveSubscription: true,
  },
  {
    id: 'profissionais',
    label: 'Profissionais',
    description: 'Equipe, permissões, profissionais e horários vinculados.',
    href: '/painel/profissionais',
    fallbackHref: '/painel/configuracoes/equipe',
    group: 'operacao',
    segments: ['beauty', 'barber'],
    status: 'active',
    iconName: 'users-round',
    requiresActiveSubscription: true,
  },
  {
    id: 'pacotes',
    label: 'Pacotes',
    description: 'Pacotes de serviços, combos, recorrência e descontos.',
    href: '/painel/pacotes',
    fallbackHref: '/painel/modulos/pacotes',
    group: 'operacao',
    segments: ['beauty', 'barber', 'events'],
    status: 'coming_soon',
    iconName: 'gift',
    requiresActiveSubscription: true,
    relatedHref: '/painel/produtos',
    futureActions: ['Criar pacote', 'Definir validade', 'Vincular serviços', 'Aplicar desconto'],
  },
  {
    id: 'comissoes',
    label: 'Comissões',
    description: 'Comissões de profissionais, atendimentos e repasses.',
    href: '/painel/comissoes',
    fallbackHref: '/painel/modulos/comissoes',
    group: 'financeiro',
    segments: ['beauty', 'barber'],
    status: 'coming_soon',
    iconName: 'percent',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Definir percentual', 'Vincular profissional', 'Calcular repasse', 'Ver histórico'],
  },

  // Loja
  {
    id: 'produtos',
    label: 'Produtos',
    description: 'Produtos, fotos, vídeos, variações, preço e disponibilidade.',
    href: '/painel/produtos',
    group: 'principal',
    segments: ['store'],
    status: 'active',
    iconName: 'boxes',
    requiresActiveSubscription: true,
  },
  {
    id: 'pedidos',
    label: 'Pedidos',
    description: 'Pedidos recebidos, pendentes, em andamento e concluídos.',
    href: '/painel/pedidos',
    group: 'principal',
    segments: ['store'],
    status: 'active',
    iconName: 'shopping-cart',
    requiresActiveSubscription: true,
  },
  {
    id: 'estoque_simples',
    label: 'Estoque simples',
    description: 'Quantidade, disponibilidade e itens em destaque.',
    href: '/painel/estoque',
    fallbackHref: '/painel/modulos/estoque-simples',
    group: 'operacao',
    segments: ['store'],
    status: 'coming_soon',
    iconName: 'warehouse',
    requiresActiveSubscription: true,
    relatedHref: '/painel/produtos',
    futureActions: ['Registrar quantidade', 'Baixar estoque', 'Alertar item baixo', 'Vincular pedido'],
  },
  {
    id: 'promocoes',
    label: 'Promoções',
    description: 'Campanhas, categorias, destaques e ofertas rápidas.',
    href: '/painel/promocoes',
    fallbackHref: '/painel/modulos/promocoes',
    group: 'comercial',
    segments: ['store'],
    status: 'coming_soon',
    iconName: 'tags',
    requiresActiveSubscription: true,
    relatedHref: '/painel/cupons',
    futureActions: ['Criar promoção', 'Selecionar produto', 'Definir validade', 'Publicar no site'],
  },

  // Eventos
  {
    id: 'datas_disponiveis',
    label: 'Datas disponíveis',
    description: 'Calendário de datas, reservas e indisponibilidades.',
    href: '/painel/datas-disponiveis',
    fallbackHref: '/painel/modulos/datas-disponiveis',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    iconName: 'calendar-days',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pedidos',
    futureActions: ['Cadastrar data', 'Bloquear dia', 'Vincular evento', 'Consultar disponibilidade'],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    description: 'Contrato, termos, aceite, anexos e histórico do evento.',
    href: '/painel/contratos',
    fallbackHref: '/painel/modulos/contratos',
    group: 'comercial',
    segments: ['events'],
    status: 'coming_soon',
    iconName: 'file-signature',
    requiresActiveSubscription: true,
    relatedHref: '/painel/propostas',
    futureActions: ['Criar contrato', 'Anexar documento', 'Registrar aceite', 'Vincular proposta'],
  },
  {
    id: 'sinal_pagamento',
    label: 'Sinal/pagamento',
    description: 'Sinal de reserva, parcelas, vencimentos e comprovantes.',
    href: '/painel/sinal-pagamento',
    fallbackHref: '/painel/modulos/sinal-pagamento',
    group: 'financeiro',
    segments: ['events'],
    status: 'coming_soon',
    iconName: 'landmark',
    requiresActiveSubscription: true,
    relatedHref: '/painel/pagamentos',
    futureActions: ['Registrar sinal', 'Definir parcelas', 'Anexar comprovante', 'Acompanhar saldo'],
  },
  {
    id: 'checklist_evento',
    label: 'Checklist do evento',
    description: 'Itens, responsáveis, prazos e conclusão de cada preparação.',
    href: '/painel/checklist-evento',
    fallbackHref: '/painel/modulos/checklist-evento',
    group: 'operacao',
    segments: ['events'],
    status: 'coming_soon',
    iconName: 'list-checks',
    requiresActiveSubscription: true,
    relatedHref: '/painel/tarefas',
    futureActions: ['Criar checklist', 'Delegar tarefa', 'Definir prazo', 'Marcar como concluído'],
  },
]

const preferredGroupOrder: ModuleGroup[] = [
  'principal',
  'comercial',
  'operacao',
  'financeiro',
  'presenca_digital',
  'relatorios',
  'sistema',
]

export function normalizeSegment(segment: unknown): SegmentType {
  const raw = String(segment || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const aliases: Record<string, SegmentType> = {
    servicos: 'services',
    servicos_gerais: 'services',
    service: 'services',
    services: 'services',
    grafica: 'graphic',
    graphic: 'graphic',
    alimenticio: 'food',
    restaurante: 'food',
    lanchonete: 'food',
    food: 'food',
    estetica: 'beauty',
    beleza: 'beauty',
    beauty: 'beauty',
    barbearia: 'barber',
    barber: 'barber',
    assistencia: 'technical_assistance',
    assistencia_tecnica: 'technical_assistance',
    technical_assistance: 'technical_assistance',
    oficina: 'auto',
    automotivo: 'auto',
    auto: 'auto',
    loja: 'store',
    comercio: 'store',
    store: 'store',
    eventos: 'events',
    events: 'events',
    personalizados: 'custom_products',
    custom_products: 'custom_products',
  }

  return aliases[raw] || 'services'
}

function moduleIdMatch(module: SegmentModule, id: string) {
  const normalized = id.replace(/-/g, '_')
  const aliases = module.aliases || []

  return module.id === normalized || module.id === id || aliases.includes(id) || aliases.includes(normalized)
}

function isRouteAvailable(href: string) {
  if (href.startsWith('http')) return true
  if (href.startsWith('/painel/modulos/')) return true
  const cleanHref = href.split('?')[0]
  return existingPanelRoutes.has(cleanHref)
}

export function getSafeModuleHref(module: SegmentModule) {
  if (isRouteAvailable(module.href)) return module.href
  if (module.fallbackHref && isRouteAvailable(module.fallbackHref)) return module.fallbackHref

  return `/painel/modulos/${module.id.replace(/_/g, '-')}`
}

export function getFallbackModuleHref(module: SegmentModule) {
  return module.fallbackHref || `/painel/modulos/${module.id.replace(/_/g, '-')}`
}

export function getModuleById(id: string) {
  return segmentModules.find((module) => moduleIdMatch(module, id))
}

export function getSegmentInfo(segment: unknown) {
  const normalized = normalizeSegment(segment)
  return segmentInfos.find((info) => info.id === normalized) || segmentInfos.find((info) => info.id === 'services')!
}

export function getModulesForSegment(segment: unknown) {
  const normalized = normalizeSegment(segment)

  return segmentModules
    .filter((moduleItem) => moduleItem.status !== 'hidden')
    .filter((moduleItem) => moduleItem.isGlobal || moduleItem.segments.includes(normalized))
    .map((moduleItem) => ({ ...moduleItem, href: getSafeModuleHref(moduleItem) }))
}

export function getModulesByGroupForSegment(segment: unknown) {
  const modules = getModulesForSegment(segment)

  return preferredGroupOrder
    .map((group) => ({
      group,
      label: moduleGroupLabels[group],
      modules: modules.filter((module) => module.group === group),
    }))
    .filter((item) => item.modules.length > 0)
}

function quick(id: string, label?: string, description?: string): SegmentQuickAction | null {
  const moduleInfo = getModuleById(id)
  if (!moduleInfo) return null

  return {
    id: moduleInfo.id,
    label: label || moduleInfo.label,
    description: description || moduleInfo.description,
    href: getSafeModuleHref(moduleInfo),
    badge: moduleInfo.badge,
  }
}

function uniqueActions(actions: Array<SegmentQuickAction | null>) {
  const usedIds = new Set<string>()
  const usedLabels = new Set<string>()

  return actions.filter((action): action is SegmentQuickAction => {
    if (!action) return false
    const key = `${action.id}-${action.label}`

    if (usedIds.has(key) || usedLabels.has(action.label)) return false

    usedIds.add(key)
    usedLabels.add(action.label)
    return true
  })
}

export function getQuickActionsForSegment(segment: unknown, options: { publicLink?: string } = {}) {
  const normalized = normalizeSegment(segment)
  const viewSite: SegmentQuickAction = {
    id: 'ver_site',
    label: 'Ver site',
    description: options.publicLink ? 'Abra a página pública da empresa.' : 'Configure o link público no editor do site.',
    href: options.publicLink || '/painel/site',
  }

  if (normalized === 'food') {
    return uniqueActions([
      quick('cardapio', 'Adicionar item ao cardápio', 'Cadastre foto, preço, variações e adicionais.'),
      quick('pedidos_dia', 'Ver pedidos', 'Acompanhe preparo, retirada e entrega.'),
      quick('entregas', 'Configurar entrega', 'Organize entregas, retirada e status.'),
      quick('horarios', 'Editar horários', 'Configure horários de funcionamento.'),
      quick('cupons', 'Cadastrar cupom', 'Crie promoções para aumentar pedidos.'),
      quick('entradas_saidas', 'Registrar venda', 'Registre entrada financeira.'),
      quick('financeiro', 'Cadastrar despesa', 'Acompanhe despesas e resultado.'),
      quick('clientes_crm', 'Ver clientes', 'Acesse clientes e histórico.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize XML, PDF e notas vinculadas.'),
      viewSite,
    ])
  }

  if (normalized === 'graphic' || normalized === 'custom_products') {
    return uniqueActions([
      quick('novo_orcamento', 'Novo orçamento', 'Crie ou simule orçamento com apoio inteligente.'),
      quick('artes_recebidas', 'Ver artes recebidas', 'Gerencie arquivos enviados pelos clientes.'),
      quick('aprovacao_arte', 'Aprovação de arte', 'Aprove, reprove ou solicite correções.'),
      quick('producao', 'Abrir produção', 'Controle etapas, prazos e status.'),
      quick('propostas', 'Criar proposta', 'Transforme orçamento em proposta comercial.'),
      quick('produtos_graficos', 'Cadastrar produto gráfico', 'Cadastre materiais, serviços e valores.'),
      quick('cupons', 'Cadastrar cupom', 'Crie descontos e campanhas.'),
      quick('clientes_crm', 'Ver CRM', 'Acompanhe clientes, leads e follow-up.'),
      quick('entradas_saidas', 'Registrar entrada', 'Registre recebimento ou sinal.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize notas e documentos.'),
      viewSite,
    ])
  }

  if (normalized === 'auto') {
    return uniqueActions([
      quick('ordens_servico', 'Nova ordem de serviço', 'Crie OS para análise, execução e entrega.'),
      quick('analises', 'Ver análises', 'Acompanhe diagnóstico e aprovação.'),
      quick('equipamentos', 'Cadastrar equipamento/veículo', 'Registre placa, modelo ou equipamento.'),
      quick('pecas', 'Registrar peça', 'Informe peças e custos vinculados.'),
      quick('mao_obra', 'Registrar mão de obra', 'Adicione serviços executados.'),
      quick('clientes_crm', 'Ver clientes', 'Acesse histórico do cliente.'),
      quick('entradas_saidas', 'Registrar entrada', 'Registre recebimentos e despesas.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize documentos fiscais.'),
      viewSite,
    ])
  }

  if (normalized === 'technical_assistance') {
    return uniqueActions([
      quick('solicitacoes', 'Nova solicitação', 'Acompanhe defeitos, fotos e análise.'),
      quick('analises', 'Ver análises', 'Gerencie diagnóstico e aprovação.'),
      quick('aparelhos', 'Cadastrar aparelho', 'Registre marca, modelo e número de série.'),
      quick('manutencao', 'Atualizar manutenção', 'Acompanhe execução e teste final.'),
      quick('garantias', 'Ver garantias', 'Controle prazos e condições.'),
      quick('entradas_saidas', 'Registrar peça/despesa', 'Registre custo ou lançamento financeiro.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize notas emitidas e recebidas.'),
      viewSite,
    ])
  }

  if (normalized === 'beauty' || normalized === 'barber') {
    return uniqueActions([
      quick('agenda', 'Novo agendamento', 'Organize horários e atendimentos.'),
      quick('servicos', 'Cadastrar serviço', 'Adicione serviços, valores e duração.'),
      quick('profissionais', 'Adicionar profissional', 'Organize equipe e permissões.'),
      quick('horarios', 'Configurar horários', 'Defina funcionamento e agenda.'),
      quick('cupons', 'Cadastrar cupom', 'Crie promoções para pacotes e serviços.'),
      quick('entradas_saidas', 'Registrar entrada', 'Registre recebimentos.'),
      quick('financeiro', 'Cadastrar despesa', 'Acompanhe custos e comissões.'),
      quick('site', 'Editar site', 'Ajuste sua página profissional.'),
      viewSite,
    ])
  }

  if (normalized === 'store') {
    return uniqueActions([
      quick('produtos', 'Cadastrar produto', 'Adicione fotos, preço e variações.'),
      quick('pedidos', 'Ver pedidos', 'Acompanhe pedidos recebidos.'),
      quick('entradas_saidas', 'Registrar venda', 'Registre entrada financeira.'),
      quick('financeiro', 'Cadastrar despesa', 'Acompanhe custos e resultado.'),
      quick('clientes_crm', 'Ver clientes', 'Acesse clientes e histórico.'),
      quick('site', 'Editar site', 'Ajuste a vitrine digital.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize documentos fiscais.'),
      viewSite,
    ])
  }

  if (normalized === 'events') {
    return uniqueActions([
      quick('solicitacoes', 'Nova solicitação', 'Receba informações do evento.'),
      quick('datas_disponiveis', 'Ver datas disponíveis', 'Organize reservas e disponibilidade.'),
      quick('pacotes', 'Cadastrar pacote', 'Crie pacotes e serviços.'),
      quick('contratos', 'Contrato do evento', 'Prepare documentos e aceite.'),
      quick('sinal_pagamento', 'Registrar sinal', 'Acompanhe reserva e pagamento.'),
      quick('checklist_evento', 'Checklist do evento', 'Organize tarefas e preparação.'),
      quick('clientes_crm', 'Ver clientes', 'Acompanhe clientes e histórico.'),
      quick('financeiro', 'Financeiro', 'Veja receitas e despesas.'),
      quick('notas_fiscais', 'Cadastrar nota fiscal', 'Organize documentos fiscais.'),
      viewSite,
    ])
  }

  return uniqueActions([
    quick('solicitacoes', 'Nova solicitação', 'Acompanhe pedidos e orçamentos.'),
    quick('orcamentos', 'Orçamentos', 'Organize solicitações e propostas.'),
    quick('propostas', 'Criar proposta', 'Envie propostas comerciais.'),
    quick('clientes_crm', 'Ver CRM', 'Acompanhe clientes e follow-up.'),
    quick('financeiro', 'Financeiro', 'Controle entradas e saídas.'),
    quick('notas_fiscais', 'Notas fiscais', 'Organize notas e documentos.'),
    quick('site', 'Editar site', 'Configure sua página pública.'),
    viewSite,
  ])
}

export function getSegmentDashboardCards(segment: unknown): SegmentDashboardCard[] {
  const normalized = normalizeSegment(segment)

  if (normalized === 'food') {
    return [
      { title: 'Pedidos de hoje', metricKey: 'pedidosHoje', description: 'Pedidos criados desde meia-noite.' },
      { title: 'Em preparo', metricKey: 'emPreparo', description: 'Pedidos que estão em preparo.' },
      { title: 'Saiu para entrega', metricKey: 'saiuEntrega', description: 'Pedidos com status de entrega.' },
      { title: 'Faturamento do dia', metricKey: 'faturamentoHoje', description: 'Soma estimada dos pedidos de hoje.' },
      { title: 'Clientes recorrentes', metricKey: 'clientesTotal', description: 'Clientes encontrados na base.' },
      { title: 'Itens mais vendidos', metricKey: 'produtosAtivos', description: 'Itens ativos no cardápio.' },
    ]
  }

  if (normalized === 'graphic' || normalized === 'custom_products') {
    return [
      { title: 'Orçamentos recebidos', metricKey: 'pedidosTotal', description: 'Solicitações registradas.' },
      { title: 'Aguardando arte', metricKey: 'aguardandoArte', description: 'Pedidos que precisam de arquivo.' },
      { title: 'Propostas enviadas', metricKey: 'propostasEnviadas', description: 'Propostas e pedidos em proposta.' },
      { title: 'Em produção', metricKey: 'emProducao', description: 'Pedidos em etapa de produção.' },
      { title: 'Prontos para entrega', metricKey: 'prontos', description: 'Pedidos marcados como prontos.' },
      { title: 'Valor em oportunidades', metricKey: 'faturamentoEstimado', description: 'Valor estimado carregado.' },
    ]
  }

  if (normalized === 'auto') {
    return [
      { title: 'Ordens abertas', metricKey: 'pedidosTotal', description: 'Serviços registrados.' },
      { title: 'Em análise', metricKey: 'emAnalise', description: 'Ordens em diagnóstico.' },
      { title: 'Aguardando aprovação', metricKey: 'aguardandoAprovacao', description: 'Serviços pendentes de aceite.' },
      { title: 'Em serviço', metricKey: 'pedidosAndamento', description: 'Serviços em execução.' },
      { title: 'Prontos para entrega', metricKey: 'prontos', description: 'Serviços marcados como prontos.' },
      { title: 'Valor em serviços', metricKey: 'faturamentoEstimado', description: 'Valor estimado dos serviços.' },
    ]
  }

  if (normalized === 'technical_assistance') {
    return [
      { title: 'Solicitações recebidas', metricKey: 'pedidosTotal', description: 'Atendimentos registrados.' },
      { title: 'Em análise', metricKey: 'emAnalise', description: 'Solicitações em diagnóstico.' },
      { title: 'Aguardando aprovação', metricKey: 'aguardandoAprovacao', description: 'Aguardando aceite do cliente.' },
      { title: 'Em manutenção', metricKey: 'pedidosAndamento', description: 'Atendimentos em execução.' },
      { title: 'Prontos para retirada', metricKey: 'prontos', description: 'Itens marcados como prontos.' },
      { title: 'Valor em serviços', metricKey: 'faturamentoEstimado', description: 'Valor estimado dos serviços.' },
    ]
  }

  if (normalized === 'beauty' || normalized === 'barber') {
    return [
      { title: 'Agendamentos de hoje', metricKey: 'pedidosHoje', description: 'Solicitações criadas hoje.' },
      { title: 'Serviços marcados', metricKey: 'pedidosAndamento', description: 'Atendimentos em andamento.' },
      { title: 'Clientes recorrentes', metricKey: 'clientesTotal', description: 'Clientes encontrados na base.' },
      { title: 'Receita prevista', metricKey: 'faturamentoEstimado', description: 'Valor estimado dos atendimentos.' },
      { title: 'Horários livres', metricKey: 'produtosAtivos', description: 'Base para agenda e serviços.' },
      { title: 'Atendimentos concluídos', metricKey: 'pedidosConcluidos', description: 'Solicitações concluídas.' },
    ]
  }

  return [
    { title: 'Pedidos/solicitações', metricKey: 'pedidosTotal', description: 'Solicitações recebidas.' },
    { title: 'Em análise', metricKey: 'pedidosPendentes', description: 'Itens aguardando resposta.' },
    { title: 'Propostas', metricKey: 'propostasTotal', description: 'Propostas criadas.' },
    { title: 'Clientes', metricKey: 'clientesTotal', description: 'Clientes encontrados na base.' },
    { title: 'Valor estimado', metricKey: 'faturamentoEstimado', description: 'Valor estimado carregado.' },
    { title: 'Concluídos', metricKey: 'pedidosConcluidos', description: 'Atendimentos finalizados.' },
  ]
}

export function getVisibleGroupOrder() {
  return preferredGroupOrder
}
